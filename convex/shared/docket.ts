import { zid, zodToConvex } from "convex-helpers/server/zod4";
import { z } from "zod";
export const docketKindZ = z.enum([
  "pendingDraft",
  "recipeNoComposition",
  "compositionNoListening",
  "unratedAudio",
  "feedProposal",
]);
export const docketCardFieldsZ = z.object({
  kind: docketKindZ,
  targetId: z.string(),
  title: z.string(),
  blurbMd: z.string(),
  spokenBlurb: z.string(),
  blurbArtifactId: zid("audioArtifacts").optional(),
  pageUrl: z.string(),
  decisions: z.array(z.string()),
  contentHash: z.string(),
  rank: z.number(),
  deferredUntil: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export const docketDeliveryFieldsZ = z.object({
  cardId: zid("docketCards"),
  channel: z.string(),
  contentHash: z.string(),
  phase: z.enum(["posting", "posted"]),
  postingAt: z.number(),
  messageRef: z.string().optional(),
  postedAt: z.number().optional(),
});
export const docketCardValidator = zodToConvex(docketCardFieldsZ);
export const docketDeliveryValidator = zodToConvex(docketDeliveryFieldsZ);
export const docketCardReturnValidator = zodToConvex(
  docketCardFieldsZ.extend({
    _id: zid("docketCards"),
    _creationTime: z.number(),
  }),
);
export type DocketCardFields = z.infer<typeof docketCardFieldsZ>;
export const DOCKET_LIST_LIMIT = 10;
export const DOCKET_WEEKLY_LIMIT = 3;

export const docketCandidateZ = docketCardFieldsZ
  .omit({
    createdAt: true,
    updatedAt: true,
    deferredUntil: true,
    blurbArtifactId: true,
  })
  .extend({ debtSince: z.number() });
export const docketCandidateValidator = zodToConvex(docketCandidateZ);
export type DocketCandidate = z.infer<typeof docketCandidateZ>;
export const DELIVERY_POSTING_MS = 24 * 60 * 60 * 1000;
export const DELIVERY_POSTED_MS = 7 * DELIVERY_POSTING_MS;

export const DOCKET_REBUILD_MS = 60 * 60 * 1000;
// Longer than Convex's action deadline; expired owners cannot publish results.
export const DOCKET_REBUILD_LEASE_MS = 15 * 60 * 1000;
export const DOCKET_PROMPT_VERSION = "docket.v1";
const boundedBlurbZ = z
  .string()
  .trim()
  .refine((text) => {
    const words = text.split(/\s+/).filter(Boolean).length;
    return words >= 60 && words <= 90;
  }, "Docket blurbs must contain 60–90 words");
export const docketBlurbZ = z
  .object({
    blurbMd: boundedBlurbZ,
    spokenBlurb: boundedBlurbZ.refine(
      (text) =>
        !/https?:|www\.|\[[^\]]*\]\(|[/#*_`]|\b[a-z0-9]{24,}\b/i.test(text),
      "Spoken blurbs must omit links, IDs and markup",
    ),
  })
  .strict();
// Refinements are rechecked by saveBlurb; Convex validates the wire shape.
export const docketBlurbValidator = zodToConvex(
  z.object({ blurbMd: z.string(), spokenBlurb: z.string() }),
);
export const docketRebuildStateZ = z.object({
  revision: z.number().default(0),
  token: z.number().default(0),
  admittedRevision: z.number().optional(),
  completedRevision: z.number().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});
