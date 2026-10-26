import type { convexTest } from "convex-test";

export const body =
  "A recovered source explains how resonance depends on frequency, damping and boundary conditions. Its measurements describe the physical system and do not establish a musical listening effect. ".repeat(
    3,
  );
export const seed = (t: ReturnType<typeof convexTest>, extra = {}) =>
  t.run((ctx) =>
    ctx.db.insert("sources", {
      type: "youtube",
      canonicalUrl: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
      title: "Blocked video",
      dedupeKey: "yt:AAAAAAAAAAA",
      status: "review_needed",
      blockedReason: "no_text",
      blockedDetails: "This video is unavailable",
      visibility: "private",
      createdBy: "system",
      createdAt: 1,
      updatedAt: 2,
      metadata: {
        feedName: "Preserve me",
        transcriptCapture: { attempts: 5, lastAttemptDetail: "403" },
      },
      ...extra,
    }),
  );
