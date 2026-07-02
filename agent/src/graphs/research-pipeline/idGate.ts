import type { ResearchPipelineDraftPayload } from "../../state/researchPipelineState.js";

/**
 * Hallucinated-ID gate (pure, unit-testable).
 *
 * A promotable draft payload may only reference Convex ids that the run
 * actually READ (accumulated into `state.seenIds`). If the model fabricates a
 * source/extraction/hypothesis/thesis id — a classic hallucination — the run
 * must fail loudly rather than persist a draft that would poison the review
 * queue with references to non-existent rows.
 */

/**
 * Collect every id-like value a payload references, regardless of which draft
 * shape it is. Reads the known reference fields defensively so a malformed
 * payload cannot slip an unchecked id through.
 */
export function collectPayloadIds(
  payload: ResearchPipelineDraftPayload,
): string[] {
  const record = payload as unknown as Record<string, unknown>;
  const ids: string[] = [];

  const pushString = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) ids.push(value);
  };
  const pushArray = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(pushString);
  };

  // hypothesis_draft references
  pushArray(record.sourceIds);
  pushArray(record.extractionIds);
  pushString(record.thesisId);
  // recipe_draft references
  pushString(record.hypothesisId);

  return ids;
}

/**
 * Return the de-duplicated list of payload ids that are NOT present in the set
 * of ids the run actually read. Empty result means the payload is clean.
 */
export function findHallucinatedIds(
  payload: ResearchPipelineDraftPayload,
  seenIds: string[],
): string[] {
  const seen = new Set(seenIds);
  const flagged: string[] = [];
  const emitted = new Set<string>();
  for (const id of collectPayloadIds(payload)) {
    if (!seen.has(id) && !emitted.has(id)) {
      emitted.add(id);
      flagged.push(id);
    }
  }
  return flagged;
}

/**
 * Build the loud, human-readable error pushed to `state.errors` when the gate
 * trips. finalizeRunNode treats any error as fatal and marks the run failed
 * (never persisting the draft).
 */
export function hallucinatedIdError(hallucinatedIds: string[]): string {
  return (
    `Hallucinated-ID gate: draft payload references ${hallucinatedIds.length} id(s) ` +
    `not read during this run: ${hallucinatedIds.join(", ")}. ` +
    `Refusing to persist draft.`
  );
}
