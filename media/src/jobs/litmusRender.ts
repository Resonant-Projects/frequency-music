// litmusRender: a recipe's frozen render plan through the SuperCollider
// litmus engine (render ladder 3.1-3.3). Every member, baseline first, is
// uploaded as a 24-bit stereo WAV master and a 256 kbps MP3 delivery. The
// worker reports bytes and measurements only; Convex assigns titles, blind
// labels, validation, and compositions at completion.
import { fnv1a64Hex, stableStringify } from "../../../convex/shared/stableHash";
import { uploadArtifact } from "../audio/artifacts";
import { LOUDNESS_TARGETS } from "../audio/loudness";
import { renderLocal } from "../engines/sc";
import type { JobContext } from "./types";

export type RenderLitmus = typeof renderLocal;

export async function litmusRenderHandler(
  ctx: JobContext,
  render: RenderLitmus = renderLocal,
) {
  const input = ctx.job.input;
  if (input.kind !== "litmusRender") {
    throw new Error("litmusRender handler received another kind");
  }
  const plan = input.renderPlan;
  // The renderer re-validates the snapshot and enforces its own limits.
  const rendered = await render(plan, {
    signal: ctx.signal,
    tempRoot: ctx.workDir,
  });
  try {
    const targetLufs = plan.normalize ? LOUDNESS_TARGETS.music : null;
    const engine = {
      name: "sc-litmus",
      version: ctx.rendererVersion,
      params: { recipeId: input.recipeId },
    };
    const members = [];
    for (const [member, files] of rendered.artifacts.entries()) {
      // Stable across retries of this job, so a re-upload after a crash
      // reuses the pending row instead of minting a second one.
      const hash = (role: string, codec: string) =>
        fnv1a64Hex(
          stableStringify({
            kind: "litmusRender",
            recipeId: input.recipeId,
            recipeUpdatedAt: input.recipeUpdatedAt,
            renderPlan: plan,
            rendererVersion: ctx.rendererVersion,
            member,
            role,
            codec,
          }),
        );
      const base = {
        kind: "litmusRender" as const,
        metadataStripped: true,
        normalization: plan.normalize
          ? ("applied" as const)
          : ("skipped" as const),
        access: "private" as const,
        title: "Litmus render",
        engine,
        createdBy: "system" as const,
      };
      const masterRole = plan.normalize ? "masterNormalized" : "masterRaw";
      const master = await uploadArtifact(
        ctx,
        files.master,
        {
          ...base,
          role: masterRole,
          encoding: { codec: "wav", sampleRate: 48000, channels: 2 },
          contentHash: hash(masterRole, "wav"),
        },
        "audio/wav",
        targetLufs,
      );
      const delivery = await uploadArtifact(
        ctx,
        files.delivery,
        {
          ...base,
          role: "delivery",
          masterArtifactId: master.artifactId,
          encoding: {
            codec: "mp3",
            bitrateKbps: 256,
            sampleRate: 48000,
            channels: 2,
          },
          contentHash: hash("delivery", "mp3"),
        },
        "audio/mpeg",
        targetLufs,
      );
      members.push({ member, master, delivery });
    }
    return { kind: "litmusRender" as const, members };
  } finally {
    await rendered.dispose();
  }
}
