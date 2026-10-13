import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  type ClaimedMediaJob,
  RENDERER_VERSION_FOR_JOBS,
} from "./shared/mediaJobs";

type T = ReturnType<typeof convexTest>;

const baselinePlan = {
  version: 1,
  engine: "sc-litmus",
  tuning: { kind: "edo", divisions: 19 },
  referenceHz: 432,
  normalize: true,
  tempoBpm: 120,
  durationSecs: 2,
  seed: [
    { degree: 1, octave: 0, startBeat: 0, beats: 1, velocity: 100 },
    { degree: 2, octave: 0, startBeat: 1, beats: 1, velocity: 90 },
  ],
} as const;

const familyPlan = {
  ...baselinePlan,
  variable: { kind: "referenceHz", variants: [440] },
} as const;

async function insertRecipe(t: T, renderPlan?: unknown) {
  return await t.run(async (ctx) => {
    const hypothesisId = await ctx.db.insert("hypotheses", {
      title: "Hypothesis",
      question: "Question",
      hypothesis: "Hypothesis",
      rationaleMd: "Rationale",
      sourceIds: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("recipes", {
      hypothesisId,
      title: "Nineteen",
      bodyMd: "Recipe",
      parameters: [],
      dawChecklist: [],
      status: "draft",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 1,
      ...(renderPlan ? { renderPlan: renderPlan as never } : {}),
    });
  });
}

const human = (t: T) => t.withIdentity({ subject: "human-listener" });

async function setGate(t: T, value: string) {
  await t.mutation(internal.settings.set, { key: "renderValidation", value });
}

async function claim(t: T): Promise<ClaimedMediaJob> {
  const job = await t.mutation(internal.mediaJobs.claimNext, {
    workerId: "worker",
    kinds: ["litmusRender"],
    rendererVersion: RENDERER_VERSION_FOR_JOBS,
  });
  if (!job) throw new Error("no job claimed");
  return job as ClaimedMediaJob;
}

// What the media handler does for one member: mint, upload, attach.
async function uploadMember(
  t: T,
  job: ClaimedMediaJob,
  member: number,
  options: {
    masterRole?: "masterNormalized" | "masterRaw";
    hash?: string;
  } = {},
) {
  const jobId = job.jobId as Id<"mediaJobs">;
  const mint = async (artifact: Record<string, unknown>) => {
    const { artifactId } = await t.mutation(
      internal.mediaToolsInternal.generateAudioUploadUrl,
      { jobId, leaseToken: job.leaseToken, artifact },
    );
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([`${member}-${String(artifact.role)}`])),
    );
    await t.mutation(internal.mediaToolsInternal.attachAudioStorage, {
      jobId,
      leaseToken: job.leaseToken,
      artifactId,
      storageId,
    });
    return artifactId;
  };
  const base = {
    kind: "litmusRender",
    metadataStripped: true,
    normalization: "applied",
    access: "private",
    title: "Litmus render",
    engine: { name: "sc-litmus", version: "0.3.0", params: {} },
  };
  const master = await mint({
    ...base,
    role: options.masterRole ?? "masterNormalized",
    encoding: { codec: "wav", sampleRate: 48000, channels: 2 },
    contentHash: `m${member}${options.hash ?? ""}`,
  });
  const delivery = await mint({
    ...base,
    role: "delivery",
    masterArtifactId: master,
    encoding: {
      codec: "mp3",
      bitrateKbps: 256,
      sampleRate: 48000,
      channels: 2,
    },
    contentHash: `d${member}${options.hash ?? ""}`,
  });
  const measured = (artifactId: Id<"audioArtifacts">, mimeType: string) => ({
    artifactId,
    durationSecs: 2,
    loudnessLufs: -18,
    truePeakDbtp: -2,
    mimeType,
  });
  return {
    member,
    master: measured(master, "audio/wav"),
    delivery: measured(delivery, "audio/mpeg"),
  };
}

async function complete(
  t: T,
  job: ClaimedMediaJob,
  members: Awaited<ReturnType<typeof uploadMember>>[],
) {
  return await t.mutation(internal.mediaJobs.complete, {
    jobId: job.jobId as Id<"mediaJobs">,
    leaseToken: job.leaseToken,
    result: { kind: "litmusRender", members },
  });
}

