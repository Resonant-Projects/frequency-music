// Kind-specific domain effects applied inside mediaJobs.complete. The media
// service never writes research data; everything it produces passes through
// here, validated by kind. Nothing in this file may touch listeningSessions.
import { ConvexError } from "convex/values";
import { attachDocketNarration, markDocketStale } from "./docket";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { readSetting } from "./settings";
import {
  type ArtifactResult,
  type MediaJobResult,
  RENDER_VALIDATION_KEY,
  spokenLabel,
} from "./shared/mediaJobs";
import {
  type RenderPlanSnapshot,
  renderPlanMemberCount,
} from "./shared/renderPlan";

// Ownership fence: a result may only name artifacts minted under this job's
// lease (generateAudioUploadUrl pins refs.mediaJobId), so a worker cannot
// publish or regroup another job's audio by citing its ids.
async function ownedArtifacts(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  artifacts: ArtifactResult[],
): Promise<Doc<"audioArtifacts">[]> {
  const rows: Doc<"audioArtifacts">[] = [];
  for (const artifact of artifacts) {
    const row = await ctx.db.get(artifact.artifactId);
    if (!row || row.refs.mediaJobId !== job._id) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `Artifact ${artifact.artifactId} does not belong to job ${job._id}`,
      });
    }
    rows.push(row);
  }
  return rows;
}

async function readyArtifacts(
  ctx: MutationCtx,
  artifacts: ArtifactResult[],
): Promise<Id<"audioArtifacts">[]> {
  const ids: Id<"audioArtifacts">[] = [];
  for (const artifact of artifacts) {
    await ctx.runMutation(internal.audioArtifacts.markReady, {
      artifactId: artifact.artifactId,
      durationSecs: artifact.durationSecs,
      loudnessLufs: artifact.loudnessLufs,
      truePeakDbtp: artifact.truePeakDbtp,
      mimeType: artifact.mimeType,
    });
    ids.push(artifact.artifactId);
  }
  return ids;
}

