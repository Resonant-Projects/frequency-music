/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
// Plan 11 step 3: a human studio render rated blind against the machine
// litmus render of the same plan. A signed-in person uploads one MP3 studio
// delivery for one machine baseline; once the bytes pass inspection, one
// mutation marks it ready, adds a fresh storage copy of the machine delivery,
// groups the two as a `studioComparison`, and hides the machine original
// until reveal. Ratings use the general render scales (audioRatings), all
// members at once, and reveal in the same mutation.
//
// This path is an explicit exception to the renderValidation gate and is
// deliberately narrow: it never reads or writes the setting, stamps every
// member `unvalidated`, creates no compositions or listening sessions, and
// accepts only single-member (variable-free) machine renders, so study
// families, evidence, listening debt and tournament fitness are untouched.
// A rating does not validate a render; go or no-go stays a human decision.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireDecisionUser, requireHumanIdentity } from "./decisionIdentity";
import { markDocketStale } from "./docket";
import { MAX_UPLOAD_BYTES } from "./shared/uploadLimits";
import {
  audioRatingPayloadZ,
  audioRatingScoresValidator,
  scoreKeysOutsideKind,
} from "./shared/audioFeedback";
import {
  listeningConditionsValidator,
  stableContentDigest,
} from "./shared/decisionIntents";
import { inspectMp3, Mp3InspectionError } from "./shared/mp3Inspect";
import { admitRenderPlan, renderPlanMemberCount } from "./shared/renderPlan";
import { stableStringify } from "./shared/stableHash";
import {
  isSha256Hex,
  STUDIO_COMPARISON_LABELS,
  STUDIO_COMPARISON_PURPOSE,
  STUDIO_DURATION_TOLERANCE_SECS,
  STUDIO_ENGINE_NAME,
  STUDIO_ENGINE_VERSION,
  STUDIO_REQUIRED_SCORE_KEYS,
  STUDIO_TUNING_METHODS,
  studioContentHash,
  studioProvenanceProblems,
  studioUploadMaxBytes,
  type StudioProvenance,
} from "./shared/studioComparison";

const LIST_LIMIT = 50;
const CANDIDATE_SCAN = 200;

type LitmusInput = Extract<Doc<"mediaJobs">["input"], { kind: "litmusRender" }>;
type MachineSource = {
  delivery: Doc<"audioArtifacts">;
  master: Doc<"audioArtifacts">;
  job: Doc<"mediaJobs">;
  input: LitmusInput;
  recipe: Doc<"recipes">;
};

function refuse(
  message: string,
  code = "INVALID_STATE",
): ConvexError<{
  code: string;
  message: string;
}> {
  return new ConvexError({ code, message });
}

/** A machine delivery a studio render may be compared against: the ready,
 * private, metadata-free MP3 delivery of a finished single-member litmus job,
 * not yet in any blind group, with its master and recipe present. Origin is
 * proved by the job, not by the artifact's own claims. */
async function machineSource(
  ctx: Pick<QueryCtx, "db">,
  artifactId: Id<"audioArtifacts">,
): Promise<MachineSource> {
  const delivery = await ctx.db.get(artifactId);
  if (
    !delivery ||
    delivery.kind !== "litmusRender" ||
    delivery.role !== "delivery" ||
    delivery.status !== "ready" ||
    !delivery.storageId ||
    delivery.engine?.name !== "sc-litmus" ||
    delivery.encoding.codec !== "mp3" ||
    !delivery.metadataStripped ||
    delivery.access !== "private"
  )
    throw refuse("Choose a ready machine litmus render delivery");
  if (delivery.blindGroupId)
    throw refuse("This machine render is already in a blind comparison");
  const jobId = delivery.refs.mediaJobId;
  const job = jobId ? await ctx.db.get(jobId) : null;
  if (
    !job ||
    job.kind !== "litmusRender" ||
    job.input.kind !== "litmusRender" ||
    job.status !== "done" ||
    !job.resultArtifactIds?.includes(delivery._id) ||
    delivery.refs.recipeId !== job.input.recipeId
  )
    throw refuse("The machine render has no finished litmus job");
  // A study family is compared within itself after go; this path takes the
  // single baseline render only.
  if (renderPlanMemberCount(job.input.renderPlan) !== 1)
    throw refuse("Only a single baseline render can be compared");
  // The studio declaration is held to the music loudness policy, which a
  // normalize:false render deliberately does not meet.
  if (!job.input.renderPlan.normalize)
    throw refuse("Only a loudness-normalized render can be compared");
  const master = delivery.masterArtifactId
    ? await ctx.db.get(delivery.masterArtifactId)
    : null;
  if (
    !master ||
    master.refs.mediaJobId !== job._id ||
    master.status !== "ready" ||
    master.blindGroupId
  )
    throw refuse("The machine render's master is missing");
  const recipe = await ctx.db.get(job.input.recipeId);
  if (!recipe) throw refuse("The machine render's recipe no longer exists");
  return { delivery, master, job, input: job.input, recipe };
}

