// Bounded service contracts. These expose proposals and text cards, never authority.
import { z } from "zod";
import { decisionCommandZ, decisionProposalZ } from "./decisionIntents";
import { docketKindZ } from "./docket";

const id = z.string().min(1).max(200);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const authority = new Set([
  "actor",
  "signature",
  "signer",
  "signerId",
  "userId",
  "createdBy",
  "decidedBy",
  "decisionSource",
  "signerCard",
  "secret",
  "agentSecret",
  "agentRunId",
  "consonanceComputed",
  "__proto__",
  "constructor",
  "prototype",
]);
// Check raw input before the domain schemas can strip unknown nested fields.
export function assertBoundedProposal(value: unknown): void {
  let nodes = 0;
  function visit(child: unknown, depth: number): void {
    if (++nodes > 2000 || depth > 12) throw new Error("Proposal is too large");
    if (typeof child === "string" && child.length > 30000)
      throw new Error("Proposal text is too long");
    if (Array.isArray(child) && child.length > 100)
      throw new Error("Proposal collection is too large");
    if (child && typeof child === "object") {
      for (const [key, nested] of Object.entries(child)) {
        if (authority.has(key))
          throw new Error("Authority fields are not accepted");
        visit(nested, depth + 1);
      }
    }
  }
  visit(value, 0);
}
function boundedProposal(value: unknown, ctx: z.RefinementCtx) {
  try {
    assertBoundedProposal(value);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Proposal exceeds bounds or includes authority fields",
    });
  }
}
const decisionCommands = decisionCommandZ.options;
export const decisionProposeArgsZ = z
  .strictObject({
    command: z.discriminatedUnion("action", [
      decisionCommands[0],
      decisionCommands[1],
      decisionCommands[2],
      decisionCommands[3],
      decisionCommands[4],
    ]),
    proposal: decisionProposalZ,
  })
  .superRefine(boundedProposal);
export const listeningProposeArgsZ = z
  .strictObject({
    command: decisionCommands[5].extend({
      payload: decisionCommands[5].shape.payload.extend({
        feltQualities: z.array(z.string().max(1000)).max(100).optional(),
        standoutMoments: z.array(z.string().max(1000)).max(100).optional(),
      }),
    }),
    proposal: decisionProposalZ,
  })
  .superRefine(boundedProposal);
export const docketListArgsZ = z.strictObject({
  weekly: z.boolean().optional(),
});
export const docketCardArgsZ = z.strictObject({ cardId: id });
export const deliveryRecordArgsZ = z
  .strictObject({
    cardId: id,
    channel: z.string().trim().min(1).max(100),
    contentHash: hash,
    phase: z.enum(["posting", "posted"]),
    deliveryId: id.optional(),
    messageRef: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.phase === "posted" && (!value.deliveryId || !value.messageRef))
      ctx.addIssue({
        code: "custom",
        message: "Posted requires deliveryId and messageRef",
      });
    if (value.phase === "posting" && (value.deliveryId || value.messageRef))
      ctx.addIssue({
        code: "custom",
        message: "Posting must not claim an existing delivery",
      });
  });
// Relative paths match the web's existing deep-link contract. No inferred audio URLs.
const pageUrl = z
  .string()
  .max(2000)
  .regex(/^\/(?!\/)/);
// The MCP response embeds JSON as a text string, so measure both serialization
// layers in UTF-8. Reserve the request limit for its ID, plus 1 KiB for framing.
export const MCP_MAX_RESPONSE_BYTES = 256 * 1024;
export const MCP_MAX_REQUEST_BYTES = 64 * 1024;
export const DOCKET_MAX_RESULT_BYTES =
  MCP_MAX_RESPONSE_BYTES - MCP_MAX_REQUEST_BYTES - 1024;
