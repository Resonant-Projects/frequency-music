// Kind-specific domain effects applied inside mediaJobs.complete. The media
// service never writes research data; everything it produces passes through
// here, validated by kind. Nothing in this file may touch listeningSessions.
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  type ArtifactResult,
  type MediaJobResult,
  spokenLabel,
} from "./shared/mediaJobs";

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

// Every array in a result goes through the fence before anything in it is
// marked ready; an artifact that fails ownership is never published.
async function ownAndReady(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  artifacts: ArtifactResult[],
): Promise<Id<"audioArtifacts">[]> {
  await ownedArtifacts(ctx, job, artifacts);
  return await readyArtifacts(ctx, artifacts);
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
      // Masters first: they are provenance, never members or feed rows.
      await ownAndReady(ctx, job, [
        ...result.takes.map((take) => take.master),
        result.episodeMaster,
      ]);
      const takeIds = await ownAndReady(
        ctx,
        job,
        result.takes.map((take) => take.artifact),
      );
      for (const take of result.takes) {
        await ctx.db.patch(take.artifact.artifactId, {
          voice: { catalogId: take.voiceId, promptVersion: "shootout.v1" },
          updatedAt: now,
        });
      }
      const [episodeRow] = await ownedArtifacts(ctx, job, [result.episode]);
      const [episodeId] = await readyArtifacts(ctx, [result.episode]);
      // The episode is the feed-published concatenation of the takes. It is
      // deliberately not a blind member and carries no blindGroupId (the feed
      // hides any row that does); it pairs with its group through the shared
      // refs.mediaJobId of this job. Only a delivery is published; a master
      // keeps the access it was uploaded with.
      if (episodeRow!.role === "delivery") {
        await ctx.db.patch(episodeId!, { access: "feed", updatedAt: now });
      }
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
