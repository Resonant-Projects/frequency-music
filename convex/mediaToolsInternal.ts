// Lease-fenced wrappers that the media tools call. Upload URLs are minted here
// so a pending artifact row always exists before bytes are uploaded.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { requireLease } from "./mediaJobs";
import { audioArtifactInputZ } from "./shared/audioArtifacts";

export const generateAudioUploadUrl = internalMutation({
  args: { jobId: v.id("mediaJobs"), leaseToken: v.string(), artifact: v.any() },
  returns: v.object({
    artifactId: v.id("audioArtifacts"),
    uploadUrl: v.string(),
  }),
  // Explicit return type breaks the api.d.ts <-> internal.* inference cycle.
  handler: async (
    ctx,
    args,
  ): Promise<{ artifactId: Id<"audioArtifacts">; uploadUrl: string }> => {
    requireLease(await ctx.db.get(args.jobId), args.leaseToken, Date.now());
    // storageId is lifecycle-owned: a caller-supplied id would leave a pending
    // row pointing at a blob it never uploaded, which the sweeper then deletes.
    if (args.artifact?.storageId !== undefined) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "storageId is assigned by attachAudioStorage",
      });
    }
    // createPending stamps createdAt/updatedAt/uploadIssuedAt itself.
    const fields = audioArtifactInputZ.parse({
      ...args.artifact,
      status: "pending",
      refs: { ...args.artifact?.refs, mediaJobId: args.jobId },
    });
    const artifactId = await ctx.runMutation(
      internal.audioArtifacts.createPending,
      { fields },
    );
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { artifactId, uploadUrl };
  },
});

export const attachAudioStorage = internalMutation({
  args: {
    jobId: v.id("mediaJobs"),
    leaseToken: v.string(),
    artifactId: v.id("audioArtifacts"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireLease(await ctx.db.get(args.jobId), args.leaseToken, Date.now());
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.refs.mediaJobId !== args.jobId) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Artifact does not belong to this job",
      });
    }
    await ctx.runMutation(internal.audioArtifacts.attachStorage, {
      artifactId: args.artifactId,
      storageId: args.storageId,
    });
    return null;
  },
});
