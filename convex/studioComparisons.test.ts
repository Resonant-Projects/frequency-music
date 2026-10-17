import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { mp3Fixture, sha256Hex } from "../harness/fixtures/mp3";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  type ClaimedMediaJob,
  RENDERER_VERSION_FOR_JOBS,
} from "./shared/mediaJobs";
import { MAX_UPLOAD_BYTES } from "./shared/uploadLimits";

type T = ReturnType<typeof convexTest>;

const plan = {
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

// 84 frames of 1152 samples at 48 kHz is 2.016 s, inside the tolerance.
const MACHINE_MP3 = mp3Fixture({ frames: 84, fill: 0x11 });
const STUDIO_MP3 = mp3Fixture({ frames: 84, fill: 0x22 });

const provenance = {
  daw: "Bitwig 5.2",
  instrument: "u-he Diva, Init patch",
  tuningMethod: "mts-esp" as const,
  effects: "none",
  tunerCheck: "key 60 at 432.0 Hz",
  integratedLufs: -18.1,
  truePeakDbtp: -2.3,
};

const keith = (t: T) => t.withIdentity({ subject: "keith" });
const service = (t: T) => t.withIdentity({ subject: "system" });

async function insertRecipe(t: T, renderPlan: unknown) {
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
      renderPlan: renderPlan as never,
    });
  });
}

/** A machine litmus render through the real job lifecycle: request, claim,
 * mint, upload, attach, complete. Returns each member's master and delivery. */
async function machineRender(
  t: T,
  renderPlan: unknown = plan,
  bytes: (member: number) => Uint8Array = () => MACHINE_MP3,
) {
  const recipeId = await insertRecipe(t, renderPlan);
  const { jobId } = await t.mutation(internal.renders.requestInternal, {
    recipeId,
  });
  const job = (await t.mutation(internal.mediaJobs.claimNext, {
    workerId: "worker",
    kinds: ["litmusRender"],
    rendererVersion: RENDERER_VERSION_FOR_JOBS,
  })) as ClaimedMediaJob;
  const count =
    1 +
    ((renderPlan as typeof plan & { variable?: { variants: unknown[] } })
      .variable?.variants.length ?? 0);
  const members = [];
  const ids = [];
  for (let member = 0; member < count; member++) {
    const mint = async (
      artifact: Record<string, unknown>,
      body: Uint8Array,
    ) => {
      const { artifactId } = await t.mutation(
        internal.mediaToolsInternal.generateAudioUploadUrl,
        {
          jobId,
          leaseToken: job.leaseToken,
          artifact,
        },
      );
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([body as Uint8Array<ArrayBuffer>])),
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
    const masterId = await mint(
      {
        ...base,
        role: (renderPlan as { normalize: boolean }).normalize
          ? "masterNormalized"
          : "masterRaw",
        encoding: { codec: "wav", sampleRate: 48000, channels: 2 },
        contentHash: `master-${member}`,
      },
      new TextEncoder().encode(`wav-${member}`),
    );
    const deliveryId = await mint(
      {
        ...base,
        role: "delivery",
        masterArtifactId: masterId,
        encoding: {
          codec: "mp3",
          bitrateKbps: 256,
          sampleRate: 48000,
          channels: 2,
        },
        contentHash: `delivery-${member}`,
      },
      bytes(member),
    );
    const measured = (artifactId: Id<"audioArtifacts">, mimeType: string) => ({
      artifactId,
      durationSecs: 2,
      loudnessLufs: -18,
      truePeakDbtp: -2,
      mimeType,
    });
    members.push({
      member,
      master: measured(masterId, "audio/wav"),
      delivery: measured(deliveryId, "audio/mpeg"),
    });
    ids.push({ masterId, deliveryId });
  }
  await t.mutation(internal.mediaJobs.complete, {
    jobId,
    leaseToken: job.leaseToken,
    result: { kind: "litmusRender", members },
  });
  return { recipeId, jobId, ...ids[0]!, members: ids };
}

async function stored(t: T, bytes: Uint8Array): Promise<Id<"_storage">> {
  return await t.run((ctx) =>
    ctx.storage.store(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "audio/mpeg" }),
    ),
  );
}

