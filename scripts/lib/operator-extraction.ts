// Chunk files for operator extraction (scripts/operator-extraction.ts): an
// operator session reads the same extract_v2 prompt the worker would send
// to a model, writes the extraction JSON itself, and imports the results.
import {
  EXTRACT_SYSTEM_PROMPT,
  EXTRACTION_PROMPT_VERSION,
  extractionInputHash,
  renderExtractionPrompt,
} from "../../convex/shared/extractionPrompt.ts";
import { unextractableTextReason } from "../../convex/shared/sourceText.ts";

export type ExportableSource = {
  _id: string;
  title?: string;
  canonicalUrl?: string;
  type?: string;
  rawText?: string;
  transcript?: string;
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
 * Splits text_ready Sources into chunk files. Sources whose text the
 * extraction gate would refuse (feed excerpts, bot walls, near-empty
 * captures) are returned separately: they need no extraction.
 */
export async function buildChunks(
  sources: ExportableSource[],
  options: { model: string; chunkSize: number },
): Promise<{ chunks: Chunk[]; unextractable: Unextractable[] }> {
  const items: ChunkItem[] = [];
  const unextractable: Unextractable[] = [];
  for (const source of sources) {
    const content = source.rawText || source.transcript;
    if (!content) {
      unextractable.push({ sourceId: source._id, reason: "no text" });
      continue;
    }
    const reason = unextractableTextReason(content);
    if (reason) {
      unextractable.push({
        sourceId: source._id,
        reason,
        inputHash: await extractionInputHash(content),
      });
      continue;
    }
    items.push({
      sourceId: source._id,
      title: source.title || "Untitled",
      url: source.canonicalUrl || "",
      type: source.type || "",
      inputHash: await extractionInputHash(content),
      prompt: renderExtractionPrompt({
        title: source.title,
        canonicalUrl: source.canonicalUrl,
        content,
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

/**
 * Reads a results file. Shape errors name the entry; the extraction body is
 * validated by Convex when it is stored.
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
