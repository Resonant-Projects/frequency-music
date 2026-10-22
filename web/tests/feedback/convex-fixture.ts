// FIXTURE: synthetic Convex adapter for the isolated audio-feedback harness.
// No ConvexClient is constructed and no backend is contacted.
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { createMemo, createSignal } from "solid-js";
import { stableStringify } from "../../../convex/shared/stableHash";
import type { QueryStatus } from "../../src/integrations/convex/query";
export { describeError } from "../../src/integrations/convex/errors";
export { describeLoad } from "../../src/integrations/convex/query";

export type FixtureState = "ready" | "loading" | "error" | "empty";
// "lost": the server commits the rating, then the response never arrives.
export type MutationMode = "ok" | "stale" | "network" | "hold" | "lost";
export const [state, setState] = createSignal<FixtureState>("ready");
export const [mode, setMode] = createSignal<MutationMode>("ok");
export const [removed, setRemoved] = createSignal<string[]>([]);
export const [renderHash, setRenderHash] = createSignal("render-hash");
export const calls: { name: string; args: unknown }[] = [];
// Server-side ratings by request ID, as audioFeedback.submit stores them.
export const committed: { requestId: string; fingerprint: string }[] = [];
let release: (() => void) | null = null;
export function releaseHeld() {
  release?.();
  release = null;
}

const HASH = "a".repeat(64);
const queueItems = [
  {
    artifactId: "render-one",
    kind: "litmusRender",
    title: "Litmus render: 7-limit triad drift",
    durationSecs: 42,
    engineName: "supercollider",
    validation: "unvalidated",
    get contentHash() {
      return renderHash();
    },
    docketContentHash: "c".repeat(64),
    deferrable: true,
    createdAt: Date.UTC(2026, 9, 12, 18),
  },
  {
    artifactId: "episode-one",
    kind: "episode",
    title: "Weekly Turn episode, October 5",
    durationSecs: 1460,
    contentHash: "episode-hash",
    docketContentHash: "d".repeat(64),
    deferrable: true,
    createdAt: Date.UTC(2026, 9, 5, 12),
  },
];
const cards = [
  {
    kind: "pendingDraft",
    targetId: "draft-one",
    title: "Hypothesis draft: just-intonation fatigue",
    blurbMd:
      "A pending draft proposes that listeners tire sooner of pure fifths.",
    spokenBlurb: "",
    pageUrl: "/agent-drafts?draft=draft-one",
    decisions: ["approve", "reject", "supersede", "defer"],
    contentHash: HASH,
    rank: 0,
    debtSince: Date.UTC(2026, 9, 1),
  },
  {
    kind: "recipeNoComposition",
    targetId: "recipe-one",
    title: "Recipe: slow beating study",
    blurbMd: "Two sustained tones a few cents apart, no composition yet.",
    spokenBlurb: "",
    pageUrl: "/recipes/recipe-one",
    decisions: ["defer"],
    contentHash: "b".repeat(64),
    rank: 1,
    debtSince: Date.UTC(2026, 9, 2),
  },
  {
    kind: "unratedAudio",
    targetId: "render-one",
    title: "Litmus render: 7-limit triad drift",
    blurbMd: "Human audio rating is pending.",
    spokenBlurb: "",
    pageUrl: "/listen?audio=render-one",
    decisions: ["rateAudio", "defer"],
    contentHash: "c".repeat(64),
    rank: 2,
    debtSince: Date.UTC(2026, 9, 12),
  },
];

// Docket links to audio outside the queue window. One is already rated, so
// the server would refuse to defer it.
const linkedItems = {
  "old-episode": {
    artifactId: "old-episode",
    kind: "episode",
    title: "Older episode outside the queue",
    durationSecs: 900,
    contentHash: "old-hash",
    docketContentHash: "e".repeat(64),
    deferrable: true,
    createdAt: Date.UTC(2026, 6, 1),
  },
  "rated-episode": {
    artifactId: "rated-episode",
    kind: "episode",
    title: "Episode you already rated",
    durationSecs: 600,
    contentHash: "rated-hash",
    docketContentHash: "f".repeat(64),
    deferrable: false,
    createdAt: Date.UTC(2026, 5, 1),
  },
};