describe("render plan admission", () => {
  test("setPlan admits a valid plan, rejects an invalid one, and clears", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t);
    await expect(
      human(t).mutation(api.renders.setPlan, {
        recipeId,
        renderPlan: { ...baselinePlan, referenceHz: 5 },
      }),
    ).rejects.toThrow(/Invalid render plan: referenceHz/);
    await human(t).mutation(api.renders.setPlan, {
      recipeId,
      renderPlan: baselinePlan,
    });
    const saved = await t.run((ctx) => ctx.db.get(recipeId));
    expect(saved?.renderPlan).toEqual(baselinePlan);
    expect(saved!.updatedAt).toBeGreaterThan(1);
    await human(t).mutation(api.renders.setPlan, {
      recipeId,
      renderPlan: null,
    });
    expect((await t.run((ctx) => ctx.db.get(recipeId)))?.renderPlan).toBe(
      undefined,
    );
  });

  test("requests need authentication and a typed plan", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t);
    await expect(
      t.mutation(api.renders.request, { recipeId }),
    ).rejects.toThrow();
    await expect(
      human(t).mutation(api.renders.request, { recipeId }),
    ).rejects.toThrow(/needs a typed render plan/);
  });

  test("a stored plan that no longer passes admission is rejected", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, {
      ...baselinePlan,
      durationSecs: 600,
    });
    await expect(
      t.mutation(internal.renders.requestInternal, { recipeId }),
    ).rejects.toThrow(/Invalid render plan: durationSecs/);
  });

  test("study families wait for the go decision", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, familyPlan);
    await expect(
      t.mutation(internal.renders.requestInternal, { recipeId }),
    ).rejects.toThrow(/require renderValidation=go/);
    await setGate(t, "no-go");
    await expect(
      t.mutation(internal.renders.requestInternal, { recipeId }),
    ).rejects.toThrow(/require renderValidation=go/);
    await setGate(t, "go");
    const { created } = await t.mutation(internal.renders.requestInternal, {
      recipeId,
    });
    expect(created).toBe(true);
  });

  test("enqueues an immutable snapshot and dedupes by recipe revision", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    const first = await human(t).mutation(api.renders.request, { recipeId });
    const again = await human(t).mutation(api.renders.request, { recipeId });
    expect(first.created).toBe(true);
    expect(again).toEqual({ jobId: first.jobId, created: false });
    const job = await t.run((ctx) => ctx.db.get(first.jobId));
    expect(job?.input).toEqual({
      kind: "litmusRender",
      recipeId,
      recipeUpdatedAt: 1,
      renderPlan: baselinePlan,
      rendererVersion: RENDERER_VERSION_FOR_JOBS,
    });
    // Editing the plan is a new revision and a new job; the queued snapshot
    // keeps the plan it was admitted with.
    await human(t).mutation(api.renders.setPlan, {
      recipeId,
      renderPlan: { ...baselinePlan, referenceHz: 440 },
    });
    const edited = await human(t).mutation(api.renders.request, { recipeId });
    expect(edited.created).toBe(true);
    expect(
      (await t.run((ctx) => ctx.db.get(first.jobId)))?.input,
    ).toMatchObject({ renderPlan: { referenceHz: 432 } });
  });

  test("only a compatible renderer claims the job", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "old",
        kinds: ["litmusRender"],
        rendererVersion: "0.2.2",
      }),
    ).toBeNull();
    expect(
      await t.mutation(internal.mediaJobs.claimNext, {
        workerId: "narrator",
        kinds: ["narrate"],
        rendererVersion: RENDERER_VERSION_FOR_JOBS,
      }),
    ).toBeNull();
    expect((await claim(t)).kind).toBe("litmusRender");
  });

  test("the gate query reports the setting", async () => {
    const t = convexTest(schema, modules);
    expect(await human(t).query(api.renders.validationGate, {})).toBe(
      "unvalidated",
    );
    await setGate(t, "go");
    expect(await human(t).query(api.renders.validationGate, {})).toBe("go");
  });
});

