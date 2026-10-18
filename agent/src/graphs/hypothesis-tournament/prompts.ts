import type { ModelPrompt } from "../../models/promptCache.js";
import type { ModelRequest } from "./types.js";

/** The last top-level request key, where repeated calls start to differ:
 * the three scoring judges for a candidate differ only in `judgeIndex`.
 * Other kinds never repeat a prefix reliably, so they carry no breakpoint. */
const CACHE_SPLIT_KEY: Partial<Record<ModelRequest["kind"], string>> = {
  scoring: "judgeIndex",
};

/** Optional adapter prompt builder. Model routing and adaptive effort belong to
 * shared policy/the caller. No temperature override is applied here. */
export function tournamentPrompt(request: ModelRequest): ModelPrompt {
  const instructions: Record<ModelRequest["kind"], string> = {
    generation:
      "Draft one hypothesis: title, question, statement, rationale, whyThisMatters, concepts. Design a 30-90 second micro-study varying exactly ONE controllable musical variable. Make a falsifiable prediction with a concrete studio stake. Do not invent evidence or IDs.",
    grounding:
      "Return the full supplied hypothesis payload, rewriting only its rationale to cite every supplied evidence claim using exactly [claim:<id>], where <id> is its supplied claimId. Use no other citation syntax, bare IDs, or unread IDs. Do not overstate the claims. Preserve statement and all provenance IDs. Return no seed metadata.",
    scoring:
      "Independently score this hypothesis on a 0-5 scale for stake (changes what Keith would do in the studio), novelty (against the seed's own context), and falsifiability (a listening test could refute it). Return {stake, novelty, falsifiability}.",
    duplicate:
      "Compare the statements. Return {kind: duplicate|inversion|refinement}. Duplicate repeats the prediction; inversion reverses it; refinement changes its scope or precision. Only a duplicate is excluded.",
    finalist:
      "Compare studio stake, novelty, and falsifiability. Return {winner: left|right|tie}.",
    selfCheck:
      "Audit this hypothesis draft strictly before it consumes a human review slot. Pass only if all three conditions hold: 1. It is falsifiable in a 30-90 second micro-study. 2. It varies exactly ONE controllable musical variable. 3. Its rationale cites every supplied evidence claim using [claim:<id>] and contains no unread or bare IDs and does not overstate them. Return booleans for pass, testable, oneVariable, and evidenceGrounded plus concise revision feedback. Use the supplied seed context and evidence-aware context.",
    revision:
      "This is the single allowed revision. Return the full hypothesis payload, fixing the supplied self-check feedback. Keep the supplied provenance IDs and [claim:<id>] evidence citations, citing every supplied claim and no unread IDs or bare IDs; no new evidence. Design a 30-90 second test of exactly one variable. Return no seed metadata.",
  };
  // Statement vectors and archive bookkeeping are not model context.
  const context = JSON.stringify(
    request,
    (key, value) =>
      key === "statementEmbedding" || key === "agentRunId" ? undefined : value,
    2,
  );
  const text = `${instructions[request.kind]}\n\n${context}`;
  const key = CACHE_SPLIT_KEY[request.kind];
  // Two-space indent marks a top-level key; JSON escapes newlines in values.
  const cut = key === undefined ? -1 : text.lastIndexOf(`,\n  "${key}":`);
  return cut < 0 ? text : { shared: text.slice(0, cut), rest: text.slice(cut) };
}
