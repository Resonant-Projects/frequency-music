import type { ModelRequest } from "./types.js";

/** Optional adapter prompt builder. Model routing and adaptive effort belong to
 * shared policy/the caller. No temperature override is applied here. */
export function tournamentPrompt(request: ModelRequest): string {
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
  return `${instructions[request.kind]}\n\n${JSON.stringify(request, null, 2)}`;
}
