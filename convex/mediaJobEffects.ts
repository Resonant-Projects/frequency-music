// Kind-specific domain effects applied inside mediaJobs.complete. The media
// service never writes research data; everything it produces passes through
// here, validated by kind. Nothing in this file may touch listeningSessions.
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { MediaJobResult } from "./shared/mediaJobs";

async function ownedArtifacts(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  artifacts: MediaJobResult["artifacts"],
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
  artifacts: MediaJobResult["artifacts"],
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

// A probe renders a normalized master and one delivery encode of it; a result
// missing either half would leave a listener without playable bytes or the
// pipeline without its provenance chain.
function requireProbePair(rows: Doc<"audioArtifacts">[]): void {
  const master = rows.find((row) => row.role === "masterNormalized");
  const delivery = rows.find((row) => row.role === "delivery");
  if (rows.length !== 2 || !master || !delivery) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message:
        "A probe result needs one masterNormalized and one delivery artifact",
    });
  }
  if (delivery.masterArtifactId !== master._id) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "Probe delivery must reference its master",
    });
  }
}

export async function applyMediaJobResult(
  ctx: MutationCtx,
  job: Doc<"mediaJobs">,
  result: MediaJobResult,
): Promise<Id<"audioArtifacts">[]> {
  switch (result.kind) {
    case "probe":
      requireProbePair(await ownedArtifacts(ctx, job, result.artifacts));
      return await readyArtifacts(ctx, result.artifacts);
    default: {
      // Exhaustiveness guard: a new result kind must be handled above.
      const unknownKind: never = result.kind;
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: `Unknown result kind ${String(unknownKind)}`,
      });
    }
  }
}