async function begin(
  t: T,
  machineArtifactId: Id<"audioArtifacts">,
  bytes: Uint8Array,
  overrides: Record<string, unknown> = {},
  as = keith(t),
) {
  return await as.mutation(api.studioComparisons.beginUpload, {
    machineArtifactId,
    byteLength: bytes.length,
    sha256: await sha256Hex(bytes),
    renderPlan: plan,
    provenance,
    ...overrides,
  });
}

/** begin, upload, finish: what the web client does. */
async function uploadStudio(
  t: T,
  machineArtifactId: Id<"audioArtifacts">,
  bytes = STUDIO_MP3,
) {
  const started = await begin(t, machineArtifactId, bytes);
  const storageId = await stored(t, bytes);
  const finished = await keith(t).action(api.studioComparisons.finishUpload, {
    artifactId: started.artifactId,
    storageId,
  });
  return { ...started, ...finished, storageId };
}

const fullScores = (value: number) => ({
  overall: value,
  bodilyPleasantness: value,
  goosebumps: value,
  perceivedConsonance: value,
  musicality: value,
  easeOfComposability: value,
  expandability: value,
});

async function rateAll(t: T, groupId: Id<"blindGroups">, base = 3) {
  const projection = await t.query(internal.blindGroups.projectionInternal, {
    groupId,
  });
  return await keith(t).mutation(api.studioComparisons.submitRatings, {
    groupId,
    conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
    members: projection.members.map((member, index) => ({
      memberId: member.memberId,
      scores: fullScores(base + index),
      notes: `notes ${member.label}`,
    })),
  });
}