// A render yields a normalized master and one delivery encode of it; a result
// missing either half would leave a listener without playable bytes or the
// pipeline without its provenance chain. Returns the pair so callers can
// address the delivery without guessing at result order.
function requireMasterDeliveryPair(
  rows: Doc<"audioArtifacts">[],
  kind: MediaJobResult["kind"],
): { master: Doc<"audioArtifacts">; delivery: Doc<"audioArtifacts"> } {
  const master = rows.find((row) => row.role === "masterNormalized");
  const delivery = rows.find((row) => row.role === "delivery");
  if (rows.length !== 2 || !master || !delivery) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `A ${kind} result needs one masterNormalized and one delivery artifact`,
    });
  }
  if (delivery.masterArtifactId !== master._id) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${kind} delivery must reference its master`,
    });
  }
  return { master, delivery };
}

// mediaJobs.complete already matches result.kind to job.kind; this is the
// type-level counterpart so each effect reads its own input shape.
function inputKindMismatch(
  job: Doc<"mediaJobs">,
  kind: MediaJobResult["kind"],
): ConvexError<{ code: string; message: string }> {
  return new ConvexError({
    code: "INVALID_ARGUMENT",
    message: `Job ${job._id} input is ${job.input.kind}, not ${kind}`,
  });
}

export async function applyMediaJobResult(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  result: MediaJobResult,
): Promise<Id<"audioArtifacts">[]> {
  const now = Date.now();
  await markDocketStale(ctx);
  switch (result.kind) {
    case "probe":
      requireMasterDeliveryPair(
        await ownedArtifacts(ctx, job, result.artifacts),
        result.kind,
      );
      return await readyArtifacts(ctx, result.artifacts);
    case "narrate": {
      if (job.input.kind !== "narrate") throw inputKindMismatch(job, "narrate");
      const input = job.input;
      const { master, delivery } = requireMasterDeliveryPair(
        await ownedArtifacts(ctx, job, result.artifacts),
        result.kind,
      );
      const ids = await readyArtifacts(ctx, result.artifacts);
      // Chapters live on the delivery: it is what listeners and the episode
      // assembler consume; the master is provenance only.
      await ctx.db.patch(delivery._id, {
        chapters: result.chapters,
        updatedAt: now,
      });
      await attachDocketNarration(ctx, job, delivery);
      if (input.assembleOnDone) {
        // Same mutation as the ready mark: a narration is never left ready
        // without its episode queued, and the episode job is never queued
        // for a narration that failed to land. The assembler works from the
        // lossless master so the episode is not a re-encode of an MP3; the
        // delivery is a fallback only when the master carries no blob.
        const sourceStorageId = master.storageId ?? delivery.storageId;
        const narrationStorageUrl = sourceStorageId
          ? await ctx.storage.getUrl(sourceStorageId)
          : null;
        if (!narrationStorageUrl) {
          throw new ConvexError({
            code: "INVALID_STATE",
            message:
              "narration master and delivery have no storage url; nothing for assembleEpisode to download",
          });
        }
        // R29: the episode inherits the narration's refs (its weeklyBriefId)
        // so a feed episode links back to the brief it narrates.
        await ctx.runMutation(internal.mediaJobs.enqueue, {
          input: {
            kind: "assembleEpisode",
            narrationArtifactId: delivery._id,
            narrationStorageUrl,
            title: input.episodeTitle ?? input.title,
            chapters: result.chapters,
            refs: input.refs,
            rendererVersion: input.rendererVersion,
          },
        });
      }
      return ids;
    }
    case "shootout": {
      if (job.input.kind !== "shootout")
        throw inputKindMismatch(job, "shootout");
      // Pure checks first, before any markReady sub-mutation: the blind
      // group must cover every rendered take exactly once, so a take the
      // handler forgot to list can never end up ready but ungrouped.
      const byVoice = new Map<string, Id<"audioArtifacts">>();
      for (const take of result.takes) {
        if (byVoice.has(take.voiceId)) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: `shootout rendered voice ${take.voiceId} twice`,
          });
        }
        byVoice.set(take.voiceId, take.artifact.artifactId);
      }
      // Takes and skips together must be exactly the requested voices, so a
      // completion can never publish an unrequested voice or silently drop one.
      const requested = new Set(job.input.voiceIds);
      const covered = [
        ...result.takes.map((take) => take.voiceId),
        ...result.skippedVoiceIds,
      ];
      if (
        covered.length !== requested.size ||
        new Set(covered).size !== covered.length ||
        covered.some((voiceId) => !requested.has(voiceId))
      ) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: `shootout takes and skips must cover the requested voices exactly once: requested ${[...requested].join(", ")}; got ${covered.join(", ")}`,
        });
      }
      const seen = new Set<string>();
      const members = result.memberOrder.map((voiceId, index) => {
        const artifactId = byVoice.get(voiceId);
        if (!artifactId) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: `memberOrder names unrendered voice ${voiceId}`,
          });
        }
        if (seen.has(voiceId)) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: `memberOrder repeats voice ${voiceId}`,
          });
        }
        seen.add(voiceId);
        // The handler spoke this same label for this position, so the group
        // stores exactly what the listener heard.
        return { artifactId, label: spokenLabel(index) };
      });
      // Entries are distinct and each names a take, so a short list can only
      // mean a rendered take was left out of the group.
      if (members.length !== result.takes.length) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: `memberOrder must name every take: ${members.length} entries for ${result.takes.length} takes`,
        });
      }
      // Every take and the episode is a master/delivery pair whose delivery
      // is the row the result names as such; a swapped pair would publish a
      // WAV master as a blind member or feed episode. Checked after the
      // ownership fence and before any markReady sub-mutation.
      const pairs = [
        ...result.takes.map((take) => ({
          master: take.master,
          delivery: take.artifact,
          kind: "shootoutTake" as const,
        })),
        {
          master: result.episodeMaster,
          delivery: result.episode,
          kind: "episode" as const,
        },
      ];
      for (const pair of pairs) {
        const rows = await ownedArtifacts(ctx, job, [
          pair.master,
          pair.delivery,
        ]);
        if (rows.some((row) => row.kind !== pair.kind)) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: `shootout ${pair.kind} pair holds an artifact of another kind`,
          });
        }
        const { delivery } = requireMasterDeliveryPair(rows, result.kind);
        if (delivery._id !== pair.delivery.artifactId) {
          throw new ConvexError({
            code: "INVALID_ARGUMENT",
            message: `shootout names master ${pair.delivery.artifactId} as a delivery`,
          });
        }
      }
      // Mirrors the handler's own rule: one take is not a comparison, and a
      // one-member blind group would reveal after a single rating.
      if (result.takes.length < 2) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: `a shootout needs at least two takes, got ${result.takes.length}`,
        });
      }
      // Masters first: they are provenance, never members or feed rows.
      await readyArtifacts(ctx, [
        ...result.takes.map((take) => take.master),
        result.episodeMaster,
      ]);
      const takeIds = await readyArtifacts(
        ctx,
        result.takes.map((take) => take.artifact),
      );
      for (const take of result.takes) {
        await ctx.db.patch(take.artifact.artifactId, {
          voice: { catalogId: take.voiceId, promptVersion: "shootout.v1" },
          updatedAt: now,
        });
      }
      const [episodeId] = await readyArtifacts(ctx, [result.episode]);
      // The episode is the feed-published concatenation of the takes. It is
      // deliberately not a blind member and carries no blindGroupId (the feed
      // hides any row that does); it pairs with its group through the shared
      // refs.mediaJobId of this job. It is a delivery by the check above; the
      // master keeps the access it was uploaded with.
      await ctx.db.patch(episodeId!, { access: "feed", updatedAt: now });
      await ctx.runMutation(internal.blindGroups.create, {
        purpose: "voiceShootout",
        members,
      });
      return [...takeIds, episodeId!];
    }
    case "assembleEpisode": {
      if (job.input.kind !== "assembleEpisode")
        throw inputKindMismatch(job, "assembleEpisode");
      const input = job.input;
      // A result without its delivery would complete the job with no feed
      // episode and nothing left to retry; refuse it before marking anything.
      const { delivery } = requireMasterDeliveryPair(
        await ownedArtifacts(ctx, job, result.artifacts),
        result.kind,
      );
      const ids = await readyArtifacts(ctx, result.artifacts);
      // Only the delivery becomes the feed episode; the WAV master is
      // provenance and keeps the access, title, and chapters it was
      // uploaded with. Chapters come from the result: the assembler shifts
      // them by its lead-in, so the input's narration chapters are stale.
      await ctx.db.patch(delivery._id, {
        access: "feed",
        chapters: result.chapters,
        title: input.title,
        updatedAt: now,
      });
      return ids;
    }
    case "litmusRender":
      return await applyLitmusRender(ctx, job, result, now);
    default: {
      // Exhaustiveness guard: a new result kind must be handled above.
      const unknownResult: never = result;
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `Unknown result kind ${JSON.stringify(unknownResult)}`,
      });
    }
  }
}

const STUDY_LABELS = ["A", "B", "C", "D"] as const;

function tuningLabel(tuning: RenderPlanSnapshot["tuning"]): string {
  switch (tuning.kind) {
    case "edo":
      return `${tuning.divisions}-EDO`;
    case "ji":
      return `JI ${tuning.ratios.join(" ")}`;
    case "cents":
      return `cents ${tuning.values.join(" ")}`;
    case "named":
      return tuning.name;
  }
}

// What distinguishes member `index` (0 = baseline) in a composition record.
function memberVariable(plan: RenderPlanSnapshot, index: number): string {
  const variable = plan.variable;
  const text =
    variable?.kind === "temperament"
      ? `temperament: ${tuningLabel(index === 0 ? plan.tuning : variable.variants[index - 1]!)}`
      : variable?.kind === "referenceHz"
        ? `referenceHz: ${index === 0 ? plan.referenceHz : variable.variants[index - 1]!}`
        : `baseline: ${tuningLabel(plan.tuning)} at ${plan.referenceHz} Hz`;
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

// Litmus render completion (render ladder 3.3). The worker supplies bytes and
// measurements; the server owns titles, refs, engine provenance, the
// validation stamp, blind labels, and composition linkage.
async function applyLitmusRender(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  result: Extract<MediaJobResult, { kind: "litmusRender" }>,
  now: number,
): Promise<Id<"audioArtifacts">[]> {
  if (job.input.kind !== "litmusRender")
    throw inputKindMismatch(job, "litmusRender");
  const input = job.input;
  const plan = input.renderPlan;
  const count = renderPlanMemberCount(plan);
  const members = result.members.toSorted((a, b) => a.member - b.member);
  if (
    members.length !== count ||
    members.some((member, index) => member.member !== index)
  ) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `litmusRender must return members 0..${count - 1} exactly once`,
    });
  }
  const ids = members.flatMap((member) => [
    member.master.artifactId,
    member.delivery.artifactId,
  ]);
  if (new Set(ids).size !== ids.length) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "litmusRender members must name distinct artifacts",
    });
  }
  // normalize:false keeps levels, so its master is honestly a raw master.
  const masterRole = plan.normalize ? "masterNormalized" : "masterRaw";
  for (const member of members) {
    const [master, delivery] = await ownedArtifacts(ctx, job, [
      member.master,
      member.delivery,
    ]);
    if (
      master!.kind !== "litmusRender" ||
      delivery!.kind !== "litmusRender" ||
      master!.role !== masterRole ||
      delivery!.role !== "delivery" ||
      delivery!.masterArtifactId !== master!._id
    ) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `litmusRender member ${member.member} needs a ${masterRole} master and its delivery`,
      });
    }
    if (!master!.metadataStripped || !delivery!.metadataStripped) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `litmusRender member ${member.member} is not metadata-stripped`,
      });
    }
  }
  await readyArtifacts(
    ctx,
    members.map((member) => member.master),
  );
  await readyArtifacts(
    ctx,
    members.map((member) => member.delivery),
  );
  // The gate is read at completion: a render finished before go stays
  // unvalidated even if the setting flips while it is queued.
  const validation =
    (await readSetting(ctx, RENDER_VALIDATION_KEY)) === "go"
      ? ("validated" as const)
      : ("unvalidated" as const);
  const recipe = await ctx.db.get(input.recipeId);
  const recipeTitle = recipe?.title ?? "Deleted recipe";
  // Members share one neutral title so nothing but the blind label tells
  // them apart before reveal.
  const title =
    count === 1
      ? `${recipeTitle} — litmus render`
      : `${recipeTitle} — study family member`;
  const engine = {
    name: "sc-litmus",
    version: input.rendererVersion,
    params: {
      recipeId: input.recipeId,
      recipeUpdatedAt: input.recipeUpdatedAt,
    },
  };
  for (const member of members) {
    await ctx.db.patch(member.master.artifactId, {
      title: `${title} (master)`,
      validation,
      engine,
      refs: { mediaJobId: job._id },
      updatedAt: now,
    });
    await ctx.db.patch(member.delivery.artifactId, {
      title,
      validation,
      engine,
      refs: { mediaJobId: job._id, recipeId: input.recipeId },
      updatedAt: now,
    });
  }
  if (count > 1) {
    // Random label assignment: A is not reliably the baseline.
    const shuffled = members
      .map((member) => ({ member, key: crypto.randomUUID() }))
      .toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const { groupId } = await ctx.runMutation(internal.blindGroups.create, {
      purpose: "studyFamily",
      members: shuffled.map(({ member }, index) => ({
        artifactId: member.delivery.artifactId,
        label: STUDY_LABELS[index]!,
      })),
    });
    // Masters are not rated members, but they carry the group so playback
    // and the docket hide them until the family is revealed.
    for (const member of members) {
      await ctx.db.patch(member.master.artifactId, {
        blindGroupId: groupId,
        updatedAt: now,
      });
    }
  }
  // Unvalidated renders create no compositions: they must stay out of
  // evidence, docket composition debt, loop debt, and tournament fitness.
  if (validation === "validated" && recipe) {
    let baselineId: Id<"compositions"> | undefined;
    for (const member of members) {
      const variable = memberVariable(plan, member.member);
      const compositionId: Id<"compositions"> = await ctx.db.insert(
        "compositions",
        {
          title:
            member.member === 0
              ? `${recipeTitle} — litmus baseline`
              : `${recipeTitle} — litmus variant ${member.member}`,
          recipeId: input.recipeId,
          artifactType: "microStudy",
          projectNotesMd: `Litmus render (renderer ${input.rendererVersion}) of the recipe revision saved at ${new Date(input.recipeUpdatedAt).toISOString()}. ${variable}.`,
          version: "m0.1",
          ...(baselineId
            ? { revisionParentId: baselineId, revisionVariable: variable }
            : {}),
          audioArtifactId: member.delivery.artifactId,
          status: "rendered",
          visibility: "private",
          createdBy: "system",
          createdAt: now,
          updatedAt: now,
        },
      );
      baselineId ??= compositionId;
      await ctx.db.patch(member.delivery.artifactId, {
        refs: {
          mediaJobId: job._id,
          recipeId: input.recipeId,
          compositionId,
        },
      });
    }
  }
  return ids;
}