const DOCKET_MAX_CARD_BYTES = 18 * 1024;
export const DOCKET_EXCERPT_MARKER = " [Excerpt; open the page for full text.]";
export function mcpTextResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}
export function serializedUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
function docketResultFits(value: unknown): boolean {
  return serializedUtf8Bytes(mcpTextResult(value)) <= DOCKET_MAX_RESULT_BYTES;
}
export const docketAudioUrlZ = z
  .string()
  .url()
  .max(2048)
  .regex(/^https?:\/\/[^\s"\\]+$/);
export const docketToolCardZ = z.strictObject({
  cardId: id,
  kind: docketKindZ,
  targetId: id,
  title: z.string().max(1000),
  blurbMd: z.string().max(30000),
  spokenBlurb: z.string().max(10000),
  pageUrl,
  audioUrl: docketAudioUrlZ.optional(),
  decisions: z
    .array(
      z.enum([
        "approve",
        "reject",
        "supersede",
        "defer",
        "enableFeed",
        "createListeningSession",
      ]),
    )
    .max(6),
  contentHash: hash,
});
export const docketListResultZ = z
  .array(docketToolCardZ)
  .max(10)
  .refine(docketResultFits, "Docket result exceeds its serialized byte budget");
export const docketCardResultZ = docketToolCardZ
  .nullable()
  .refine(docketResultFits, "Docket result exceeds its serialized byte budget");
export const proposalResultZ = z.strictObject({
  intentId: id,
  code: z
    .string()
    .regex(/^D-\d+$/)
    .max(100),
  status: z.literal("proposed"),
  expiresAt: z.number().finite(),
  pageUrl,
});
export const deliveryRecordResultZ = z.strictObject({
  admitted: z.boolean(),
  deliveryId: id,
  updated: z.boolean(),
});

function excerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let end = Math.max(0, maxLength - DOCKET_EXCERPT_MARKER.length);
  // Keep valid surrogate pairs intact at the excerpt boundary.
  if (
    end > 0 &&
    /[\uD800-\uDBFF]/.test(text[end - 1]!) &&
    /[\uDC00-\uDFFF]/.test(text[end]!)
  )
    end--;
  return text.slice(0, end) + DOCKET_EXCERPT_MARKER;
}
export function projectDocketCard(value: unknown, playbackUrl?: string | null) {
  const row = z
    .object({
      _id: id,
      title: z.string(),
      blurbMd: z.string(),
      spokenBlurb: z.string(),
    })
    .passthrough()
    .parse(value);
  const fields = Object.fromEntries(
    Object.keys(docketToolCardZ.shape).map((key) => [
      key,
      key === "cardId" ? row._id : key === "audioUrl" ? undefined : row[key],
    ]),
  );
  if (playbackUrl) fields.audioUrl = docketAudioUrlZ.parse(playbackUrl);
  const candidate = (limit: number) => ({
    ...fields,
    title: excerpt(row.title, Math.min(1000, limit)),
    blurbMd: excerpt(row.blurbMd, Math.min(30000, limit)),
    spokenBlurb: excerpt(row.spokenBlurb, Math.min(10000, limit)),
  });
  // A per-card budget preserves every card in a ten-card list. Identity, actions,
  // links and the original contentHash never change when display text is excerpted.
  // Optional playback must not crowd out the card's immutable identity.
  if (
    serializedUtf8Bytes(
      JSON.stringify(candidate(DOCKET_EXCERPT_MARKER.length)),
    ) > DOCKET_MAX_CARD_BYTES
  )
    delete fields.audioUrl;
  let low = DOCKET_EXCERPT_MARKER.length;
  let high = 30000;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (
      serializedUtf8Bytes(JSON.stringify(candidate(mid))) <=
      DOCKET_MAX_CARD_BYTES
    )
      low = mid;
    else high = mid - 1;
  }
  const projected = docketToolCardZ.parse(candidate(low));
  if (serializedUtf8Bytes(JSON.stringify(projected)) > DOCKET_MAX_CARD_BYTES)
    throw new Error("Docket identity exceeds its serialized byte budget");
  return projected;
}
export function projectProposal(value: unknown) {
  const row = z
    .object({
      _id: id,
      code: proposalResultZ.shape.code,
      status: z.literal("proposed"),
      expiresAt: z.number().finite(),
    })
    .parse(value);
  return proposalResultZ.parse({
    intentId: row._id,
    code: row.code,
    status: row.status,
    expiresAt: row.expiresAt,
    pageUrl: `/agent-drafts?intent=${encodeURIComponent(row._id)}`,
  });
}