describe("studio comparison upload", () => {
  test("a human studio upload pairs blind with a fresh copy of the machine delivery", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const { groupId, replayed, artifactId } = await uploadStudio(
      t,
      machine.deliveryId,
    );
    expect(replayed).toBe(false);
    const state = await t.run(async (ctx) => {
      const group = (await ctx.db.get(groupId))!;
      const rows = await Promise.all(
        group.members.map((member) => ctx.db.get(member.artifactId)),
      );
      return {
        group,
        rows,
        studio: (await ctx.db.get(artifactId))!,
        original: (await ctx.db.get(machine.deliveryId))!,
        master: (await ctx.db.get(machine.masterId))!,
        user: await ctx.db
          .query("users")
          .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", "keith"))
          .unique(),
        compositions: await ctx.db.query("compositions").collect(),
        sessions: await ctx.db.query("listeningSessions").collect(),
        gate: await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", "renderValidation"))
          .unique(),
      };
    });
    expect(state.group.purpose).toBe("studioComparison");
    expect(state.group.members.map((m) => m.label).toSorted()).toEqual([
      "A",
      "B",
    ]);
    expect(state.group.requiredRatings).toHaveLength(2);
    expect(state.group.xMember).toBeUndefined();
    const copy = state.rows.find((row) => row!._id !== artifactId)!;
    expect(state.studio).toMatchObject({
      status: "ready",
      kind: "litmusRender",
      role: "delivery",
      metadataStripped: true,
      validation: "unvalidated",
      access: "private",
      blindGroupId: groupId,
      createdBy: state.user!._id,
      mimeType: "audio/mpeg",
      durationSecs: 2.016,
      contentHash: `sha256:${await sha256Hex(STUDIO_MP3)}`,
      refs: { recipeId: machine.recipeId },
      engine: {
        name: "human-studio",
        version: "1",
        params: {
          recipeId: machine.recipeId,
          machineArtifactId: machine.deliveryId,
          machineJobId: machine.jobId,
          planDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
          uploadedBy: state.user!._id,
          declared: provenance,
        },
      },
    });
    // The copy has the machine's audio under a storage id never served before.
    expect(copy.storageId).not.toBe(state.original.storageId);
    const [copyBlob, originalBlob] = await t.run(async (ctx) => [
      await ctx.db.system.get(copy.storageId!),
      await ctx.db.system.get(state.original.storageId!),
    ]);
    expect(copyBlob!.sha256).toBe(originalBlob!.sha256);
    expect(copy).toMatchObject({
      status: "ready",
      validation: "unvalidated",
      masterArtifactId: machine.masterId,
      metadataStripped: true,
      refs: {},
      blindGroupId: groupId,
      engine: {
        name: "sc-litmus",
        params: { comparisonCopyOf: machine.deliveryId },
      },
    });
    // The original and its master carry the group without being members.
    expect(state.original.blindGroupId).toBe(groupId);
    expect(state.master.blindGroupId).toBe(groupId);
    // Gate isolation: nothing becomes evidence and the gate is untouched.
    expect(state.compositions).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.gate).toBeNull();
  });

  test("nothing identifies a member before reveal on any surface", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const { groupId, artifactId } = await uploadStudio(t, machine.deliveryId);
    const projection = await keith(t).query(api.blindGroups.projection, {
      groupId,
    });
    expect(projection.labels).toBeUndefined();
    for (const member of projection.members)
      expect(Object.keys(member).toSorted()).toEqual([
        "label",
        "memberId",
        "playbackUrl",
      ]);
    const text = JSON.stringify(projection.members);
    expect(text).not.toMatch(/studio|machine|sc-litmus|Diva|Nineteen/i);
    const group = await t.run(async (ctx) => (await ctx.db.get(groupId))!);
    for (const id of [
      artifactId,
      machine.deliveryId,
      machine.masterId,
      ...group.members.map((m) => m.artifactId),
    ])
      expect(
        await keith(t).query(api.audioArtifacts.playback, { artifactId: id }),
      ).toBeNull();
    expect(
      await keith(t).query(api.audioArtifacts.listReadyForTarget, {
        target: { kind: "recipe", id: machine.recipeId },
      }),
    ).toEqual([]);
    expect(await keith(t).query(api.audioFeedback.queue, {})).toEqual([]);
    for (const id of [artifactId, machine.deliveryId])
      expect(
        await keith(t).query(api.audioFeedback.item, { artifactId: id }),
      ).toBeNull();
    const detail = await keith(t).query(api.studioComparisons.get, {
      groupId,
    });
    expect(detail).toEqual({
      groupId,
      createdAt: group.createdAt,
      recipeTitle: "Nineteen",
      revealed: false,
      reveal: null,
    });
    expect(await keith(t).query(api.studioComparisons.list, {})).toEqual([
      {
        groupId,
        createdAt: group.createdAt,
        revealed: false,
        recipeTitle: "Nineteen",
      },
    ]);
    // A comparison is neither a shootout nor rateable as one.
    expect(await keith(t).query(api.listen.shootouts, {})).toEqual([]);
    await expect(
      keith(t).mutation(api.voiceRatings.submit, {
        groupId,
        memberId: projection.members[0]!.memberId,
        ratings: {
          naturalness: 3,
          prosody: 3,
          clean: 3,
          clarity: 3,
          overall: 3,
        },
      }),
    ).rejects.toThrow(/voice shootout groups/);
    // The machine candidate is consumed.
    expect(
      await keith(t).query(api.studioComparisons.machineCandidates, {}),
    ).toEqual([]);
  });

  test("ratings land on both members at once and reveal with provenance", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const { groupId, artifactId } = await uploadStudio(t, machine.deliveryId);
    expect(await rateAll(t, groupId)).toEqual({ replayed: false });
    // An identical resubmission is a replay; a changed one is refused.
    expect(await rateAll(t, groupId)).toEqual({ replayed: true });
    await expect(rateAll(t, groupId, 1)).rejects.toThrow(
      /already rated and revealed/,
    );
    const ratings = await t.run((ctx) =>
      ctx.db.query("audioRatings").collect(),
    );
    expect(ratings).toHaveLength(2);
    for (const rating of ratings)
      expect(rating).toMatchObject({
        artifactKind: "litmusRender",
        artifactValidation: "unvalidated",
        conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
        source: "web",
        requestKey: expect.stringMatching(/^studioComparison:/),
      });
    const detail = await keith(t).query(api.studioComparisons.get, {
      groupId,
    });
    expect(detail.revealed).toBe(true);
    const reveal = detail.reveal!;
    expect(reveal).toMatchObject({
      recipeId: machine.recipeId,
      planDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      studioSha256: await sha256Hex(STUDIO_MP3),
      declared: provenance,
      conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
    });
    expect(reveal.members.map((m) => m.label)).toEqual(["A", "B"]);
    const studio = reveal.members.find((m) => m.source === "studio")!;
    const copy = reveal.members.find((m) => m.source === "machine")!;
    expect(studio).toMatchObject({
      artifactId,
      originalArtifactId: artifactId,
      engineName: "human-studio",
    });
    expect(copy).toMatchObject({
      originalArtifactId: machine.deliveryId,
      engineName: "sc-litmus",
    });
    expect(studio.rating?.scores.musicality).toBeTypeOf("number");
    // Revealed: the original and the studio render list on the recipe again;
    // the copy stays off it. The comparison created no compositions.
    const listed = await keith(t).query(api.audioArtifacts.listReadyForTarget, {
      target: { kind: "recipe", id: machine.recipeId },
    });
    expect(listed.map((row) => row.artifactId).toSorted()).toEqual(
      [artifactId, machine.deliveryId].toSorted(),
    );
    expect(
      await keith(t).query(api.audioArtifacts.playback, {
        artifactId: machine.deliveryId,
      }),
    ).not.toBeNull();
    const after = await t.run(async (ctx) => ({
      compositions: await ctx.db.query("compositions").collect(),
      sessions: await ctx.db.query("listeningSessions").collect(),
    }));
    expect(after).toEqual({ compositions: [], sessions: [] });
  });

  test("the docket and rating queue hide the comparison, then count both members rated", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const debt = async () =>
      (await t.query(internal.docket.currentState, {})).map(
        (card) => `${card.kind}:${card.targetId}`,
      );
    const queued = async () =>
      (await keith(t).query(api.audioFeedback.queue, {})).map(
        (item) => item.artifactId,
      );
    const recipeDebt = `recipeNoComposition:${machine.recipeId}`;
    const originalDebt = `unratedAudio:${machine.deliveryId}`;
    // Before any comparison the machine delivery is ordinary listening debt.
    expect((await debt()).toSorted()).toEqual(
      [recipeDebt, originalDebt].toSorted(),
    );
    expect(await queued()).toEqual([machine.deliveryId]);

    const { groupId, artifactId } = await uploadStudio(t, machine.deliveryId);
    const group = await t.run(async (ctx) => (await ctx.db.get(groupId))!);
    const members = group.members.map((member) => member.artifactId);
    expect(members).toContain(artifactId);
    // Blind: no member, nor the original it copies, is debt or rateable.
    expect(await debt()).toEqual([recipeDebt]);
    expect(await queued()).toEqual([]);
    for (const id of [...members, machine.deliveryId])
      expect(
        await keith(t).query(api.audioFeedback.forArtifact, { artifactId: id }),
      ).toEqual([]);

    await rateAll(t, groupId);
    // Revealed: both members carry a human rating of their current content,
    // so neither becomes debt. The original was never rated itself and is
    // its own debt again. The recipe still has no composition.
    expect((await debt()).toSorted()).toEqual(
      [recipeDebt, originalDebt].toSorted(),
    );
    expect(await queued()).toEqual([machine.deliveryId]);
    for (const id of members) {
      const ratings = await keith(t).query(api.audioFeedback.forArtifact, {
        artifactId: id,
      });
      expect(ratings).toHaveLength(1);
      expect(ratings[0]!.current).toBe(true);
    }
    expect(
      await t.run(async (ctx) => ({
        compositions: await ctx.db.query("compositions").collect(),
        sessions: await ctx.db.query("listeningSessions").collect(),
        gate: await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", "renderValidation"))
          .unique(),
      })),
    ).toEqual({ compositions: [], sessions: [], gate: null });
  });

  test("ratings need every member, the six render scales and conditions", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const { groupId } = await uploadStudio(t, machine.deliveryId);
    const projection = await t.query(internal.blindGroups.projectionInternal, {
      groupId,
    });
    const [a, b] = projection.members;
    const submit = (members: unknown[], as = keith(t)) =>
      as.mutation(api.studioComparisons.submitRatings, {
        groupId,
        conditions: { listeningMethod: "monitors", timeOfDay: "morning" },
        members: members as never,
      });
    await expect(
      submit([{ memberId: a!.memberId, scores: fullScores(3) }]),
    ).rejects.toThrow(/every member/);
    await expect(
      submit([
        { memberId: a!.memberId, scores: fullScores(3) },
        { memberId: a!.memberId, scores: fullScores(3) },
      ]),
    ).rejects.toThrow(/every member/);
    const { goosebumps: _skip, ...partial } = fullScores(3);
    await expect(
      submit([
        { memberId: a!.memberId, scores: fullScores(3) },
        { memberId: b!.memberId, scores: partial },
      ]),
    ).rejects.toThrow(/missing goosebumps/);
    await expect(
      submit([
        { memberId: a!.memberId, scores: fullScores(3) },
        { memberId: b!.memberId, scores: { ...fullScores(3), pacing: 2 } },
      ]),
    ).rejects.toThrow(/pacing/);
    await expect(
      submit([
        { memberId: a!.memberId, scores: fullScores(3) },
        { memberId: b!.memberId, scores: fullScores(6) },
      ]),
    ).rejects.toThrow(/Invalid rating/);
    const complete = [
      { memberId: a!.memberId, scores: fullScores(3) },
      { memberId: b!.memberId, scores: fullScores(4) },
    ];
    await expect(submit(complete, service(t))).rejects.toThrow(
      /Human authentication required/,
    );
    await expect(
      t.mutation(api.studioComparisons.submitRatings, {
        groupId,
        conditions: { listeningMethod: "monitors", timeOfDay: "morning" },
        members: complete,
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("audioRatings").collect()),
    ).toEqual([]);
    expect(
      (await t.run((ctx) => ctx.db.get(groupId)))!.revealedAt,
    ).toBeUndefined();
  });
});