describe("litmus render completion", () => {
  test("an unvalidated baseline lands ready, private, and out of evidence", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const member = await uploadMember(t, job, 0);
    const done = await complete(t, job, [member]);
    expect(done.resultArtifactIds).toEqual([
      member.master.artifactId,
      member.delivery.artifactId,
    ]);
    const [master, delivery] = await t.run(async (ctx) => [
      await ctx.db.get(member.master.artifactId),
      await ctx.db.get(member.delivery.artifactId),
    ]);
    expect(delivery).toMatchObject({
      status: "ready",
      access: "private",
      validation: "unvalidated",
      title: "Nineteen — litmus render",
      refs: { mediaJobId: job.jobId, recipeId },
      engine: {
        name: "sc-litmus",
        version: RENDERER_VERSION_FOR_JOBS,
        params: { recipeId, recipeUpdatedAt: 1 },
      },
    });
    expect(master).toMatchObject({
      status: "ready",
      validation: "unvalidated",
      refs: { mediaJobId: job.jobId },
    });
    expect(master?.refs.recipeId).toBeUndefined();
    // No composition: the render is not evidence and opens no listening debt.
    expect(
      await t.run((ctx) => ctx.db.query("compositions").collect()),
    ).toEqual([]);
    const docket = await t.query(internal.docket.currentState, {});
    expect(
      docket.filter((card) => card.kind === "compositionNoListening"),
    ).toEqual([]);
    // Existing playback projection lists the delivery, never the master.
    expect(
      await human(t).query(api.audioArtifacts.listReadyForTarget, {
        target: { kind: "recipe", id: recipeId },
      }),
    ).toEqual([
      {
        artifactId: member.delivery.artifactId,
        title: "Nineteen — litmus render",
      },
    ]);
    expect(
      await t.query(internal.audioArtifacts.playbackInternal, {
        artifactId: member.delivery.artifactId,
      }),
    ).toMatchObject({ mimeType: "audio/mpeg" });
    // A repeated completion under the same lease returns the stored result.
    expect(await complete(t, job, [member])).toEqual(done);
  });

  test("a validated baseline creates its composition and links the delivery", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const member = await uploadMember(t, job, 0);
    await complete(t, job, [member]);
    const compositions = await t.run((ctx) =>
      ctx.db.query("compositions").collect(),
    );
    expect(compositions).toHaveLength(1);
    expect(compositions[0]).toMatchObject({
      recipeId,
      title: "Nineteen — litmus baseline",
      artifactType: "microStudy",
      version: "m0.1",
      status: "rendered",
      visibility: "private",
      createdBy: "system",
      audioArtifactId: member.delivery.artifactId,
    });
    expect(compositions[0]?.revisionParentId).toBeUndefined();
    const delivery = await t.run((ctx) =>
      ctx.db.get(member.delivery.artifactId),
    );
    expect(delivery).toMatchObject({
      validation: "validated",
      refs: { compositionId: compositions[0]!._id, recipeId },
    });
    // Validated renders do enter the docket's listening debt.
    const docket = await t.query(internal.docket.currentState, {});
    expect(
      docket.some(
        (card) =>
          card.kind === "compositionNoListening" &&
          card.targetId === compositions[0]!._id,
      ),
    ).toBe(true);
    // Composition reads still validate with the new field.
    const lineage = await human(t).query(api.compositions.getLineage, {
      id: compositions[0]!._id,
    });
    expect(lineage?.composition.audioArtifactId).toBe(
      member.delivery.artifactId,
    );
  });

  test("the gate is read at completion, not admission", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, familyPlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const members = [
      await uploadMember(t, job, 0),
      await uploadMember(t, job, 1),
    ];
    await setGate(t, "no-go");
    await complete(t, job, members);
    expect(
      await t.run((ctx) => ctx.db.query("compositions").collect()),
    ).toEqual([]);
    const delivery = await t.run((ctx) =>
      ctx.db.get(members[1]!.delivery.artifactId),
    );
    expect(delivery?.validation).toBe("unvalidated");
  });

  test("a study family becomes a blind group hidden until reveal", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, familyPlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const members = [
      await uploadMember(t, job, 1),
      await uploadMember(t, job, 0),
    ];
    await complete(t, job, members);
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.purpose).toBe("studyFamily");
    expect(group.xMember).toBeUndefined();
    expect(group.members.map((member) => member.label).toSorted()).toEqual([
      "A",
      "B",
    ]);
    expect(group.members.map((member) => member.artifactId).toSorted()).toEqual(
      members.map((member) => member.delivery.artifactId).toSorted(),
    );
    // Members and their masters are unplayable before reveal, and members
    // share one title so nothing but the label separates them.
    for (const member of members) {
      for (const artifactId of [
        member.master.artifactId,
        member.delivery.artifactId,
      ]) {
        expect(
          await t.query(internal.audioArtifacts.playbackInternal, {
            artifactId,
          }),
        ).toBeNull();
        const row = await t.run((ctx) => ctx.db.get(artifactId));
        expect(row?.blindGroupId).toBe(group._id);
        expect(row?.title.startsWith("Nineteen — study family member")).toBe(
          true,
        );
      }
    }
    expect(
      await human(t).query(api.audioArtifacts.listReadyForTarget, {
        target: { kind: "recipe", id: recipeId },
      }),
    ).toEqual([]);
    const projection = await t.query(internal.blindGroups.projectionInternal, {
      groupId: group._id,
    });
    expect(projection.revealed).toBe(false);
    expect(projection.labels).toBeUndefined();
    // While blind there are no compositions, so the docket offers nothing
    // that names a variant.
    expect(
      await t.run((ctx) => ctx.db.query("compositions").collect()),
    ).toEqual([]);
    const before = await t.query(internal.docket.currentState, {});
    expect(
      before.filter((card) => card.kind === "compositionNoListening"),
    ).toEqual([]);
    await t.mutation(internal.blindGroups.reveal, { groupId: group._id });
    await t.mutation(internal.blindGroups.reveal, { groupId: group._id });
    expect(
      await t.query(internal.audioArtifacts.playbackInternal, {
        artifactId: members[0]!.delivery.artifactId,
      }),
    ).not.toBeNull();
    // Reveal links them once: baseline first, the variant revises it.
    const compositions = await t.run((ctx) =>
      ctx.db.query("compositions").collect(),
    );
    expect(compositions).toHaveLength(2);
    const baseline = compositions.find(
      (row) => row.audioArtifactId === members[1]!.delivery.artifactId,
    );
    const variant = compositions.find(
      (row) => row.audioArtifactId === members[0]!.delivery.artifactId,
    );
    expect(baseline?.revisionParentId).toBeUndefined();
    expect(variant).toMatchObject({
      revisionParentId: baseline!._id,
      revisionVariable: "referenceHz: 440",
    });
    expect(
      (await t.run((ctx) => ctx.db.get(members[0]!.delivery.artifactId)))?.refs
        .compositionId,
    ).toBe(variant!._id);
  });

  test("an unvalidated family links no compositions at reveal", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, familyPlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const members = [
      await uploadMember(t, job, 0),
      await uploadMember(t, job, 1),
    ];
    await setGate(t, "no-go");
    await complete(t, job, members);
    // Flipping the gate back before reveal does not certify these renders.
    await setGate(t, "go");
    const group = (await t.run((ctx) => ctx.db.query("blindGroups").first()))!;
    await t.mutation(internal.blindGroups.reveal, { groupId: group._id });
    expect(
      await t.run((ctx) => ctx.db.query("compositions").collect()),
    ).toEqual([]);
  });

  test("labels are not fixed to member order", async () => {
    const baselineLabels = new Set<string>();
    for (let run = 0; run < 12 && baselineLabels.size < 2; run++) {
      const t = convexTest(schema, modules);
      await setGate(t, "go");
      const recipeId = await insertRecipe(t, familyPlan);
      await t.mutation(internal.renders.requestInternal, { recipeId });
      const job = await claim(t);
      const members = [
        await uploadMember(t, job, 0),
        await uploadMember(t, job, 1),
      ];
      await complete(t, job, members);
      const group = (await t.run((ctx) =>
        ctx.db.query("blindGroups").first(),
      ))!;
      baselineLabels.add(
        group.members.find(
          (member) => member.artifactId === members[0]!.delivery.artifactId,
        )!.label,
      );
    }
    expect([...baselineLabels].toSorted()).toEqual(["A", "B"]);
  });

  test("rejects results that do not cover the plan's members exactly", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, familyPlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const zero = await uploadMember(t, job, 0);
    const one = await uploadMember(t, job, 1);
    await expect(complete(t, job, [zero])).rejects.toThrow(
      /members 0..1 exactly once/,
    );
    await expect(
      complete(t, job, [zero, { ...one, member: 0 }]),
    ).rejects.toThrow(/members 0..1 exactly once/);
    await expect(
      complete(t, job, [zero, { ...one, delivery: zero.delivery }]),
    ).rejects.toThrow(/distinct artifacts/);
    await expect(
      complete(t, job, [
        zero,
        { ...one, master: one.delivery, delivery: one.master },
      ]),
    ).rejects.toThrow(/needs a masterNormalized master and its delivery/);
    // Nothing was published by the rejected attempts.
    const rows = await t.run((ctx) => ctx.db.query("audioArtifacts").collect());
    expect(rows.every((row) => row.status === "pending")).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("blindGroups").collect())).toEqual(
      [],
    );
  });

  test("normalize:false requires a raw master", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, {
      ...baselinePlan,
      normalize: false,
    });
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const normalized = await uploadMember(t, job, 0);
    await expect(complete(t, job, [normalized])).rejects.toThrow(
      /needs a masterRaw master/,
    );
    const raw = await uploadMember(t, job, 0, {
      masterRole: "masterRaw",
      hash: "raw",
    });
    await complete(t, job, [raw]);
  });

  test("workers cannot self-certify, publish, or mint other kinds", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const base = {
      kind: "litmusRender",
      role: "delivery",
      metadataStripped: true,
      normalization: "applied",
      access: "private",
      title: "x",
      encoding: { codec: "mp3", sampleRate: 48000, channels: 2 },
      contentHash: "x",
    };
    const mint = (artifact: Record<string, unknown>) =>
      t.mutation(internal.mediaToolsInternal.generateAudioUploadUrl, {
        jobId: job.jobId as Id<"mediaJobs">,
        leaseToken: job.leaseToken,
        artifact,
      });
    await expect(mint({ ...base, validation: "validated" })).rejects.toThrow(
      /validation is assigned at job completion/,
    );
    await expect(mint({ ...base, access: "feed" })).rejects.toThrow(
      /cannot mint an artifact with access feed/,
    );
    await expect(mint({ ...base, kind: "episode" })).rejects.toThrow(
      /cannot mint a episode artifact/,
    );
  });

  test("a stale lease cannot complete after the job is re-claimed", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const stale = await claim(t);
    const member = await uploadMember(t, stale, 0);
    await t.mutation(internal.mediaJobs.sweepStale, {
      now: stale.leaseExpiresAt + 1,
    });
    const fresh = await claim(t);
    expect(fresh.attempts).toBe(1);
    await expect(complete(t, stale, [member])).rejects.toThrow(
      /lease does not match/,
    );
  });

  test("repeated failures park the job and record an operation failure", async () => {
    const t = convexTest(schema, modules);
    const recipeId = await insertRecipe(t, baselinePlan);
    const { jobId } = await t.mutation(internal.renders.requestInternal, {
      recipeId,
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const job = await claim(t);
      await t.mutation(internal.mediaJobs.fail, {
        jobId: job.jobId as Id<"mediaJobs">,
        leaseToken: job.leaseToken,
        error: "scsynth exited 1",
      });
    }
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("parked");
    // The parked job stays for operator review; a fresh request of the same
    // revision is admitted, as dedupe only covers queued, claimed, and done.
    const again = await t.mutation(internal.renders.requestInternal, {
      recipeId,
    });
    expect(again.created).toBe(true);
  });

  test("a deleted recipe still completes without a composition", async () => {
    const t = convexTest(schema, modules);
    await setGate(t, "go");
    const recipeId = await insertRecipe(t, baselinePlan);
    await t.mutation(internal.renders.requestInternal, { recipeId });
    const job = await claim(t);
    const member = await uploadMember(t, job, 0);
    await t.run((ctx) => ctx.db.delete(recipeId));
    await complete(t, job, [member]);
    expect(
      await t.run((ctx) => ctx.db.query("compositions").collect()),
    ).toEqual([]);
    expect(
      (await t.run((ctx) => ctx.db.get(member.delivery.artifactId)))?.title,
    ).toBe("Deleted recipe — litmus render");
  });
});