async function humanUser(ctx: QueryCtx): Promise<Id<"users">> {
  const identity = await requireHumanIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
    .unique();
  if (!user) throw refuse("Unknown user", "FORBIDDEN");
  return user._id;
}

type StudioParams = {
  recipeId: Id<"recipes">;
  recipeUpdatedAt: number;
  planDigest: string;
  machineArtifactId: Id<"audioArtifacts">;
  machineJobId: Id<"mediaJobs">;
  machineRendererVersion: string;
  byteLength: number;
  sha256: string;
  uploadedBy: Id<"users">;
  declared: StudioProvenance;
};

function studioParams(row: Doc<"audioArtifacts">): StudioParams | null {
  if (
    row.kind !== "litmusRender" ||
    row.role !== "delivery" ||
    row.engine?.name !== STUDIO_ENGINE_NAME
  )
    return null;
  return row.engine.params as StudioParams;
}

/** The pending studio row the caller created, or a refusal. */
async function ownStudioRow(
  ctx: Pick<QueryCtx, "db">,
  artifactId: Id<"audioArtifacts">,
  userId: Id<"users">,
): Promise<{ row: Doc<"audioArtifacts">; params: StudioParams }> {
  const row = await ctx.db.get(artifactId);
  const params = row ? studioParams(row) : null;
  if (!row || !params || row.createdBy !== userId)
    throw refuse("Studio upload not found", "NOT_FOUND");
  return { row, params };
}