describe("studio upload admission", () => {
  test("only a signed-in human may upload, finish or read comparisons", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    await expect(
      begin(t, machine.deliveryId, STUDIO_MP3, {}, service(t)),
    ).rejects.toThrow(/Human authentication required/);
    await expect(
      t.mutation(api.studioComparisons.beginUpload, {
        machineArtifactId: machine.deliveryId,
        byteLength: STUDIO_MP3.length,
        sha256: await sha256Hex(STUDIO_MP3),
        renderPlan: plan,
        provenance,
      }),
    ).rejects.toThrow();
    const started = await begin(t, machine.deliveryId, STUDIO_MP3);
    const storageId = await stored(t, STUDIO_MP3);
    await expect(
      service(t).action(api.studioComparisons.finishUpload, {
        artifactId: started.artifactId,
        storageId,
      }),
    ).rejects.toThrow(/Human authentication required/);
    // Another person cannot finish someone else's upload.
    await t.run((ctx) =>
      ctx.db.insert("users", {
        clerkUserId: "someone-else",
        role: "collaborator",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      t
        .withIdentity({ subject: "someone-else" })
        .action(api.studioComparisons.finishUpload, {
          artifactId: started.artifactId,
          storageId,
        }),
    ).rejects.toThrow(/Studio upload not found/);
    for (const read of [
      () => service(t).query(api.studioComparisons.list, {}),
      () => service(t).query(api.studioComparisons.machineCandidates, {}),
    ])
      await expect(read()).rejects.toThrow(/Human authentication required/);
  });

  test("bounds, digest and declaration are checked before any state exists", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const sha256 = await sha256Hex(STUDIO_MP3);
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ byteLength: MAX_UPLOAD_BYTES + 1 }, /between 1 byte and 95 MB/],
      [{ byteLength: 0 }, /between 1 byte/],
      [{ byteLength: 1.5 }, /between 1 byte/],
      // Three seconds of 256 kbps plus a frame bounds a 2 s plan.
      [{ byteLength: 200_000 }, /at most 98048 bytes/],
      [{ sha256: "abc" }, /64 hex/],
      [
        { provenance: { ...provenance, integratedLufs: -14 } },
        /integratedLufs must be -18 LUFS/,
      ],
      [
        { provenance: { ...provenance, truePeakDbtp: -0.2 } },
        /truePeakDbtp must be at most -1/,
      ],
      [
        { provenance: { ...provenance, instrument: "  " } },
        /instrument is required/,
      ],
      [
        { renderPlan: { ...plan, durationSecs: 3 } },
        /differs from the plan this machine render used/,
      ],
      [
        { renderPlan: { ...plan, tuning: { kind: "edo", divisions: 12 } } },
        /differs from the plan/,
      ],
      [{ renderPlan: { nonsense: true } }, /not a valid render plan/],
    ];
    for (const [overrides, message] of cases)
      await expect(
        begin(t, machine.deliveryId, STUDIO_MP3, { sha256, ...overrides }),
      ).rejects.toThrow(message);
    const studioRows = await t.run(async (ctx) =>
      (await ctx.db.query("audioArtifacts").collect()).filter(
        (row) => row.engine?.name === "human-studio",
      ),
    );
    expect(studioRows).toEqual([]);
  });

  test("only a finished single-baseline machine delivery can be compared", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    // A master, or an artifact claiming sc-litmus without a job, is refused.
    await expect(begin(t, machine.masterId, STUDIO_MP3)).rejects.toThrow(
      /ready machine litmus render delivery/,
    );
    const forged = await t.run(async (ctx) => {
      const original = (await ctx.db.get(machine.deliveryId))!;
      const { _id, _creationTime, ...fields } = original;
      return await ctx.db.insert("audioArtifacts", {
        ...fields,
        refs: { recipeId: machine.recipeId },
        contentHash: "forged",
      });
    });
    await expect(begin(t, forged, STUDIO_MP3)).rejects.toThrow(
      /no finished litmus job/,
    );
    // A study family member (after go) is never this path's input.
    await t.mutation(internal.settings.set, {
      key: "renderValidation",
      value: "go",
    });
    const family = await machineRender(
      t,
      { ...plan, variable: { kind: "referenceHz", variants: [440] } },
      (member) => mp3Fixture({ frames: 84, fill: 0x30 + member }),
    );
    await expect(begin(t, family.deliveryId, STUDIO_MP3)).rejects.toThrow(
      /already in a blind comparison|single baseline/,
    );
  });

  test("a render that keeps its level is not compared against the loudness policy", async () => {
    const t = convexTest(schema, modules);
    const raw = { ...plan, normalize: false };
    const machine = await machineRender(t, raw);
    await expect(
      begin(t, machine.deliveryId, STUDIO_MP3, { renderPlan: raw }),
    ).rejects.toThrow(/Only a loudness-normalized render/);
    expect(
      await keith(t).query(api.studioComparisons.machineCandidates, {}),
    ).toEqual([]);
  });

  test("candidates list eligible machine baselines only", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const candidates = await keith(t).query(
      api.studioComparisons.machineCandidates,
      {},
    );
    expect(candidates).toEqual([
      {
        artifactId: machine.deliveryId,
        recipeId: machine.recipeId,
        recipeTitle: "Nineteen",
        recipeUpdatedAt: 1,
        rendererVersion: RENDERER_VERSION_FOR_JOBS,
        durationSecs: 2,
        planDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
        createdAt: expect.any(Number),
      },
    ]);
  });
});

