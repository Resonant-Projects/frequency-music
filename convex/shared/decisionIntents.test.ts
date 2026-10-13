import { describe, expect, test } from "vite-plus/test";
import {
  currentRevision,
  decisionCommandZ,
  decisionPayloadDigest,
  subjectiveRatingsZ,
  listeningIntentPayloadZ,
} from "./decisionIntents";

describe("decision contracts", () => {
  test("digest sorts nested object keys, omits undefined and preserves array order", async () => {
    expect(
      await decisionPayloadDigest("createListeningSession", {
        conditions: { timeOfDay: "evening", listeningMethod: "headphones" },
        ratings: { musicality: 4, goosebumps: 2 },
      }),
    ).toBe(
      await decisionPayloadDigest("createListeningSession", {
        ratings: { goosebumps: 2, musicality: 4 },
        conditions: { listeningMethod: "headphones", timeOfDay: "evening" },
      }),
    );
    expect(await decisionPayloadDigest("defer", {})).toBe(
      await decisionPayloadDigest("defer", { note: undefined }),
    );
    expect(await decisionPayloadDigest("defer", {})).not.toBe(
      await decisionPayloadDigest("enableFeed", {}),
    );
  });
  test("reject needs a note and an action-matched target", () => {
    expect(
      decisionCommandZ.safeParse({
        action: "reject",
        target: { kind: "composition", id: "composition" },
        payload: { note: "No" },
      }).success,
    ).toBe(false);
    expect(
      decisionCommandZ.safeParse({
        action: "reject",
        target: { kind: "agentReviewDraft", id: "draft" },
        payload: { note: " " },
      }).success,
    ).toBe(false);
    expect(
      decisionCommandZ.safeParse({
        action: "approve",
        target: { kind: "agentReviewDraft", id: "draft" },
        payload: {},
        actor: "human",
      }).success,
    ).toBe(false);
  });
  test.each([
    "bodilyPleasantness",
    "goosebumps",
    "perceivedConsonance",
    "musicality",
    "easeOfComposability",
    "expandability",
  ])("validates supplied %s without filling absent values", (field) => {
    for (const value of [-1, 6, NaN, Infinity])
      expect(subjectiveRatingsZ.safeParse({ [field]: value }).success).toBe(
        false,
      );
    expect(subjectiveRatingsZ.parse({ [field]: 0 })).toEqual({ [field]: 0 });
  });
  test("conditions required, computed consonance forbidden, legacy revision zero", () => {
    expect(listeningIntentPayloadZ.safeParse({ ratings: {} }).success).toBe(
      false,
    );
    expect(
      subjectiveRatingsZ.safeParse({ consonanceComputed: 3 }).success,
    ).toBe(false);
    expect(currentRevision({})).toBe(0);
    expect(currentRevision({ revision: 7 })).toBe(7);
  });
});