export function createQueryWithStatus<Q extends FunctionReference<"query">>(
  query: Q,
  args: () => FunctionArgs<Q> | "skip",
): QueryStatus<FunctionReturnType<Q>> {
  const name = getFunctionName(query);
  const data = createMemo(() => {
    const input = args();
    if (input === "skip") return undefined;
    const current = state();
    const gone = new Set(removed());
    if (current === "loading" || current === "error") return undefined;
    let value: unknown;
    if (name === "listen:shootouts") value = [];
    // The /listen studio section (#155): no comparisons or machine baselines.
    else if (
      name === "studioComparisons:list" ||
      name === "studioComparisons:machineCandidates"
    )
      value = [];
    else if (name === "podcast:subscription")
      value = { configured: false, reason: "missing_token" };
    else if (name === "settings:houseVoice") value = { voiceId: "inworld-max" };
    else if (name === "audioFeedback:queue")
      value =
        current === "empty"
          ? []
          : queueItems
              .filter((row) => !gone.has(row.artifactId))
              .map((row) => ({ ...row }));
    else if (name === "audioFeedback:item") {
      const id = (input as { artifactId: string }).artifactId;
      value =
        id in linkedItems && !gone.has(id)
          ? linkedItems[id as keyof typeof linkedItems]
          : null;
    } else if (name === "audioArtifacts:playback")
      value = {
        url: "/synthetic-audio.mp3",
        mimeType: "audio/mpeg",
        durationSecs: 42,
      };
    else if (name === "docket:listWeb")
      value =
        current === "empty"
          ? []
          : cards.filter((row) => !gone.has(row.targetId));
    else throw new Error(`Unexpected query ${name}`);
    return value as FunctionReturnType<Q>;
  });
  return {
    data,
    error: () =>
      state() === "error" ? new Error("Authentication required") : null,
    isError: () => state() === "error",
    isLoading: () => state() === "loading",
  };
}

// The studio upload form binds an action at mount; the fixture never runs one.
export function createAction<A extends FunctionReference<"action">>(
  action: A,
): (args?: FunctionArgs<A>) => Promise<FunctionReturnType<A>> {
  const name = getFunctionName(action);
  return async (args?: FunctionArgs<A>) => {
    calls.push({ name, args });
    throw new Error(`Unexpected action ${name}`);
  };
}

export function createMutation<M extends FunctionReference<"mutation">>(
  mutation: M,
): (args?: FunctionArgs<M>) => Promise<FunctionReturnType<M>> {
  const name = getFunctionName(mutation);
  return async (args?: FunctionArgs<M>) => {
    calls.push({ name, args });
    const current = mode();
    if (current === "network") throw new Error("Failed to fetch");
    if (current === "stale")
      throw new ConvexError(
        name === "audioFeedback:submit"
          ? "This audio changed since you opened it. Reload and listen again."
          : "Docket card changed or is no longer eligible",
      );
    if (current === "hold")
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    const input = args as Record<string, unknown>;
    const target = String(input.artifactId ?? input.targetId);
    let replayed = false;
    if (name === "audioFeedback:submit") {
      const requestId = String(input.clientRequestId);
      const fingerprint = stableStringify({
        contentHash: input.contentHash,
        payload: input.payload,
      });
      const prior = committed.find((row) => row.requestId === requestId);
      if (prior && prior.fingerprint !== fingerprint)
        throw new ConvexError(
          "This request ID was already used for a different rating.",
        );
      replayed = prior !== undefined;
      if (!prior) committed.push({ requestId, fingerprint });
      if (current === "lost") throw new Error("Failed to fetch");
    }
    setRemoved((all) => [...all, target]);
    return (
      name === "audioFeedback:submit"
        ? { ratingId: "rating-one", replayed }
        : { status: "applied", appliedRecordId: "card-one" }
    ) as FunctionReturnType<M>;
  };
}
