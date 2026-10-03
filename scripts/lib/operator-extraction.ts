// Chunk files for operator extraction (scripts/operator-extraction.ts): an
// operator session reads the same extract_v2 prompt the worker would send
// to a model, writes the extraction JSON itself, and imports the results.
import {
  confidenceBandValidator,
  evidenceLevelValidator,
} from "../../convex/shared/claims.ts";
import {
  EXTRACT_SYSTEM_PROMPT,
  EXTRACTION_PROMPT_VERSION,
  renderExtractionPrompt,
} from "../../convex/shared/extractionPrompt.ts";

/** A row of sources.operatorExtractionPage. */
export type ExportRow = {
  sourceId: string;
  title?: string;
  canonicalUrl?: string;
  type: string;
  inputHash?: string;
  content: string;
  unextractable?: string;
};

export type ChunkItem = {
  sourceId: string;
  title: string;
  url: string;
  type: string;
  inputHash: string;
  prompt: string;
};

export type Chunk = {
  promptVersion: string;
  model: string;
  system: string;
  instructions: string;
  items: ChunkItem[];
};

/** Text the extraction gate refuses; `inputHash` is absent without text. */
export type Unextractable = {
  sourceId: string;
  reason: string;
  inputHash?: string;
};

export type ResultItem = {
  sourceId: string;
  inputHash: string;
  extraction: unknown;
};

const INSTRUCTIONS =
  "For each item, follow `system` and the item's `prompt` exactly as a model " +
  "would. Write a results file shaped as " +
  '{"model": <this chunk\'s model>, "results": [{"sourceId", "inputHash", ' +
  '"extraction": <the JSON object the prompt asks for>}]}, copying sourceId ' +
  "and inputHash from the item. Use only the evidence levels and low|medium|high " +
  "bands the prompt lists; omit an item rather than guess.";

/**
 * Splits exported text_ready Sources into chunk files. Sources whose text the
 * extraction gate refuses (feed excerpts, bot walls, near-empty captures) are
 * returned separately: they need no extraction.
 */
export function buildChunks(
  rows: ExportRow[],
  options: { model: string; chunkSize: number },
): { chunks: Chunk[]; unextractable: Unextractable[] } {
  const items: ChunkItem[] = [];
  const unextractable: Unextractable[] = [];
  for (const row of rows) {
    if (row.unextractable || !row.inputHash) {
      unextractable.push({
        sourceId: row.sourceId,
        reason: row.unextractable ?? "no text",
        ...(row.inputHash ? { inputHash: row.inputHash } : {}),
      });
      continue;
    }
    items.push({
      sourceId: row.sourceId,
      title: row.title || "Untitled",
      url: row.canonicalUrl || "",
      type: row.type,
      inputHash: row.inputHash,
      prompt: renderExtractionPrompt({
        title: row.title,
        canonicalUrl: row.canonicalUrl,
        content: row.content,
      }),
    });
  }
  const size = Math.max(1, Math.floor(options.chunkSize));
  const chunks: Chunk[] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push({
      promptVersion: EXTRACTION_PROMPT_VERSION,
      model: options.model,
      system: EXTRACT_SYSTEM_PROMPT,
      instructions: INSTRUCTIONS,
      items: items.slice(i, i + size),
    });
  }
  return { chunks, unextractable };
}

const EVIDENCE_LEVELS = new Set<unknown>(
  evidenceLevelValidator.members.map((member) => member.value),
);
const CONFIDENCE_BANDS = new Set<unknown>(
  confidenceBandValidator.members.map((member) => member.value),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const extraKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).filter((key) => !allowed.includes(key));

/**
 * Problems that would make extract.storeOperatorExtraction reject this
 * extraction body (its Convex validator, plus a non-empty summary).
 */