describe("studio upload content", () => {
  async function rejected(
    t: T,
    machineArtifactId: Id<"audioArtifacts">,
    bytes: Uint8Array,
    message: RegExp,
  ) {
    const started = await begin(t, machineArtifactId, bytes);
    const storageId = await stored(t, bytes);
    await expect(
      keith(t).action(api.studioComparisons.finishUpload, {
        artifactId: started.artifactId,
        storageId,
      }),
    ).rejects.toThrow(message);
    return await t.run(async (ctx) => ({
      row: (await ctx.db.get(started.artifactId))!,
      blob: await ctx.db.system.get(storageId),
      groups: await ctx.db.query("blindGroups").collect(),
    }));
  }

  test.each([
    [
      "an ID3 tag",
      mp3Fixture({
        frames: 84,
        fill: 0x22,
        prefix: new TextEncoder().encode("ID3\u0004\0\0\0\0\0\0"),
      }),
      /ID3 tag/,
    ],
    [
      "another bitrate",
      mp3Fixture({ frames: 168, fill: 0x22, bitrateKbps: 128 }),
      /must match the machine delivery's encoding/,
    ],
    [
      "another encoder header",
      mp3Fixture({ frames: 84, fill: 0x22, info: { encoder: "LAME3.100" } }),
      /same encoder header/,
    ],
    [
      "the wrong length",
      mp3Fixture({ frames: 70, fill: 0x22 }),
      /lasts 1\.680 s; the plan asks for 2 s/,
    ],
    ["the machine render itself", MACHINE_MP3, /is the machine render/],
    [
      // Same frame count, 100 samples shorter: a player would show it.
      "a different decoded length",
      mp3Fixture({
        frames: 84,
        fill: 0x22,
        info: { encoder: "Lavf lame", padding: 676 },
      }),
      /decodes to 95516 samples; the machine render has 95616/,
    ],
  ])(
    "refuses %s, deletes the bytes and marks the row failed",
    async (_name, bytes, message) => {
      const t = convexTest(schema, modules);
      const machine = await machineRender(t);
      const { row, blob, groups } = await rejected(
        t,
        machine.deliveryId,
        bytes,
        message,
      );
      expect(row.status).toBe("failed");
      expect(row.error).toMatch(message);
      expect(row.storageId).toBeUndefined();
      expect(blob).toBeNull();
      expect(groups).toEqual([]);
      const original = await t.run((ctx) => ctx.db.get(machine.deliveryId));
      expect(original!.blindGroupId).toBeUndefined();
    },
  );

  test("bytes that differ from the declaration are refused and left alone", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const started = await begin(t, machine.deliveryId, STUDIO_MP3);
    // Someone else's blob, or a different file than declared.
    const other = await stored(t, mp3Fixture({ frames: 84, fill: 0x77 }));
    await expect(
      keith(t).action(api.studioComparisons.finishUpload, {
        artifactId: started.artifactId,
        storageId: other,
      }),
    ).rejects.toThrow(/does not match the declared size and SHA-256/);
    const state = await t.run(async (ctx) => ({
      row: (await ctx.db.get(started.artifactId))!,
      blob: await ctx.db.system.get(other),
    }));
    expect(state.row.status).toBe("pending");
    expect(state.blob).not.toBeNull();
    // A blob another artifact already holds is never claimed either.
    const original = await t.run(
      async (ctx) => (await ctx.db.get(machine.deliveryId))!.storageId!,
    );
    await expect(
      keith(t).action(api.studioComparisons.finishUpload, {
        artifactId: started.artifactId,
        storageId: original,
      }),
    ).rejects.toThrow(/does not match/);
  });
});