function base64ToHex(value: string): string {
  return Array.from(atob(value), (char) =>
    char.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
}

/** The blob is the declared upload: present, unreferenced, and matching the
 * declared size and digest. Only then may a rejection delete it. */
async function declaredBlob(
  ctx: Pick<QueryCtx, "db">,
  storageId: Id<"_storage">,
  params: StudioParams,
): Promise<boolean> {
  const blob = await ctx.db.system.get(storageId);
  if (!blob) return false;
  if (blob.size !== params.byteLength) return false;
  if (base64ToHex(blob.sha256) !== params.sha256) return false;
  const holder = await ctx.db
    .query("audioArtifacts")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  return holder === null;
}

const provenanceValidator = v.object({
  daw: v.string(),
  instrument: v.string(),
  tuningMethod: v.union(...STUDIO_TUNING_METHODS.map((m) => v.literal(m))),
  effects: v.string(),
  tunerCheck: v.string(),
  integratedLufs: v.number(),
  truePeakDbtp: v.number(),
  notes: v.optional(v.string()),
});

const beginReturn = v.object({
  artifactId: v.id("audioArtifacts"),
  // Null when this exact file was already uploaded and grouped.
  uploadUrl: v.union(v.string(), v.null()),
  groupId: v.union(v.id("blindGroups"), v.null()),
});

/** Declare a studio render of one machine baseline and get an upload URL.
 * Bounds, the plan identity, and the declaration are checked before any
 * state exists. Repeating the same declaration returns the same row. */
export const beginUpload = mutation({
  args: {
    machineArtifactId: v.id("audioArtifacts"),
    byteLength: v.number(),
    sha256: v.string(),
    // The render-plan.json the studio render followed.
    renderPlan: v.any(),
    provenance: provenanceValidator,
  },
  returns: beginReturn,
  handler: async (ctx, args) => {
    const userId = await requireDecisionUser(ctx);
    const sha256 = args.sha256.toLowerCase();
    if (!isSha256Hex(sha256))
      throw refuse("sha256 must be 64 hex characters", "INVALID_ARGUMENT");
    if (
      !Number.isInteger(args.byteLength) ||
      args.byteLength <= 0 ||
      args.byteLength > MAX_UPLOAD_BYTES
    )
      throw refuse(
        `The file must be between 1 byte and ${MAX_UPLOAD_BYTES / 1e6} MB`,
        "INVALID_ARGUMENT",
      );
    let submitted;
    try {
      submitted = admitRenderPlan(args.renderPlan);
    } catch {
      throw refuse("The render plan file is not a valid render plan");
    }
    const declared: StudioProvenance = {
      daw: args.provenance.daw.trim(),
      instrument: args.provenance.instrument.trim(),
      tuningMethod: args.provenance.tuningMethod,
      effects: args.provenance.effects.trim(),
      tunerCheck: args.provenance.tunerCheck.trim(),
      integratedLufs: args.provenance.integratedLufs,
      truePeakDbtp: args.provenance.truePeakDbtp,
      ...(args.provenance.notes?.trim()
        ? { notes: args.provenance.notes.trim() }
        : {}),
    };
    const problems = studioProvenanceProblems(declared);
    if (problems.length) throw refuse(problems.join("; "), "INVALID_ARGUMENT");
    const contentHash = studioContentHash(sha256);
    // Replays come first: after grouping the machine render is no longer
    // eligible, but the same declaration must still answer.
    for (const row of await ctx.db
      .query("audioArtifacts")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", contentHash))
      .collect()) {
      if (row.status === "failed") continue;
      const params = studioParams(row);
      if (
        !params ||
        row.createdBy !== userId ||
        params.machineArtifactId !== args.machineArtifactId
      )
        throw refuse("This file was already uploaded");
      // A replay must repeat the declaration it replays; a corrected one
      // would otherwise report success while the first stays stored.
      if (
        params.byteLength !== args.byteLength ||
        params.planDigest !== (await stableContentDigest(submitted)) ||
        stableStringify(params.declared) !== stableStringify(declared)
      )
        throw refuse(
          "This file was already declared with a different plan, size or provenance",
        );
      if (row.status === "ready")
        return {
          artifactId: row._id,
          uploadUrl: null,
          groupId: row.blindGroupId ?? null,
        };
      return {
        artifactId: row._id,
        uploadUrl: await ctx.storage.generateUploadUrl(),
        groupId: null,
      };
    }
    const machine = await machineSource(ctx, args.machineArtifactId);
    const plan = machine.input.renderPlan;
    // Same constraints, byte for byte: the studio render must follow the
    // exact plan revision the machine rendered.
    if (stableStringify(submitted) !== stableStringify(plan))
      throw refuse(
        "The render plan differs from the plan this machine render used",
      );
    const encoding = machine.delivery.encoding;
    const maxBytes = studioUploadMaxBytes(
      plan.durationSecs,
      encoding.bitrateKbps ?? 320,
    );
    if (args.byteLength > maxBytes)
      throw refuse(
        `A ${plan.durationSecs} s delivery at ${encoding.bitrateKbps} kbps is at most ${maxBytes} bytes`,
        "INVALID_ARGUMENT",
      );
    const params: StudioParams = {
      recipeId: machine.input.recipeId,
      recipeUpdatedAt: machine.input.recipeUpdatedAt,
      planDigest: await stableContentDigest(plan),
      machineArtifactId: machine.delivery._id,
      machineJobId: machine.job._id,
      machineRendererVersion: machine.input.rendererVersion,
      byteLength: args.byteLength,
      sha256,
      uploadedBy: userId,
      declared,
    };
    const artifactId: Id<"audioArtifacts"> = await ctx.runMutation(
      internal.audioArtifacts.createPending,
      {
        fields: {
          kind: "litmusRender",
          role: "delivery",
          // Claimed only after the bytes are inspected.
          metadataStripped: false,
          status: "pending",
          encoding,
          normalization: "applied",
          access: "private",
          validation: "unvalidated",
          title: `${machine.recipe.title} — human studio render`,
          engine: {
            name: STUDIO_ENGINE_NAME,
            version: STUDIO_ENGINE_VERSION,
            params,
          },
          refs: { recipeId: machine.input.recipeId },
          contentHash,
          createdBy: userId,
        },
      },
    );
    return {
      artifactId,
      uploadUrl: await ctx.storage.generateUploadUrl(),
      groupId: null,
    };
  },
});

const finishContextReturn = v.union(
  v.object({ kind: v.literal("done"), groupId: v.id("blindGroups") }),
  // The machine render was taken by another comparison or changed.
  v.object({ kind: v.literal("unavailable"), message: v.string() }),
  v.object({
    kind: v.literal("pending"),
    durationSecs: v.number(),
    machineStorageId: v.id("_storage"),
    machineSha256: v.optional(v.string()),
    bitrateKbps: v.number(),
    sampleRate: v.number(),
    channels: v.number(),
  }),
);

export const finishContext = internalQuery({
  args: { artifactId: v.id("audioArtifacts"), storageId: v.id("_storage") },
  returns: finishContextReturn,
  handler: async (ctx, args) => {
    const userId = await humanUser(ctx);
    const { row, params } = await ownStudioRow(ctx, args.artifactId, userId);
    if (row.status === "ready" && row.blindGroupId)
      return { kind: "done" as const, groupId: row.blindGroupId };
    if (row.status !== "pending" || row.storageId)
      throw refuse(
        row.status === "failed"
          ? `This upload was refused: ${row.error ?? "unknown reason"}`
          : "This upload cannot be finished",
      );
    if (!(await declaredBlob(ctx, args.storageId, params)))
      throw refuse(
        "The uploaded file does not match the declared size and SHA-256",
        "INVALID_ARGUMENT",
      );
    let machine: MachineSource;
    try {
      machine = await machineSource(ctx, params.machineArtifactId);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return {
        kind: "unavailable" as const,
        message: (error.data as { message: string }).message,
      };
    }
    const machineBlob = await ctx.db.system.get(machine.delivery.storageId!);
    if (!machineBlob) throw refuse("The machine render's audio is missing");
    const encoding = machine.delivery.encoding;
    return {
      kind: "pending" as const,
      durationSecs: machine.input.renderPlan.durationSecs,
      machineStorageId: machine.delivery.storageId!,
      machineSha256: base64ToHex(machineBlob.sha256),
      bitrateKbps: encoding.bitrateKbps ?? 0,
      sampleRate: encoding.sampleRate,
      channels: encoding.channels,
    };
  },
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

class StudioRejection extends Error {}

const finishReturn = v.object({
  groupId: v.id("blindGroups"),
  replayed: v.boolean(),
});

/** Inspect the uploaded bytes and, if they pass, open the blind comparison.
 * A file that fails inspection is deleted and its row marked failed. */
export const finishUpload = action({
  args: { artifactId: v.id("audioArtifacts"), storageId: v.id("_storage") },
  returns: finishReturn,
  handler: async (
    ctx,
    args,
  ): Promise<{ groupId: Id<"blindGroups">; replayed: boolean }> => {
    await requireHumanIdentity(ctx);
    const context = await ctx.runQuery(
      internal.studioComparisons.finishContext,
      args,
    );
    if (context.kind === "done")
      return { groupId: context.groupId, replayed: true };
    // Nothing can pair with this upload any more: refuse it outright so it
    // does not wait a day for the sweeper.
    if (context.kind === "unavailable") {
      await ctx.runMutation(internal.studioComparisons.rejectUpload, {
        artifactId: args.artifactId,
        storageId: args.storageId,
        error: context.message,
      });
      throw refuse(context.message);
    }
    const upload = await ctx.storage.get(args.storageId);
    const machineBlob = await ctx.storage.get(context.machineStorageId);
    if (!machineBlob) throw refuse("The machine render's audio is missing");
    const machineBytes = new Uint8Array(await machineBlob.arrayBuffer());
    let durationSecs: number;
    try {
      if (!upload) throw new StudioRejection("The uploaded file is missing");
      const bytes = new Uint8Array(await upload.arrayBuffer());
      const digest = await sha256Hex(bytes);
      if (digest === (await sha256Hex(machineBytes)))
        throw new StudioRejection(
          "This file is the machine render, not a studio render",
        );
      const studio = inspectMp3(bytes);
      let machine;
      try {
        machine = inspectMp3(machineBytes);
      } catch {
        throw refuse("The machine render is not a plain MP3 delivery");
      }
      if (
        studio.bitrateKbps !== context.bitrateKbps ||
        studio.sampleRate !== context.sampleRate ||
        studio.channels !== context.channels ||
        studio.channelMode !== machine.channelMode ||
        (studio.infoFrame?.tag ?? null) !== (machine.infoFrame?.tag ?? null) ||
        (studio.infoFrame?.encoder ?? null) !==
          (machine.infoFrame?.encoder ?? null)
      )
        throw new StudioRejection(
          `The MP3 must match the machine delivery's encoding (${context.bitrateKbps} kbps, ${context.sampleRate} Hz, ${context.channels} channels, same encoder header); encode it with the documented ffmpeg command`,
        );
      if (
        Math.abs(studio.durationSecs - context.durationSecs) >
        STUDIO_DURATION_TOLERANCE_SECS
      )
        throw new StudioRejection(
          `The render lasts ${studio.durationSecs.toFixed(3)} s; the plan asks for ${context.durationSecs} s`,
        );
      durationSecs = studio.durationSecs;
    } catch (error) {
      if (
        !(
          error instanceof StudioRejection ||
          error instanceof Mp3InspectionError
        )
      )
        throw error;
      await ctx.runMutation(internal.studioComparisons.rejectUpload, {
        artifactId: args.artifactId,
        storageId: args.storageId,
        error: error.message,
      });
      throw refuse(error.message, "INVALID_ARGUMENT");
    }
    // A fresh copy: the original's URL may already have been served on a
    // recipe page, and a cached URL would mark the machine member.
    const copyStorageId = await ctx.storage.store(
      new Blob([machineBytes], { type: "audio/mpeg" }),
    );
    let result: CompleteResult;
    try {
      result = await ctx.runMutation(
        internal.studioComparisons.completeUpload,
        {
          artifactId: args.artifactId,
          storageId: args.storageId,
          copyStorageId,
          durationSecs,
        },
      );
    } catch (error) {
      await ctx.storage.delete(copyStorageId);
      throw error;
    }
    if (result.kind === "rejected") throw refuse(result.message);
    return { groupId: result.groupId, replayed: false };
  },
});

async function deleteIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  if (!(await ctx.db.system.get(storageId))) return;
  const holder = await ctx.db
    .query("audioArtifacts")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  if (!holder) await ctx.storage.delete(storageId);
}

export const rejectUpload = internalMutation({
  args: {
    artifactId: v.id("audioArtifacts"),
    storageId: v.id("_storage"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireDecisionUser(ctx);
    const { row, params } = await ownStudioRow(ctx, args.artifactId, userId);
    if (row.status !== "pending") return null;
    // Only the declared bytes are ours to delete.
    if (await declaredBlob(ctx, args.storageId, params))
      await ctx.storage.delete(args.storageId);
    await ctx.runMutation(internal.audioArtifacts.markFailed, {
      artifactId: row._id,
      error: args.error,
    });
    return null;
  },
});

function shuffledLabels(): (typeof STUDIO_COMPARISON_LABELS)[number][] {
  return crypto.getRandomValues(new Uint8Array(1))[0]! & 1
    ? ["A", "B"]
    : ["B", "A"];
}

type CompleteResult =
  | { kind: "grouped"; groupId: Id<"blindGroups"> }
  | { kind: "rejected"; message: string };

export const completeUpload = internalMutation({
  args: {
    artifactId: v.id("audioArtifacts"),
    storageId: v.id("_storage"),
    copyStorageId: v.id("_storage"),
    durationSecs: v.number(),
  },
  returns: v.union(
    v.object({ kind: v.literal("grouped"), groupId: v.id("blindGroups") }),
    v.object({ kind: v.literal("rejected"), message: v.string() }),
  ),
  // Explicit return type breaks the api.d.ts <-> internal.* inference cycle.
  handler: async (ctx, args): Promise<CompleteResult> => {
    const userId = await requireDecisionUser(ctx);
    const { row, params } = await ownStudioRow(ctx, args.artifactId, userId);
    if (row.status === "ready" && row.blindGroupId) {
      // A concurrent finish won; this copy is surplus.
      await deleteIfUnreferenced(ctx, args.copyStorageId);
      return { kind: "grouped" as const, groupId: row.blindGroupId };
    }
    if (
      row.status !== "pending" ||
      row.storageId ||
      !(await declaredBlob(ctx, args.storageId, params))
    ) {
      await deleteIfUnreferenced(ctx, args.copyStorageId);
      return {
        kind: "rejected" as const,
        message: "This upload cannot be finished",
      };
    }
    let machine: MachineSource;
    try {
      machine = await machineSource(ctx, params.machineArtifactId);
    } catch (error) {
      // Another comparison took the machine render, or it changed: refuse
      // this upload outright so nothing waits on a pairing that cannot form.
      const message =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "The machine render is no longer available";
      await deleteIfUnreferenced(ctx, args.copyStorageId);
      await ctx.storage.delete(args.storageId);
      await ctx.runMutation(internal.audioArtifacts.markFailed, {
        artifactId: row._id,
        error: message,
      });
      return { kind: "rejected" as const, message };
    }
    const copyBlob = await ctx.db.system.get(args.copyStorageId);
    const copyHolder = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.copyStorageId))
      .first();
    const machineBlob = await ctx.db.system.get(machine.delivery.storageId!);
    if (
      !copyBlob ||
      copyHolder ||
      !machineBlob ||
      copyBlob.sha256 !== machineBlob.sha256
    )
      throw refuse("The machine copy does not match the machine render");
    const now = Date.now();
    await ctx.runMutation(internal.audioArtifacts.attachStorage, {
      artifactId: row._id,
      storageId: args.storageId,
    });
    await ctx.db.patch(row._id, {
      status: "ready",
      metadataStripped: true,
      durationSecs: args.durationSecs,
      mimeType: "audio/mpeg",
      updatedAt: now,
    });
    const delivery = machine.delivery;
    // Same audio as the machine delivery under a new storage id. Kept off
    // the recipe (no refs) so the original stays its only listing after
    // reveal; provenance points back at the original.
    const copyId = await ctx.db.insert("audioArtifacts", {
      kind: "litmusRender",
      role: "delivery",
      masterArtifactId: machine.master._id,
      metadataStripped: true,
      status: "ready",
      storageId: args.copyStorageId,
      mimeType: delivery.mimeType ?? "audio/mpeg",
      encoding: delivery.encoding,
      durationSecs: delivery.durationSecs,
      loudnessLufs: delivery.loudnessLufs,
      truePeakDbtp: delivery.truePeakDbtp,
      normalization: delivery.normalization,
      access: "private",
      // Comparison ratings are never validated evidence.
      validation: "unvalidated",
      title: `${machine.recipe.title} — machine render (studio comparison copy)`,
      engine: {
        name: delivery.engine!.name,
        version: delivery.engine!.version,
        params: {
          ...delivery.engine!.params,
          comparisonCopyOf: delivery._id,
          mediaJobId: machine.job._id,
        },
      },
      refs: {},
      contentHash: delivery.contentHash,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    const [first, second] = shuffledLabels();
    const { groupId }: { groupId: Id<"blindGroups"> } = await ctx.runMutation(
      internal.blindGroups.create,
      {
        purpose: STUDIO_COMPARISON_PURPOSE,
        members: [
          { artifactId: copyId, label: first! },
          { artifactId: row._id, label: second! },
        ],
      },
    );
    // The original and its master carry the group without being members, so
    // playback, the recipe page, the rating queue and the docket hide them
    // until reveal, as they hide a study family's masters.
    for (const id of [delivery._id, machine.master._id])
      await ctx.db.patch(id, { blindGroupId: groupId, updatedAt: now });
    await markDocketStale(ctx);
    return { kind: "grouped" as const, groupId };
  },
});

// ---------------------------------------------------------------------------
// Reading and rating
// ---------------------------------------------------------------------------

type ComparisonParts = {
  studio: Doc<"audioArtifacts">;
  studioParams: StudioParams;
  machine: Doc<"audioArtifacts">;
};

async function comparisonParts(
  ctx: Pick<QueryCtx, "db">,
  group: Doc<"blindGroups">,
): Promise<ComparisonParts> {
  let studio: Doc<"audioArtifacts"> | null = null;
  let machine: Doc<"audioArtifacts"> | null = null;
  for (const member of group.members) {
    const row = await ctx.db.get(member.artifactId);
    if (row && studioParams(row)) studio = row;
    else if (row?.engine?.params?.comparisonCopyOf) machine = row;
  }
  if (group.members.length !== 2 || !studio || !machine)
    throw refuse("This studio comparison is incomplete");
  return { studio, studioParams: studioParams(studio)!, machine };
}

async function studioComparison(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"blindGroups">,
): Promise<Doc<"blindGroups">> {
  const group = await ctx.db.get(groupId);
  if (!group || group.purpose !== STUDIO_COMPARISON_PURPOSE)
    throw refuse("Studio comparison not found", "NOT_FOUND");
  return group;
}

const listReturn = v.array(
  v.object({
    groupId: v.id("blindGroups"),
    createdAt: v.number(),
    revealed: v.boolean(),
    recipeTitle: v.string(),
  }),
);

/** Comparisons, newest first. Both members share the recipe, so its title
 * names the comparison without identifying either member. */
export const list = query({
  args: {},
  returns: listReturn,
  handler: async (ctx) => {
    await requireHumanIdentity(ctx);
    const groups = await ctx.db
      .query("blindGroups")
      .order("desc")
      .filter((q) => q.eq(q.field("purpose"), STUDIO_COMPARISON_PURPOSE))
      .take(LIST_LIMIT);
    const rows = [];
    for (const group of groups) {
      let recipeTitle = "Deleted recipe";
      try {
        const { studioParams: params } = await comparisonParts(ctx, group);
        recipeTitle = (await ctx.db.get(params.recipeId))?.title ?? recipeTitle;
      } catch {
        recipeTitle = "Incomplete comparison";
      }
      rows.push({
        groupId: group._id,
        createdAt: group.createdAt,
        revealed: group.revealedAt !== undefined,
        recipeTitle,
      });
    }
    return rows;
  },
});

const scoresWithNotes = v.object({
  scores: audioRatingScoresValidator,
  notes: v.optional(v.string()),
});

const revealedMemberValidator = v.object({
  memberId: v.string(),
  label: v.string(),
  source: v.union(v.literal("machine"), v.literal("studio")),
  artifactId: v.id("audioArtifacts"),
  // For the machine member, the original delivery it copies.
  originalArtifactId: v.id("audioArtifacts"),
  engineName: v.string(),
  engineVersion: v.string(),
  durationSecs: v.optional(v.number()),
  rating: v.union(scoresWithNotes, v.null()),
});

const detailReturn = v.object({
  groupId: v.id("blindGroups"),
  createdAt: v.number(),
  recipeTitle: v.string(),
  revealed: v.boolean(),
  // Present only after reveal: which label was which, with provenance.
  reveal: v.union(
    v.null(),
    v.object({
      revealedAt: v.number(),
      recipeId: v.id("recipes"),
      recipeUpdatedAt: v.number(),
      planDigest: v.string(),
      machineRendererVersion: v.string(),
      studioSha256: v.string(),
      declared: v.object({
        daw: v.string(),
        instrument: v.string(),
        tuningMethod: v.string(),
        effects: v.string(),
        tunerCheck: v.string(),
        integratedLufs: v.number(),
        truePeakDbtp: v.number(),
        notes: v.optional(v.string()),
      }),
      conditions: v.optional(listeningConditionsValidator),
      members: v.array(revealedMemberValidator),
    }),
  ),
});

function ratingKey(groupId: Id<"blindGroups">, memberId: string): string {
  return `${STUDIO_COMPARISON_PURPOSE}:${groupId}:${memberId}`;
}

async function memberRating(
  ctx: Pick<QueryCtx, "db">,
  groupId: Id<"blindGroups">,
  memberId: string,
): Promise<Doc<"audioRatings"> | null> {
  return await ctx.db
    .query("audioRatings")
    .withIndex("by_requestKey", (q) =>
      q.eq("requestKey", ratingKey(groupId, memberId)),
    )
    .unique();
}

async function detail(ctx: QueryCtx, group: Doc<"blindGroups">) {
  const parts = await comparisonParts(ctx, group);
  const params = parts.studioParams;
  const recipe = await ctx.db.get(params.recipeId);
  const base = {
    groupId: group._id,
    createdAt: group.createdAt,
    recipeTitle: recipe?.title ?? "Deleted recipe",
    revealed: group.revealedAt !== undefined,
  };
  if (group.revealedAt === undefined) return { ...base, reveal: null };
  const members = [];
  let conditions;
  for (const member of group.members) {
    const isStudio = member.artifactId === parts.studio._id;
    const row = isStudio ? parts.studio : parts.machine;
    const rating = await memberRating(ctx, group._id, member.memberId);
    conditions ??= rating?.conditions;
    members.push({
      memberId: member.memberId,
      label: member.label,
      source: isStudio ? ("studio" as const) : ("machine" as const),
      artifactId: row._id,
      originalArtifactId: isStudio
        ? row._id
        : (row.engine!.params.comparisonCopyOf as Id<"audioArtifacts">),
      engineName: row.engine!.name,
      engineVersion: row.engine!.version,
      durationSecs: row.durationSecs,
      rating: rating
        ? {
            scores: rating.scores,
            ...(rating.notes ? { notes: rating.notes } : {}),
          }
        : null,
    });
  }
  return {
    ...base,
    reveal: {
      revealedAt: group.revealedAt,
      recipeId: params.recipeId,
      recipeUpdatedAt: params.recipeUpdatedAt,
      planDigest: params.planDigest,
      machineRendererVersion: params.machineRendererVersion,
      studioSha256: params.sha256,
      declared: params.declared,
      ...(conditions ? { conditions } : {}),
      members: members.toSorted((a, b) => a.label.localeCompare(b.label)),
    },
  };
}

/** Recipe and state while blind; the mapping and provenance after reveal. */
export const get = query({
  args: { groupId: v.id("blindGroups") },
  returns: detailReturn,
  handler: async (ctx, args) => {
    await requireHumanIdentity(ctx);
    return await detail(ctx, await studioComparison(ctx, args.groupId));
  },
});

const machineCandidateReturn = v.array(
  v.object({
    artifactId: v.id("audioArtifacts"),
    recipeId: v.id("recipes"),
    recipeTitle: v.string(),
    recipeUpdatedAt: v.number(),
    rendererVersion: v.string(),
    durationSecs: v.number(),
    planDigest: v.string(),
    createdAt: v.number(),
  }),
);

/** Machine baselines a studio render can be compared against, newest
 * first. These renders are already listed, unblinded, on their recipes. */
export const machineCandidates = query({
  args: {},
  returns: machineCandidateReturn,
  handler: async (ctx) => {
    await requireHumanIdentity(ctx);
    const rows = await ctx.db
      .query("audioArtifacts")
      .withIndex("by_kind_createdAt", (q) => q.eq("kind", "litmusRender"))
      .order("desc")
      .take(CANDIDATE_SCAN);
    const candidates = [];
    for (const row of rows) {
      if (row.role !== "delivery" || row.engine?.name !== "sc-litmus") continue;
      let source: MachineSource;
      try {
        source = await machineSource(ctx, row._id);
      } catch {
        continue;
      }
      candidates.push({
        artifactId: row._id,
        recipeId: source.recipe._id,
        recipeTitle: source.recipe.title,
        recipeUpdatedAt: source.input.recipeUpdatedAt,
        rendererVersion: source.input.rendererVersion,
        durationSecs: source.input.renderPlan.durationSecs,
        planDigest: await stableContentDigest(source.input.renderPlan),
        createdAt: row.createdAt,
      });
    }
    return candidates;
  },
});

const submitReturn = v.object({ replayed: v.boolean() });

/** Rate every member at once under one set of listening conditions. The
 * ratings and the reveal commit together; the mapping is then read through
 * `get`. Resubmitting the same ratings after reveal is a replay. */
export const submitRatings = mutation({
  args: {
    groupId: v.id("blindGroups"),
    conditions: listeningConditionsValidator,
    members: v.array(
      v.object({
        memberId: v.string(),
        scores: audioRatingScoresValidator,
        notes: v.optional(v.string()),
      }),
    ),
  },
  returns: submitReturn,
  handler: async (ctx, args) => {
    const userId = await requireDecisionUser(ctx);
    const group = await studioComparison(ctx, args.groupId);
    const ids = args.members.map((member) => member.memberId);
    if (
      ids.length !== group.requiredRatings.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !group.requiredRatings.includes(id))
    )
      throw refuse(
        "Rate every member of this comparison exactly once",
        "INVALID_ARGUMENT",
      );
    const payloads = args.members.map((member) => {
      const parsed = audioRatingPayloadZ.safeParse({
        scores: member.scores,
        conditions: args.conditions,
        notes: member.notes?.trim() || undefined,
      });
      if (!parsed.success) throw refuse("Invalid rating", "INVALID_ARGUMENT");
      const outside = scoreKeysOutsideKind("litmusRender", parsed.data.scores);
      if (outside.length)
        throw refuse(
          `Scores not used for renders: ${outside.join(", ")}`,
          "INVALID_ARGUMENT",
        );
      const missing = STUDIO_REQUIRED_SCORE_KEYS.filter(
        (key) => parsed.data.scores[key] === undefined,
      );
      if (missing.length)
        throw refuse(
          `Every member needs all six render scales; missing ${missing.join(", ")}`,
          "INVALID_ARGUMENT",
        );
      return { memberId: member.memberId, payload: parsed.data };
    });
    if (group.revealedAt !== undefined) {
      for (const { memberId, payload } of payloads) {
        const existing = await memberRating(ctx, group._id, memberId);
        if (
          !existing ||
          existing.createdBy !== userId ||
          stableStringify({
            scores: existing.scores,
            conditions: existing.conditions,
            notes: existing.notes,
          }) !== stableStringify(payload)
        )
          throw refuse("This comparison was already rated and revealed");
      }
      return { replayed: true };
    }
    const now = Date.now();
    for (const { memberId, payload } of payloads) {
      const member = group.members.find((row) => row.memberId === memberId)!;
      const artifact = await ctx.db.get(member.artifactId);
      if (!artifact || artifact.status !== "ready")
        throw refuse("A comparison member is unavailable");
      await ctx.db.insert("audioRatings", {
        artifactId: artifact._id,
        artifactKind: "litmusRender",
        artifactContentHash: artifact.contentHash,
        artifactValidation: artifact.validation,
        scores: payload.scores,
        conditions: payload.conditions,
        notes: payload.notes,
        createdBy: userId,
        source: "web",
        requestKey: ratingKey(group._id, memberId),
        createdAt: now,
      });
    }
    await ctx.runMutation(internal.blindGroups.reveal, { groupId: group._id });
    await markDocketStale(ctx);
    return { replayed: false };
  },
});