export function extractionProblems(extraction: unknown): string[] {
  if (!isRecord(extraction)) return ["extraction must be an object"];
  const problems: string[] = [];
  const extra = extraKeys(extraction, [
    "summary",
    "claims",
    "compositionParameters",
    "topics",
    "openQuestions",
  ]);
  if (extra.length) problems.push(`unknown fields: ${extra.join(", ")}`);
  if (typeof extraction.summary !== "string" || !extraction.summary.trim()) {
    problems.push("summary must be a non-empty string");
  }
  if (!isStringArray(extraction.topics))
    problems.push("topics must be strings");
  if (!isStringArray(extraction.openQuestions)) {
    problems.push("openQuestions must be strings");
  }
  if (!Array.isArray(extraction.claims)) {
    problems.push("claims must be an array");
  } else {
    extraction.claims.forEach((claim, index) => {
      const at = `claims[${index}]`;
      if (!isRecord(claim)) return problems.push(`${at} must be an object`);
      const extraClaim = extraKeys(claim, [
        "text",
        "evidenceLevel",
        "truthConfidence",
        "interestLevel",
        "citations",
      ]);
      if (extraClaim.length) {
        problems.push(`${at} unknown fields: ${extraClaim.join(", ")}`);
      }
      if (typeof claim.text !== "string") problems.push(`${at}.text`);
      if (!EVIDENCE_LEVELS.has(claim.evidenceLevel)) {
        problems.push(
          `${at}.evidenceLevel ${JSON.stringify(claim.evidenceLevel)}`,
        );
      }
      for (const band of ["truthConfidence", "interestLevel"] as const) {
        if (claim[band] !== undefined && !CONFIDENCE_BANDS.has(claim[band])) {
          problems.push(`${at}.${band} ${JSON.stringify(claim[band])}`);
        }
      }
      if (
        !Array.isArray(claim.citations) ||
        !claim.citations.every(
          (citation) =>
            isRecord(citation) &&
            extraKeys(citation, ["label", "url", "quote"]).length === 0 &&
            ["label", "url", "quote"].every(
              (key) =>
                citation[key] === undefined ||
                typeof citation[key] === "string",
            ),
        )
      ) {
        problems.push(`${at}.citations must be {label?, url?, quote?} strings`);
      }
      return undefined;
    });
  }
  if (!Array.isArray(extraction.compositionParameters)) {
    problems.push("compositionParameters must be an array");
  } else {
    extraction.compositionParameters.forEach((parameter, index) => {
      const at = `compositionParameters[${index}]`;
      if (!isRecord(parameter)) return problems.push(`${at} must be an object`);
      const extraParameter = extraKeys(parameter, [
        "kind",
        "type",
        "value",
        "details",
      ]);
      if (extraParameter.length) {
        problems.push(`${at} unknown fields: ${extraParameter.join(", ")}`);
      }
      if (typeof parameter.value !== "string") problems.push(`${at}.value`);
      for (const key of ["kind", "type"] as const) {
        if (
          parameter[key] !== undefined &&
          typeof parameter[key] !== "string"
        ) {
          problems.push(`${at}.${key}`);
        }
      }
      return undefined;
    });
  }
  return problems;
}

/**
 * Reads a results file. Shape errors name the entry; extractionProblems checks
 * each extraction body against the store action's contract.
 */
export function parseResults(
  text: string,
  expectedModel: string,
): { model: string; results: ResultItem[] } {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Results file must be a JSON object");
  }
  const { model, results } = parsed as { model?: unknown; results?: unknown };
  if (model !== expectedModel) {
    throw new Error(
      `Results file model ${JSON.stringify(model)} is not ${expectedModel}`,
    );
  }
  if (!Array.isArray(results)) {
    throw new Error("Results file needs a results array");
  }
  const seen = new Set<string>();
  return {
    model,
    results: results.map((entry, index) => {
      const item = entry as Partial<ResultItem> | null;
      if (
        !item ||
        typeof item.sourceId !== "string" ||
        typeof item.inputHash !== "string" ||
        !/^[0-9a-f]{64}$/.test(item.inputHash) ||
        !item.extraction ||
        typeof item.extraction !== "object"
      ) {
        throw new Error(
          `results[${index}] needs sourceId, a 64-hex inputHash and an extraction object`,
        );
      }
      if (seen.has(item.sourceId)) {
        throw new Error(`results[${index}] repeats source ${item.sourceId}`);
      }
      seen.add(item.sourceId);
      return {
        sourceId: item.sourceId,
        inputHash: item.inputHash,
        extraction: item.extraction,
      };
    }),
  };
}