describe("studio upload replay and races", () => {
  test("begin and finish are idempotent; a second comparison of one render is refused", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const first = await begin(t, machine.deliveryId, STUDIO_MP3);
    const again = await begin(t, machine.deliveryId, STUDIO_MP3);
    expect(again.artifactId).toBe(first.artifactId);
    expect(again.uploadUrl).toEqual(expect.any(String));
    const storageId = await stored(t, STUDIO_MP3);
    const finish = () =>
      keith(t).action(api.studioComparisons.finishUpload, {
        artifactId: first.artifactId,
        storageId,
      });
    const done = await finish();
    expect(await finish()).toEqual({ groupId: done.groupId, replayed: true });
    expect(await begin(t, machine.deliveryId, STUDIO_MP3)).toEqual({
      artifactId: first.artifactId,
      uploadUrl: null,
      groupId: done.groupId,
    });
    await expect(
      begin(t, machine.deliveryId, mp3Fixture({ frames: 84, fill: 0x44 })),
    ).rejects.toThrow(/already in a blind comparison/);
    // The same file cannot be declared for a different machine render.
    const second = await machineRender(t, plan, () =>
      mp3Fixture({ frames: 84, fill: 0x12 }),
    );
    await expect(begin(t, second.deliveryId, STUDIO_MP3)).rejects.toThrow(
      /already uploaded/,
    );
    const groups = await t.run((ctx) => ctx.db.query("blindGroups").collect());
    expect(groups).toHaveLength(1);
  });

  test("a replay must repeat its declaration", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const first = await begin(t, machine.deliveryId, STUDIO_MP3);
    for (const overrides of [
      { provenance: { ...provenance, instrument: "Zebra 2" } },
      { provenance: { ...provenance, notes: "added later" } },
      { byteLength: STUDIO_MP3.length - 1 },
    ])
      await expect(
        begin(t, machine.deliveryId, STUDIO_MP3, overrides),
      ).rejects.toThrow(/already declared with a different/);
    // Whitespace the server trims is not a different declaration.
    const again = await begin(t, machine.deliveryId, STUDIO_MP3, {
      provenance: { ...provenance, daw: ` ${provenance.daw} ` },
    });
    expect(again.artifactId).toBe(first.artifactId);
    const rows = await t.run(async (ctx) =>
      (await ctx.db.query("audioArtifacts").collect()).filter(
        (row) => row.engine?.name === "human-studio",
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.engine!.params.declared).toEqual(provenance);
  });

  test("presentation order and labels are independent of which member is the studio render", async () => {
    const t = convexTest(schema, modules);
    const firstIsStudio = new Set<boolean>();
    const studioLabel = new Set<string>();
    for (let index = 0; index < 16; index++) {
      const machine = await machineRender(t, plan, () =>
        mp3Fixture({ frames: 84, fill: 0x80 + index }),
      );
      const studio = mp3Fixture({ frames: 84, fill: 0x20 + index });
      const { groupId, artifactId } = await uploadStudio(
        t,
        machine.deliveryId,
        studio,
      );
      const group = await t.run(async (ctx) => (await ctx.db.get(groupId))!);
      // Stored, and therefore projected, in random memberId order.
      expect(group.members.map((m) => m.memberId)).toEqual(
        group.members.map((m) => m.memberId).toSorted(),
      );
      firstIsStudio.add(group.members[0]!.artifactId === artifactId);
      studioLabel.add(
        group.members.find((m) => m.artifactId === artifactId)!.label,
      );
    }
    expect(firstIsStudio).toEqual(new Set([true, false]));
    expect(studioLabel).toEqual(new Set(["A", "B"]));
  });

  test("two uploads racing for one machine render: the loser is failed and cleaned up", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const loserBytes = mp3Fixture({ frames: 84, fill: 0x66 });
    const winner = await begin(t, machine.deliveryId, STUDIO_MP3);
    const loser = await begin(t, machine.deliveryId, loserBytes);
    const winnerBlob = await stored(t, STUDIO_MP3);
    const loserBlob = await stored(t, loserBytes);
    await keith(t).action(api.studioComparisons.finishUpload, {
      artifactId: winner.artifactId,
      storageId: winnerBlob,
    });
    await expect(
      keith(t).action(api.studioComparisons.finishUpload, {
        artifactId: loser.artifactId,
        storageId: loserBlob,
      }),
    ).rejects.toThrow(/already in a blind comparison/);
    const state = await t.run(async (ctx) => ({
      loser: (await ctx.db.get(loser.artifactId))!,
      loserBlob: await ctx.db.system.get(loserBlob),
      blobs: await ctx.db.system.query("_storage").collect(),
      artifacts: await ctx.db.query("audioArtifacts").collect(),
    }));
    expect(state.loser.status).toBe("failed");
    expect(state.loserBlob).toBeNull();
    // Every remaining blob is owned by an artifact: no orphaned copy.
    const owned = new Set(state.artifacts.map((row) => row.storageId));
    for (const blob of state.blobs) expect(owned.has(blob._id)).toBe(true);
  });

  test("the sweeper keeps comparison audio and the gate stays closed to families", async () => {
    const t = convexTest(schema, modules);
    const machine = await machineRender(t);
    const { groupId } = await uploadStudio(t, machine.deliveryId);
    await rateAll(t, groupId);
    const before = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    await t.mutation(internal.mediaSweeper.sweep, {
      now: Date.now() + 1_000,
      blobAgeMs: 0,
      orphanAgeMs: 0,
    });
    const after = await t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(after.map((blob) => blob._id).toSorted()).toEqual(
      before.map((blob) => blob._id).toSorted(),
    );
    // A revealed comparison is not a go decision.
    const familyRecipe = await insertRecipe(t, {
      ...plan,
      variable: { kind: "referenceHz", variants: [440] },
    });
    await expect(
      t.mutation(internal.renders.requestInternal, { recipeId: familyRecipe }),
    ).rejects.toThrow(/require renderValidation=go/);
    expect(await keith(t).query(api.renders.validationGate, {})).toBe(
      "unvalidated",
    );
  });
});
