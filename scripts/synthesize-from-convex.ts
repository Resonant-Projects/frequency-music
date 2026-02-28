#!/usr/bin/env bun
/**
 * Build a topic-diverse multi-source synthesis context from Convex data,
 * then optionally publish a finalized hypothesis+recipe payload to Convex.
 *
 * This script intentionally does NOT call Convex AI generation actions.
 *
 * Usage:
 *   bun scripts/synthesize-from-convex.ts collect --target 6 --fetch 120 --min-claims 2 --min-params 1 --out data/generated/synthesis
 *   bun scripts/synthesize-from-convex.ts publish --input data/generated/synthesis/<timestamp>/final-output.json
 *   bun scripts/synthesize-from-convex.ts full --target 8 --fetch 180 --min-claims 2 --min-params 1 --out data/generated/synthesis
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

type Mode = "collect" | "publish" | "full";

type SourceStatus =
  | "ingested"
  | "text_ready"
  | "extracting"
  | "extracted"
  | "review_needed"
  | "triaged"
  | "promoted_followers"
  | "promoted_public"
  | "archived";

const USABLE_STATUSES = new Set<SourceStatus>([
  "extracted",
  "review_needed",
  "triaged",
  "promoted_followers",
  "promoted_public",
]);

const GENERIC_TOPIC_TOKENS = new Set([
  "auto ingested",
  "auto-ingested",
  "ingested",
  "source",
  "sources",
  "url",
  "rss",
  "youtube",
  "pdf",
  "notion",
  "article",
  "articles",
  "full article",
  "web clip",
  "frequency research",
  "frequency-research",
  "research",
  "music",
]);

const STRONG_DOMAIN_KEYWORDS = [
  "tuning",
  "intonation",
  "temperament",
  "harmony",
  "harmonic",
  "chord",
  "interval",
  "scale",
  "microton",
  "consonance",
  "dissonance",
  "daw",
  "healing",
  "wellbeing",
  "well being",
  "physiology",
  "nervous system",
  "autonomic",
  "stress",
  "recovery",
  "somatic",
  "body",
  "pain",
  "sleep",
  "hrv",
];

const WEAK_DOMAIN_KEYWORDS = [
  "music",
  "frequency",
  "acoustic",
  "acoustics",
  "sound",
  "resonance",
  "rhythm",
  "melody",
  "perception",
  "emotion",
  "attention",
  "calm",
  "relaxation",
  "breath",
  "meditation",
];

const SELECTION_WEIGHTS = {
  base: 0.3,
  novelty: 0.18,
  crossRunNovelty: 0.22,
  domainRelevance: 0.15,
  topicalBalance: 0.15,
} as const;
const DEFAULT_TEMPO_BPM = 120;

type JsonRecord = Record<string, unknown>;

interface Claim {
  text: string;
  evidenceLevel: string;
  citations?: Array<{
    label?: string;
    url?: string;
    quote?: string;
  }>;
}

interface CompositionParameter {
  type: string;
  value: string;
  details?: unknown;
}

interface ExtractionLike {
  _id: string;
  _creationTime?: number;
  sourceId: string;
  summary: string;
  claims: Claim[];
  compositionParameters: CompositionParameter[];
  topics: string[];
  openQuestions?: string[];
  confidence?: number;
  model?: string;
  promptVersion?: string;
  createdAt?: number;
}

interface SourceLike {
  _id: string;
  type: string;
  status: SourceStatus;
  title?: string;
  canonicalUrl?: string;
  tags?: string[];
  topics?: string[];
  author?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface CandidateExtraction {
  extraction: ExtractionLike;
  source: SourceLike;
  topicTokens: string[];
  topicTokenSet: Set<string>;
  distinctParameterTypes: number;
  peerReviewedClaims: number;
  baseScore: number;
  normalizedBaseScore: number;
  noveltyScore: number;
  crossRunNoveltyScore: number;
  sourceReusePenalty: number;
  topicReusePenalty: number;
  domainRelevanceScore: number;
  topicalBalanceScore: number;
  combinedScore: number;
}

export interface SelectedExtractionV1 {
  citation: string;
  extractionId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  sourceStatus: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  extractionCreatedAt?: number;
  extractionSummary: string;
  topics: string[];
  topicTokens: string[];
  claims: Claim[];
  compositionParameters: CompositionParameter[];
  openQuestions: string[];
  scores: {
    base: number;
    normalizedBase: number;
    novelty: number;
    crossRunNovelty: number;
    sourceReusePenalty: number;
    topicReusePenalty: number;
    domainRelevance: number;
    topicalBalance: number;
    combined: number;
    peerReviewedClaims: number;
    distinctParameterTypes: number;
  };
}

export interface SynthesisContextV1 {
  version: "synthesis_context_v1";
  generatedAt: string;
  mode: "collect";
  convexUrlHost: string;
  params: {
    target: number;
    fetch: number;
    minClaims: number;
    minParams: number;
    out: string;
    noveltyWindow: number;
    maxReusedSources: number;
    requireTuningSignal: boolean;
  };
  totals: {
    fetchedExtractions: number;
    withSource: number;
    eligibleCandidates: number;
    selected: number;
  };
  selected: SelectedExtractionV1[];
  aggregate: {
    topicFrequency: Record<string, number>;
    parameterTypeFrequency: Record<string, number>;
    evidenceDistribution: Record<string, number>;
    sourceTypeDistribution: Record<string, number>;
  };
  noveltyHistory: {
    runsScanned: number;
    priorSourceIds: number;
    priorTopicTokens: number;
    priorVariablePhrases: number;
    priorTitlePhrases: number;
  };
}

interface FinalHypothesisV1 {
  title: string;
  question: string;
  hypothesis: string;
  rationaleMd: string;
  sourceIds: string[];
  concepts?: string[];
}

interface FinalRecipeProtocolV1 {
  studyType: "litmus" | "comparison";
  durationSecs: number;
  panelPlanned: string[];
  listeningContext?: string;
  listeningMethod?: string;
  baselineArtifactId?: string;
  whatVaries: string[];
  whatStaysConstant: string[];
}

interface FinalRecipeV1 {
  title: string;
  bodyMd: string;
  parameters: CompositionParameter[];
  dawChecklist: string[];
  protocol?: FinalRecipeProtocolV1;
}

export interface FinalOutputV1 {
  version: "final_output_v1";
  hypothesis: FinalHypothesisV1;
  recipe: FinalRecipeV1;
  citations?: string[];
  notes?: string;
}

interface CollectOptions {
  target: number;
  fetch: number;
  minClaims: number;
  minParams: number;
  out: string;
  noveltyWindow: number;
  maxReusedSources: number;
  requireTuningSignal: boolean;
}

interface PublishOptions {
  input: string;
}

interface FullOptions extends CollectOptions {
  outputName: string;
}

interface CollectArtifacts {
  outBase: string;
  contextJsonPath: string;
  contextMdPath: string;
  assistantBriefPath: string;
  templatePath: string;
  context: SynthesisContextV1;
}

interface PublishResult {
  hypothesisId: string;
  recipeId: string;
  receiptPath: string;
}

interface NoveltyHistory {
  sourceIds: Set<string>;
  topicTokens: Set<string>;
  variablePhrases: Set<string>;
  titlePhrases: Set<string>;
  runsScanned: number;
}

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/synthesize-from-convex.ts [collect] [--target N] [--fetch N] [--min-claims N] [--min-params N] [--novelty-window N] [--max-reused-sources N] [--allow-broad-domain] [--out PATH]",
    "  bun scripts/synthesize-from-convex.ts publish --input PATH_TO_FINAL_OUTPUT_JSON",
    "  bun scripts/synthesize-from-convex.ts full [--target N] [--fetch N] [--min-claims N] [--min-params N] [--novelty-window N] [--max-reused-sources N] [--allow-broad-domain] [--out PATH] [--output-name NAME]",
    "",
    "Modes:",
    "  collect (default)  Pull, rank, diversify, and emit synthesis context artifacts.",
    "  publish            Validate and publish finalized hypothesis+recipe via create mutations.",
    "  full               Run collect -> auto-synthesize -> publish -> verify in one uninterrupted command.",
  ].join("\n");
}

function fail(message: string): never {
  throw new Error(message);
}

function parseNumberFlag(
  args: string[],
  flag: string,
  defaultValue: number,
): number {
  const idx = args.indexOf(flag);
  if (idx === -1) return defaultValue;
  const raw = args[idx + 1];
  if (!raw) fail(`Missing value for ${flag}`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`Invalid ${flag} value "${raw}". Expected a positive integer.`);
  }
  return parsed;
}

function parseStringFlag(
  args: string[],
  flag: string,
  defaultValue?: string,
): string {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    if (defaultValue === undefined) fail(`Missing required flag ${flag}`);
    return defaultValue;
  }
  const raw = args[idx + 1];
  if (!raw) fail(`Missing value for ${flag}`);
  return raw;
}

function parseModeAndArgs(argv: string[]): { mode: Mode; args: string[] } {
  if (argv.length === 0) return { mode: "collect", args: [] };
  const head = argv[0];
  if (head === "collect" || head === "publish" || head === "full") {
    return { mode: head, args: argv.slice(1) };
  }
  return { mode: "collect", args: argv };
}

function normalizeTopicToken(value: string): string[] {
  return value
    .split(/[|,/;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0)
    .map((v) => v.replace(/\s+/g, " "));
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningfulTopicToken(value: string): boolean {
  const normalized = normalizePhrase(value);
  if (normalized.length < 4) return false;
  if (GENERIC_TOPIC_TOKENS.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return true;
}

function isTuningCentricLabel(value: string): boolean {
  const normalized = normalizePhrase(value);
  return (
    normalized.includes("tuning") ||
    normalized.includes("intonation") ||
    normalized.includes("temperament") ||
    normalized.includes("just intonation") ||
    normalized.includes("equal temperament") ||
    normalized.includes("meantone") ||
    normalized.includes("comma")
  );
}

function computeDomainRelevance(candidate: {
  source: SourceLike;
  extraction: ExtractionLike;
  topicTokens: string[];
}): number {
  const corpus = normalizePhrase(
    [
      candidate.source.title ?? "",
      candidate.extraction.summary ?? "",
      ...candidate.topicTokens,
      ...candidate.extraction.compositionParameters.map((p) => p.type),
      ...candidate.extraction.compositionParameters.map((p) => p.value),
    ].join(" "),
  );

  let strongMatches = 0;
  let weakMatches = 0;
  for (const keyword of STRONG_DOMAIN_KEYWORDS) {
    if (corpus.includes(keyword)) strongMatches += 1;
  }
  for (const keyword of WEAK_DOMAIN_KEYWORDS) {
    if (corpus.includes(keyword)) weakMatches += 1;
  }

  const score = Math.min(1, strongMatches * 0.22 + weakMatches * 0.1);
  return score;
}

function isLikelyTestArtifact(candidate: {
  source: SourceLike;
  extraction: ExtractionLike;
}): boolean {
  const combined = normalizePhrase(
    [
      candidate.source.title ?? "",
      candidate.source.canonicalUrl ?? "",
      candidate.extraction.summary ?? "",
      ...(candidate.source.tags ?? []),
      ...(candidate.extraction.topics ?? []),
    ].join(" "),
  );

  return (
    /\be2e\b/.test(combined) ||
    combined.includes("test payload") ||
    combined.includes("placeholder") ||
    combined.includes("system generated metadata")
  );
}

function hasTuningSignal(candidate: {
  extraction: ExtractionLike;
  topicTokens: string[];
}): boolean {
  const paramSignal = candidate.extraction.compositionParameters.some(
    (param) => {
      const normalizedType = normalizePhrase(param.type);
      const normalizedValue = normalizePhrase(param.value);
      return (
        isTuningCentricLabel(normalizedType) ||
        isTuningCentricLabel(normalizedValue)
      );
    },
  );
  if (paramSignal) return true;

  const topicSignal = candidate.topicTokens.some((topic) => {
    return isTuningCentricLabel(topic);
  });

  return topicSignal;
}

function buildTopicFrequency(
  candidates: CandidateExtraction[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const token of candidate.topicTokenSet) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

function computeTopicalBalanceScore(input: {
  candidate: CandidateExtraction;
  globalTopicCounts: Map<string, number>;
  selectedTopicCounts: Map<string, number>;
  selectedCount: number;
  candidatePoolSize: number;
}): number {
  const {
    candidate,
    globalTopicCounts,
    selectedTopicCounts,
    selectedCount,
    candidatePoolSize,
  } = input;
  const tokens = [...candidate.topicTokenSet].filter((token) =>
    isMeaningfulTopicToken(token),
  );
  if (tokens.length === 0) return 0.25;

  const rarityScores = tokens.map((token) => {
    const globalFreq = globalTopicCounts.get(token) ?? 1;
    const rarity =
      Math.log((candidatePoolSize + 1) / globalFreq) /
      Math.log(candidatePoolSize + 1);
    return Math.max(0, Math.min(1, rarity));
  });
  const globalRarity =
    rarityScores.reduce((sum, value) => sum + value, 0) /
    Math.max(1, rarityScores.length);

  if (selectedCount === 0) return globalRarity;

  const unseenShare =
    tokens.filter((token) => !selectedTopicCounts.has(token)).length /
    tokens.length;
  const saturationPenalty =
    tokens.reduce((sum, token) => {
      const selectedFreq = selectedTopicCounts.get(token) ?? 0;
      return sum + selectedFreq / selectedCount;
    }, 0) / tokens.length;
  const freshness = 1 - Math.max(0, Math.min(1, saturationPenalty));

  return 0.45 * globalRarity + 0.35 * unseenShare + 0.2 * freshness;
}

function emptyNoveltyHistory(): NoveltyHistory {
  return {
    sourceIds: new Set<string>(),
    topicTokens: new Set<string>(),
    variablePhrases: new Set<string>(),
    titlePhrases: new Set<string>(),
    runsScanned: 0,
  };
}

async function readJsonIfExists(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

function addPhrasesToSet(
  phrases: string[] | undefined,
  destination: Set<string>,
  splitIntoTokens = false,
) {
  if (!phrases) return;
  for (const phrase of phrases) {
    const normalized = normalizePhrase(phrase);
    if (normalized.length === 0) continue;
    destination.add(normalized);
    if (splitIntoTokens) {
      for (const token of normalizeTopicToken(normalized)) {
        destination.add(token);
      }
    }
  }
}

async function loadNoveltyHistory(
  outputRootPath: string,
  noveltyWindow: number,
): Promise<NoveltyHistory> {
  const history = emptyNoveltyHistory();
  const absoluteRoot = resolve(process.cwd(), outputRootPath);
  let dirs: string[] = [];

  try {
    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    dirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse()
      .slice(0, noveltyWindow);
  } catch {
    return history;
  }

  for (const dirName of dirs) {
    const dirPath = join(absoluteRoot, dirName);
    history.runsScanned += 1;

    const finalOutput =
      (await readJsonIfExists(join(dirPath, "final-output.auto.json"))) ??
      (await readJsonIfExists(join(dirPath, "final-output.json")));
    if (
      finalOutput &&
      typeof finalOutput === "object" &&
      !Array.isArray(finalOutput)
    ) {
      const row = finalOutput as JsonRecord;
      const hypothesis =
        row.hypothesis &&
        typeof row.hypothesis === "object" &&
        !Array.isArray(row.hypothesis)
          ? (row.hypothesis as JsonRecord)
          : undefined;
      const recipe =
        row.recipe &&
        typeof row.recipe === "object" &&
        !Array.isArray(row.recipe)
          ? (row.recipe as JsonRecord)
          : undefined;

      if (hypothesis) {
        addPhrasesToSet(
          typeof hypothesis.title === "string" ? [hypothesis.title] : undefined,
          history.titlePhrases,
        );
        addPhrasesToSet(
          typeof hypothesis.question === "string"
            ? [hypothesis.question]
            : undefined,
          history.titlePhrases,
        );
        const sourceIds = Array.isArray(hypothesis.sourceIds)
          ? hypothesis.sourceIds.filter((id) => typeof id === "string")
          : [];
        for (const sourceId of sourceIds) {
          history.sourceIds.add(sourceId);
        }

        const concepts = Array.isArray(hypothesis.concepts)
          ? hypothesis.concepts.filter((value) => typeof value === "string")
          : [];
        addPhrasesToSet(concepts, history.topicTokens, true);
      }

      if (recipe) {
        const protocol =
          recipe.protocol &&
          typeof recipe.protocol === "object" &&
          !Array.isArray(recipe.protocol)
            ? (recipe.protocol as JsonRecord)
            : undefined;
        const whatVaries = Array.isArray(protocol?.whatVaries)
          ? protocol?.whatVaries.filter((value) => typeof value === "string")
          : [];
        addPhrasesToSet(whatVaries, history.variablePhrases);
      }
    }

    const contextJson = await readJsonIfExists(join(dirPath, "context.json"));
    if (
      contextJson &&
      typeof contextJson === "object" &&
      !Array.isArray(contextJson)
    ) {
      const row = contextJson as JsonRecord;
      const selected = Array.isArray(row.selected) ? row.selected : [];
      for (const source of selected) {
        if (!source || typeof source !== "object" || Array.isArray(source))
          continue;
        const sourceRow = source as JsonRecord;
        const sourceId = sourceRow.sourceId;
        if (typeof sourceId === "string") history.sourceIds.add(sourceId);
        const topicTokens = Array.isArray(sourceRow.topicTokens)
          ? sourceRow.topicTokens.filter((token) => typeof token === "string")
          : [];
        for (const token of topicTokens) {
          const normalized = normalizePhrase(token);
          if (normalized.length > 0 && isMeaningfulTopicToken(normalized)) {
            history.topicTokens.add(normalized);
          }
        }
      }
    }
  }

  return history;
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizedScore(base: number, min: number, max: number): number {
  if (max === min) return 1;
  return (base - min) / (max - min);
}

function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function ensureObject(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${label} must be a non-empty array`);
  }
  const out = value.map((entry, idx) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      fail(`${label}[${idx}] must be a non-empty string`);
    }
    return entry.trim();
  });
  return out;
}

function coerceClaims(value: unknown): Claim[] {
  if (!Array.isArray(value)) return [];
  const claims: Claim[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const claimObj = row as JsonRecord;
    const textRaw = claimObj.text;
    const evidenceRaw = claimObj.evidenceLevel;
    if (typeof textRaw !== "string" || typeof evidenceRaw !== "string")
      continue;
    claims.push({
      text: textRaw,
      evidenceLevel: evidenceRaw,
      citations: Array.isArray(claimObj.citations)
        ? (claimObj.citations as Claim["citations"])
        : undefined,
    });
  }
  return claims;
}

function coerceParameters(value: unknown): CompositionParameter[] {
  if (!Array.isArray(value)) return [];
  const params: CompositionParameter[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const paramObj = row as JsonRecord;
    if (
      typeof paramObj.type !== "string" ||
      typeof paramObj.value !== "string"
    ) {
      continue;
    }
    params.push({
      type: paramObj.type,
      value: paramObj.value,
      details: paramObj.details,
    });
  }
  return params;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function coerceExtraction(value: unknown): ExtractionLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonRecord;
  if (typeof row._id !== "string" || typeof row.sourceId !== "string")
    return null;
  return {
    _id: row._id,
    _creationTime:
      typeof row._creationTime === "number" ? row._creationTime : undefined,
    sourceId: row.sourceId,
    summary: typeof row.summary === "string" ? row.summary : "",
    claims: coerceClaims(row.claims),
    compositionParameters: coerceParameters(row.compositionParameters),
    topics: coerceStringArray(row.topics),
    openQuestions: coerceStringArray(row.openQuestions),
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
    promptVersion:
      typeof row.promptVersion === "string" ? row.promptVersion : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : undefined,
  };
}

function coerceSource(value: unknown): SourceLike | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonRecord;
  if (typeof row._id !== "string" || typeof row.type !== "string") return null;
  const status =
    typeof row.status === "string" && isSourceStatus(row.status)
      ? row.status
      : "ingested";
  return {
    _id: row._id,
    type: row.type,
    status,
    title: typeof row.title === "string" ? row.title : undefined,
    canonicalUrl:
      typeof row.canonicalUrl === "string" ? row.canonicalUrl : undefined,
    tags: coerceStringArray(row.tags),
    topics: coerceStringArray(row.topics),
    author: typeof row.author === "string" ? row.author : undefined,
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : undefined,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : undefined,
  };
}

function isSourceStatus(value: string): value is SourceStatus {
  return (
    value === "ingested" ||
    value === "text_ready" ||
    value === "extracting" ||
    value === "extracted" ||
    value === "review_needed" ||
    value === "triaged" ||
    value === "promoted_followers" ||
    value === "promoted_public" ||
    value === "archived"
  );
}

function extractionCreatedAt(extraction: ExtractionLike): number {
  if (typeof extraction.createdAt === "number") return extraction.createdAt;
  if (typeof extraction._creationTime === "number") {
    return Math.floor(extraction._creationTime);
  }
  return 0;
}

function buildContextMarkdown(context: SynthesisContextV1): string {
  const lines: string[] = [];
  lines.push("# Multi-Source Synthesis Context");
  lines.push("");
  lines.push(`Generated at: ${context.generatedAt}`);
  lines.push(
    `Selected ${context.totals.selected}/${context.params.target} from ${context.totals.eligibleCandidates} eligible candidates.`,
  );
  lines.push("");
  lines.push("## Selection Parameters");
  lines.push("");
  lines.push(`- Fetch limit: ${context.params.fetch}`);
  lines.push(`- Target selections: ${context.params.target}`);
  lines.push(`- Minimum claims: ${context.params.minClaims}`);
  lines.push(`- Minimum composition parameters: ${context.params.minParams}`);
  lines.push(`- Cross-run novelty window: ${context.params.noveltyWindow}`);
  lines.push(
    `- Max reused sources from novelty window: ${context.params.maxReusedSources}`,
  );
  lines.push(
    `- Require tuning/intonation signal: ${context.params.requireTuningSignal}`,
  );
  lines.push("");
  lines.push("## Novelty History");
  lines.push("");
  lines.push(`- Prior runs scanned: ${context.noveltyHistory.runsScanned}`);
  lines.push(
    `- Prior source IDs tracked: ${context.noveltyHistory.priorSourceIds}`,
  );
  lines.push(
    `- Prior topic tokens tracked: ${context.noveltyHistory.priorTopicTokens}`,
  );
  lines.push(
    `- Prior variable phrases tracked: ${context.noveltyHistory.priorVariablePhrases}`,
  );
  lines.push(
    `- Prior title phrases tracked: ${context.noveltyHistory.priorTitlePhrases}`,
  );
  lines.push("");
  lines.push("## Aggregate Signals");
  lines.push("");
  lines.push("### Topic Frequency");
  for (const [topic, count] of Object.entries(
    context.aggregate.topicFrequency,
  )) {
    lines.push(`- ${topic}: ${count}`);
  }
  lines.push("");
  lines.push("### Parameter Type Frequency");
  for (const [paramType, count] of Object.entries(
    context.aggregate.parameterTypeFrequency,
  )) {
    lines.push(`- ${paramType}: ${count}`);
  }
  lines.push("");
  lines.push("### Evidence Distribution");
  for (const [evidence, count] of Object.entries(
    context.aggregate.evidenceDistribution,
  )) {
    lines.push(`- ${evidence}: ${count}`);
  }
  lines.push("");
  lines.push("## Selected Sources");
  lines.push("");

  for (const item of context.selected) {
    lines.push(`### ${item.citation} — ${item.sourceTitle}`);
    lines.push("");
    lines.push(`- Source ID: ${item.sourceId}`);
    lines.push(`- Extraction ID: ${item.extractionId}`);
    lines.push(`- Type: ${item.sourceType}`);
    lines.push(`- Status: ${item.sourceStatus}`);
    if (item.sourceUrl) lines.push(`- URL: ${item.sourceUrl}`);
    if (item.sourceAuthor) lines.push(`- Author: ${item.sourceAuthor}`);
    lines.push(
      `- Scores: base=${item.scores.base.toFixed(2)}, normalized=${item.scores.normalizedBase.toFixed(3)}, intraNovelty=${item.scores.novelty.toFixed(3)}, crossRunNovelty=${item.scores.crossRunNovelty.toFixed(3)}, topicalBalance=${item.scores.topicalBalance.toFixed(3)}, combined=${item.scores.combined.toFixed(3)}`,
    );
    lines.push(`- Domain relevance: ${item.scores.domainRelevance.toFixed(3)}`);
    lines.push(
      `- Reuse penalties: source=${item.scores.sourceReusePenalty.toFixed(2)}, topic=${item.scores.topicReusePenalty.toFixed(2)}`,
    );
    lines.push(`- Topics: ${item.topicTokens.join(", ") || "(none)"}`);
    lines.push("");
    lines.push("Summary:");
    lines.push(item.extractionSummary || "(no summary)");
    lines.push("");
    lines.push("Claims:");
    if (item.claims.length === 0) {
      lines.push("- (no claims)");
    } else {
      item.claims.forEach((claim, idx) => {
        lines.push(`- [${idx + 1}] [${claim.evidenceLevel}] ${claim.text}`);
      });
    }
    lines.push("");
    lines.push("Composition Parameters:");
    if (item.compositionParameters.length === 0) {
      lines.push("- (no parameters)");
    } else {
      item.compositionParameters.forEach((param) => {
        lines.push(`- ${param.type}: ${param.value}`);
      });
    }
    if (item.openQuestions.length > 0) {
      lines.push("");
      lines.push("Open Questions:");
      item.openQuestions.forEach((q) => {
        lines.push(`- ${q}`);
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildAssistantBrief(context: SynthesisContextV1): string {
  const sourceHandles = context.selected.map((row) => row.citation).join(", ");
  return [
    "# Assistant Reasoning Brief",
    "",
    "You are synthesizing one testable hypothesis and one DAW-ready recipe from multiple sources.",
    "Prioritize rigor, traceability, and implementation readiness.",
    "",
    "## Inputs",
    `- Context JSON: context.json`,
    `- Context Markdown: context.md`,
    `- Available source citations: ${sourceHandles}`,
    "",
    "## Hard Constraints",
    "- Use only evidence present in the provided context pack.",
    "- Cite supporting sources in rationale/body using citation handles `S#` (e.g. `S1`, `S3`).",
    "- Do not call external APIs or infer unsupported factual claims.",
    "- Produce one coherent hypothesis and one coherent recipe.",
    "- Include at least 3 distinct citations in rationale unless fewer than 3 sources were selected.",
    "- If sources conflict, explicitly name the conflict and explain chosen interpretation.",
    "- Prefer an experimental question that is meaningfully different from recent runs (new variable framing or protocol emphasis).",
    "",
    "## Output Contract",
    "Write a JSON object compatible with `final-output.template.json` and save it as `final-output.json`.",
    "Required shape:",
    "```json",
    "{",
    '  "version": "final_output_v1",',
    '  "hypothesis": {',
    '    "title": "string",',
    '    "question": "string",',
    '    "hypothesis": "string",',
    '    "rationaleMd": "markdown with S# citations",',
    '    "sourceIds": ["sourceId1", "sourceId2"],',
    '    "concepts": ["optional", "concepts"]',
    "  },",
    '  "recipe": {',
    '    "title": "string",',
    '    "bodyMd": "markdown with arrangement and S# citations",',
    '    "parameters": [',
    '      { "type": "tempo", "value": "108 BPM", "details": { "bpm": 108 } }',
    "    ],",
    '    "dawChecklist": ["step 1", "step 2"],',
    '    "protocol": {',
    '      "studyType": "litmus",',
    '      "durationSecs": 60,',
    '      "panelPlanned": ["self"],',
    '      "listeningContext": "optional",',
    '      "listeningMethod": "optional",',
    '      "whatVaries": ["..."],',
    '      "whatStaysConstant": ["..."]',
    "    }",
    "  },",
    '  "citations": ["S1", "S2"],',
    '  "notes": "optional implementation notes"',
    "}",
    "```",
    "",
    "## Quality Rubric (Self-check before finalizing)",
    "- Evidence quality: Prefer claims tagged `peer_reviewed`, then `anecdotal/speculative` only as secondary support.",
    "- Causality: Hypothesis must specify cause, expected effect, and why mechanism is plausible from cited evidence.",
    "- Experimental control: Recipe must isolate what changes vs what stays constant.",
    "- Operational detail: Parameters include concrete values and units; checklist steps are executable in sequence.",
    "- Falsifiability: Include what observation would count as disconfirming evidence.",
    "",
    "## Failure Conditions (Reject and rewrite if any are true)",
    "- Uses no citations or only one citation despite broader source set.",
    "- Contains claims not grounded in context pack.",
    '- Uses vague placeholders ("interesting", "better sound") without measurable criteria.',
    "- Protocol omits `whatVaries` or `whatStaysConstant`.",
    "",
    "## Suggested Output Style",
    "- Keep titles short and concrete.",
    "- Use markdown in rationale/body with inline citation handles (e.g. `... [S2]`).",
    "- Keep hypothesis in a single, testable if/then statement.",
  ].join("\n");
}

function buildTemplate(context: SynthesisContextV1): FinalOutputV1 {
  const sourceIds = unique(context.selected.map((item) => item.sourceId));
  return {
    version: "final_output_v1",
    hypothesis: {
      title: "",
      question: "",
      hypothesis: "",
      rationaleMd:
        "Provide rationale with explicit S# citations, e.g. `Supported by S1 and S3.`",
      sourceIds,
      concepts: [],
    },
    recipe: {
      title: "",
      bodyMd:
        "Describe arrangement, test method, and expected outcomes with S# citations.",
      parameters: [],
      dawChecklist: [],
      protocol: {
        studyType: "litmus",
        durationSecs: 60,
        panelPlanned: ["self"],
        listeningContext: "",
        listeningMethod: "",
        whatVaries: [],
        whatStaysConstant: [],
      },
    },
    citations: context.selected.map((row) => row.citation),
    notes:
      "Fill all required fields, then run publish mode with this file path.",
  };
}

function validateFinalOutput(input: unknown): FinalOutputV1 {
  const top = ensureObject(input, "final output");
  const versionRaw = top.version;
  if (versionRaw !== "final_output_v1") {
    fail('final output `version` must be "final_output_v1"');
  }

  const hypothesisObj = ensureObject(top.hypothesis, "hypothesis");
  const recipeObj = ensureObject(top.recipe, "recipe");

  const sourceIds = asStringArray(
    hypothesisObj.sourceIds,
    "hypothesis.sourceIds",
  );
  const concepts = Array.isArray(hypothesisObj.concepts)
    ? hypothesisObj.concepts.map((value, idx) => {
        if (typeof value !== "string") {
          fail(`hypothesis.concepts[${idx}] must be a string`);
        }
        return value;
      })
    : undefined;

  const hypothesis: FinalHypothesisV1 = {
    title: asString(hypothesisObj.title, "hypothesis.title"),
    question: asString(hypothesisObj.question, "hypothesis.question"),
    hypothesis: asString(hypothesisObj.hypothesis, "hypothesis.hypothesis"),
    rationaleMd: asString(hypothesisObj.rationaleMd, "hypothesis.rationaleMd"),
    sourceIds,
    concepts,
  };

  const paramsRaw = recipeObj.parameters;
  if (!Array.isArray(paramsRaw) || paramsRaw.length === 0) {
    fail("recipe.parameters must be a non-empty array");
  }
  const parameters: CompositionParameter[] = paramsRaw.map((value, idx) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(`recipe.parameters[${idx}] must be an object`);
    }
    const row = value as JsonRecord;
    return {
      type: asString(row.type, `recipe.parameters[${idx}].type`),
      value: asString(row.value, `recipe.parameters[${idx}].value`),
      details: row.details,
    };
  });

  const dawChecklist = asStringArray(
    recipeObj.dawChecklist,
    "recipe.dawChecklist",
  );

  let protocol: FinalRecipeProtocolV1 | undefined;
  if (recipeObj.protocol !== undefined) {
    const protocolObj = ensureObject(recipeObj.protocol, "recipe.protocol");
    const studyTypeRaw = asString(
      protocolObj.studyType,
      "recipe.protocol.studyType",
    );
    if (studyTypeRaw !== "litmus" && studyTypeRaw !== "comparison") {
      fail('recipe.protocol.studyType must be "litmus" or "comparison"');
    }

    const durationRaw = protocolObj.durationSecs;
    if (typeof durationRaw !== "number" || !Number.isFinite(durationRaw)) {
      fail("recipe.protocol.durationSecs must be a number");
    }
    const durationSecs = Math.max(1, Math.floor(durationRaw));

    const panelPlanned = asStringArray(
      protocolObj.panelPlanned,
      "recipe.protocol.panelPlanned",
    );
    const whatVaries = asStringArray(
      protocolObj.whatVaries,
      "recipe.protocol.whatVaries",
    );
    const whatStaysConstant = asStringArray(
      protocolObj.whatStaysConstant,
      "recipe.protocol.whatStaysConstant",
    );

    protocol = {
      studyType: studyTypeRaw,
      durationSecs,
      panelPlanned,
      listeningContext:
        typeof protocolObj.listeningContext === "string"
          ? protocolObj.listeningContext
          : undefined,
      listeningMethod:
        typeof protocolObj.listeningMethod === "string"
          ? protocolObj.listeningMethod
          : undefined,
      baselineArtifactId:
        typeof protocolObj.baselineArtifactId === "string"
          ? protocolObj.baselineArtifactId
          : undefined,
      whatVaries,
      whatStaysConstant,
    };
  }

  const recipe: FinalRecipeV1 = {
    title: asString(recipeObj.title, "recipe.title"),
    bodyMd: asString(recipeObj.bodyMd, "recipe.bodyMd"),
    parameters,
    dawChecklist,
    protocol,
  };

  const citations = Array.isArray(top.citations)
    ? top.citations.map((value, idx) => {
        if (typeof value !== "string" || value.trim().length === 0) {
          fail(`citations[${idx}] must be a non-empty string`);
        }
        return value.trim();
      })
    : undefined;

  return {
    version: "final_output_v1",
    hypothesis,
    recipe,
    citations,
    notes: typeof top.notes === "string" ? top.notes : undefined,
  };
}

function hostOnly(urlString: string): string {
  try {
    return new URL(urlString).host;
  } catch {
    return urlString;
  }
}

function compareCandidates(
  a: CandidateExtraction,
  b: CandidateExtraction,
): number {
  if (b.combinedScore !== a.combinedScore) {
    return b.combinedScore - a.combinedScore;
  }
  if (b.peerReviewedClaims !== a.peerReviewedClaims) {
    return b.peerReviewedClaims - a.peerReviewedClaims;
  }
  if (b.distinctParameterTypes !== a.distinctParameterTypes) {
    return b.distinctParameterTypes - a.distinctParameterTypes;
  }
  return extractionCreatedAt(b.extraction) - extractionCreatedAt(a.extraction);
}

async function collectMode(
  client: ConvexHttpClient,
  options: CollectOptions,
): Promise<CollectArtifacts> {
  const noveltyHistory = await loadNoveltyHistory(
    options.out,
    options.noveltyWindow,
  );

  const fetchedRaw = (await client.query(api.extractions.listRecent, {
    limit: options.fetch,
  })) as unknown;

  if (!Array.isArray(fetchedRaw)) {
    fail("Expected listRecent to return an array");
  }

  const fetchedExtractions = fetchedRaw
    .map((row) => coerceExtraction(row))
    .filter((row): row is ExtractionLike => row !== null);

  const sourceByExtractionId = new Map<string, SourceLike | null>();
  await Promise.all(
    fetchedExtractions.map(async (extraction) => {
      const sourceRaw = await client.query(api.sources.get, {
        id: extraction.sourceId as never,
      });
      sourceByExtractionId.set(extraction._id, coerceSource(sourceRaw));
    }),
  );

  const candidatesRaw: CandidateExtraction[] = fetchedExtractions
    .map((extraction) => {
      const source = sourceByExtractionId.get(extraction._id) ?? null;
      if (!source) return null;

      const topicTokens = unique(
        [
          ...extraction.topics.flatMap((topic) => normalizeTopicToken(topic)),
          ...(source.tags ?? []).flatMap((topic) => normalizeTopicToken(topic)),
          ...(source.topics ?? []).flatMap((topic) =>
            normalizeTopicToken(topic),
          ),
        ].filter((token) => token.length > 0 && isMeaningfulTopicToken(token)),
      );
      const topicTokenSet = new Set(topicTokens);
      const peerReviewedClaims = extraction.claims.filter(
        (claim) => claim.evidenceLevel === "peer_reviewed",
      ).length;
      const distinctParameterTypes = new Set(
        extraction.compositionParameters
          .map((param) => param.type.trim().toLowerCase())
          .filter((value) => value.length > 0),
      ).size;
      const baseScore =
        extraction.claims.length * 2 +
        extraction.compositionParameters.length * 3 +
        peerReviewedClaims * 5;
      const domainRelevanceScore = computeDomainRelevance({
        source,
        extraction,
        topicTokens,
      });

      return {
        extraction,
        source,
        topicTokens,
        topicTokenSet,
        distinctParameterTypes,
        peerReviewedClaims,
        baseScore,
        normalizedBaseScore: 0,
        noveltyScore: 0,
        crossRunNoveltyScore: 1,
        sourceReusePenalty: 0,
        topicReusePenalty: 0,
        domainRelevanceScore,
        topicalBalanceScore: 0,
        combinedScore: 0,
      };
    })
    .filter((row): row is CandidateExtraction => row !== null);

  const usableCandidates = candidatesRaw.filter((candidate) => {
    const sourceStatus = candidate.source.status;
    return (
      USABLE_STATUSES.has(sourceStatus) &&
      candidate.extraction.claims.length >= options.minClaims &&
      candidate.extraction.compositionParameters.length >= options.minParams &&
      candidate.domainRelevanceScore >= 0.22 &&
      !isLikelyTestArtifact({
        source: candidate.source,
        extraction: candidate.extraction,
      }) &&
      (!options.requireTuningSignal ||
        hasTuningSignal({
          extraction: candidate.extraction,
          topicTokens: candidate.topicTokens,
        }))
    );
  });

  if (usableCandidates.length === 0) {
    fail(
      `No eligible candidates found. Try lowering --min-claims (${options.minClaims}) or --min-params (${options.minParams}), or increase --fetch (${options.fetch}). Note: domain relevance filtering is active.`,
    );
  }

  const globalTopicCounts = buildTopicFrequency(usableCandidates);
  const baseScores = usableCandidates.map((candidate) => candidate.baseScore);
  const minBase = Math.min(...baseScores);
  const maxBase = Math.max(...baseScores);
  for (const candidate of usableCandidates) {
    candidate.normalizedBaseScore = normalizedScore(
      candidate.baseScore,
      minBase,
      maxBase,
    );
  }

  const remaining = [...usableCandidates];
  const selected: CandidateExtraction[] = [];

  while (selected.length < options.target && remaining.length > 0) {
    const reusedAlready = selected.filter(
      (item) => item.sourceReusePenalty >= 1,
    ).length;
    const selectedSourceIds = new Set(selected.map((item) => item.source._id));
    const distinctSourcePool = remaining.filter(
      (candidate) => !selectedSourceIds.has(candidate.source._id),
    );
    const pool = distinctSourcePool.length > 0 ? distinctSourcePool : remaining;

    const selectedTopicSets = selected.map((item) => item.topicTokenSet);
    const selectedTopicCounts = new Map<string, number>();
    for (const topicSet of selectedTopicSets) {
      for (const token of topicSet) {
        selectedTopicCounts.set(
          token,
          (selectedTopicCounts.get(token) ?? 0) + 1,
        );
      }
    }
    for (const candidate of pool) {
      const intraRunNovelty =
        selectedTopicSets.length === 0
          ? 1
          : 1 -
            Math.max(
              ...selectedTopicSets.map((selectedTopics) =>
                jaccardSimilarity(candidate.topicTokenSet, selectedTopics),
              ),
            );
      const sourceReusePenalty = noveltyHistory.sourceIds.has(
        candidate.source._id,
      )
        ? 1
        : 0;
      let topicReusePenalty = 0;
      if (
        noveltyHistory.topicTokens.size > 0 &&
        candidate.topicTokenSet.size > 0
      ) {
        let overlap = 0;
        for (const token of candidate.topicTokenSet) {
          if (noveltyHistory.topicTokens.has(normalizePhrase(token)))
            overlap += 1;
        }
        topicReusePenalty = overlap / candidate.topicTokenSet.size;
      }

      const crossRunNovelty = Math.max(
        0,
        1 - (0.7 * sourceReusePenalty + 0.3 * topicReusePenalty),
      );

      candidate.noveltyScore = intraRunNovelty;
      candidate.crossRunNoveltyScore = crossRunNovelty;
      candidate.sourceReusePenalty = sourceReusePenalty;
      candidate.topicReusePenalty = topicReusePenalty;
      candidate.topicalBalanceScore = computeTopicalBalanceScore({
        candidate,
        globalTopicCounts,
        selectedTopicCounts,
        selectedCount: selected.length,
        candidatePoolSize: usableCandidates.length,
      });
      candidate.combinedScore =
        SELECTION_WEIGHTS.base * candidate.normalizedBaseScore +
        SELECTION_WEIGHTS.novelty * candidate.noveltyScore +
        SELECTION_WEIGHTS.crossRunNovelty * candidate.crossRunNoveltyScore +
        SELECTION_WEIGHTS.domainRelevance * candidate.domainRelevanceScore +
        SELECTION_WEIGHTS.topicalBalance * candidate.topicalBalanceScore;
    }

    let candidatePool = [...pool];
    if (reusedAlready >= options.maxReusedSources) {
      const freshOnly = candidatePool.filter(
        (candidate) => candidate.sourceReusePenalty < 1,
      );
      if (freshOnly.length > 0) {
        candidatePool = freshOnly;
      }
    }

    candidatePool.sort(compareCandidates);
    const chosen = candidatePool[0];
    if (!chosen) break;
    selected.push(chosen);

    const removeAt = remaining.findIndex(
      (candidate) => candidate.extraction._id === chosen.extraction._id,
    );
    if (removeAt >= 0) remaining.splice(removeAt, 1);
  }

  const selectedRows: SelectedExtractionV1[] = selected.map((row, index) => ({
    citation: `S${index + 1}`,
    extractionId: row.extraction._id,
    sourceId: row.source._id,
    sourceTitle: row.source.title || "Untitled source",
    sourceType: row.source.type,
    sourceStatus: row.source.status,
    sourceUrl: row.source.canonicalUrl,
    sourceAuthor: row.source.author,
    extractionCreatedAt: extractionCreatedAt(row.extraction),
    extractionSummary: row.extraction.summary,
    topics: row.extraction.topics,
    topicTokens: row.topicTokens,
    claims: row.extraction.claims,
    compositionParameters: row.extraction.compositionParameters,
    openQuestions: row.extraction.openQuestions ?? [],
    scores: {
      base: row.baseScore,
      normalizedBase: row.normalizedBaseScore,
      novelty: row.noveltyScore,
      crossRunNovelty: row.crossRunNoveltyScore,
      sourceReusePenalty: row.sourceReusePenalty,
      topicReusePenalty: row.topicReusePenalty,
      domainRelevance: row.domainRelevanceScore,
      topicalBalance: row.topicalBalanceScore,
      combined: row.combinedScore,
      peerReviewedClaims: row.peerReviewedClaims,
      distinctParameterTypes: row.distinctParameterTypes,
    },
  }));

  const topicFrequency = new Map<string, number>();
  const parameterTypeFrequency = new Map<string, number>();
  const evidenceDistribution = new Map<string, number>();
  const sourceTypeDistribution = new Map<string, number>();

  for (const row of selectedRows) {
    sourceTypeDistribution.set(
      row.sourceType,
      (sourceTypeDistribution.get(row.sourceType) ?? 0) + 1,
    );

    for (const topic of unique(row.topicTokens)) {
      topicFrequency.set(topic, (topicFrequency.get(topic) ?? 0) + 1);
    }

    for (const param of row.compositionParameters) {
      const key = param.type.trim().toLowerCase();
      if (key.length === 0) continue;
      parameterTypeFrequency.set(
        key,
        (parameterTypeFrequency.get(key) ?? 0) + 1,
      );
    }

    for (const claim of row.claims) {
      evidenceDistribution.set(
        claim.evidenceLevel,
        (evidenceDistribution.get(claim.evidenceLevel) ?? 0) + 1,
      );
    }
  }

  const now = new Date();
  const timestamp = timestampSlug(now);
  const outBase = resolve(process.cwd(), options.out, timestamp);

  const context: SynthesisContextV1 = {
    version: "synthesis_context_v1",
    generatedAt: now.toISOString(),
    mode: "collect",
    convexUrlHost: hostOnly(client.url),
    params: { ...options },
    totals: {
      fetchedExtractions: fetchedExtractions.length,
      withSource: candidatesRaw.length,
      eligibleCandidates: usableCandidates.length,
      selected: selectedRows.length,
    },
    selected: selectedRows,
    aggregate: {
      topicFrequency: Object.fromEntries(
        [...topicFrequency.entries()].sort((a, b) => b[1] - a[1]),
      ),
      parameterTypeFrequency: Object.fromEntries(
        [...parameterTypeFrequency.entries()].sort((a, b) => b[1] - a[1]),
      ),
      evidenceDistribution: Object.fromEntries(
        [...evidenceDistribution.entries()].sort((a, b) => b[1] - a[1]),
      ),
      sourceTypeDistribution: Object.fromEntries(
        [...sourceTypeDistribution.entries()].sort((a, b) => b[1] - a[1]),
      ),
    },
    noveltyHistory: {
      runsScanned: noveltyHistory.runsScanned,
      priorSourceIds: noveltyHistory.sourceIds.size,
      priorTopicTokens: noveltyHistory.topicTokens.size,
      priorVariablePhrases: noveltyHistory.variablePhrases.size,
      priorTitlePhrases: noveltyHistory.titlePhrases.size,
    },
  };

  const contextJsonPath = join(outBase, "context.json");
  const contextMdPath = join(outBase, "context.md");
  const assistantBriefPath = join(outBase, "assistant-brief.md");
  const templatePath = join(outBase, "final-output.template.json");

  await mkdir(outBase, { recursive: true });
  await writeFile(
    contextJsonPath,
    `${JSON.stringify(context, null, 2)}\n`,
    "utf8",
  );
  await writeFile(contextMdPath, `${buildContextMarkdown(context)}\n`, "utf8");
  await writeFile(
    assistantBriefPath,
    `${buildAssistantBrief(context)}\n`,
    "utf8",
  );
  await writeFile(
    templatePath,
    `${JSON.stringify(buildTemplate(context), null, 2)}\n`,
    "utf8",
  );

  console.log("Synthesis context generated:");
  console.log(`- ${contextJsonPath}`);
  console.log(`- ${contextMdPath}`);
  console.log(`- ${assistantBriefPath}`);
  console.log(`- ${templatePath}`);
  console.log("");
  console.log(
    `Selected ${context.totals.selected} item(s) from ${context.totals.eligibleCandidates} eligible candidate(s).`,
  );
  console.log(
    `Cross-run novelty baseline: ${context.noveltyHistory.runsScanned} prior run(s), ${context.noveltyHistory.priorSourceIds} prior source IDs.`,
  );

  return {
    outBase,
    contextJsonPath,
    contextMdPath,
    assistantBriefPath,
    templatePath,
    context,
  };
}

async function publishFinalOutput(
  client: ConvexHttpClient,
  finalOutput: FinalOutputV1,
  inputPath: string,
): Promise<PublishResult> {
  const hypothesisId = await client.mutation(api.hypotheses.create, {
    title: finalOutput.hypothesis.title,
    question: finalOutput.hypothesis.question,
    hypothesis: finalOutput.hypothesis.hypothesis,
    rationaleMd: finalOutput.hypothesis.rationaleMd,
    sourceIds: finalOutput.hypothesis.sourceIds as never[],
    concepts: finalOutput.hypothesis.concepts,
  });

  const recipeId = await client.mutation(api.recipes.create, {
    hypothesisId,
    title: finalOutput.recipe.title,
    bodyMd: finalOutput.recipe.bodyMd,
    parameters: finalOutput.recipe.parameters as never[],
    dawChecklist: finalOutput.recipe.dawChecklist,
    protocol: finalOutput.recipe.protocol as never,
  });

  const receipt = {
    publishedAt: new Date().toISOString(),
    inputPath,
    hypothesisId,
    recipeId,
    sourceIds: finalOutput.hypothesis.sourceIds,
    parameterCount: finalOutput.recipe.parameters.length,
    checklistCount: finalOutput.recipe.dawChecklist.length,
  };

  const receiptName = `publish-receipt.${timestampSlug(new Date())}.json`;
  const receiptPath = join(dirname(inputPath), receiptName);
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  return { hypothesisId, recipeId, receiptPath };
}

async function publishMode(client: ConvexHttpClient, options: PublishOptions) {
  const inputPath = resolve(process.cwd(), options.input);
  const raw = await readFile(inputPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`Input is not valid JSON: ${(error as Error).message}`);
  }

  const finalOutput = validateFinalOutput(parsed);
  const { hypothesisId, recipeId, receiptPath } = await publishFinalOutput(
    client,
    finalOutput,
    inputPath,
  );

  console.log("Publish completed:");
  console.log(`- Hypothesis ID: ${hypothesisId}`);
  console.log(`- Recipe ID: ${recipeId}`);
  console.log(`- Receipt: ${receiptPath}`);
}

function topEntries(
  counts: Record<string, number>,
  limit: number,
): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function topMeaningfulTopics(
  counts: Record<string, number>,
  limit: number,
): Array<{ key: string; count: number }> {
  return topEntries(counts, Math.max(limit * 3, limit))
    .filter((row) => isMeaningfulTopicToken(row.key))
    .slice(0, limit);
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(" ");
}

function humanizeParamType(value: string): string {
  const normalized = normalizePhrase(
    value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "),
  );
  const aliases: Record<string, string> = {
    tuningsystem: "tuning system",
    harmonicprofile: "harmonic profile",
    rootnote: "root note",
    chordprogression: "chord progression",
    synthwaveform: "synth waveform",
  };
  return aliases[normalized] ?? normalized;
}

function canonicalizeParamTypeLabel(value: string): string {
  const normalized = normalizePhrase(value);
  const aliases: Record<string, string> = {
    "tuning system": "tuningSystem",
    "harmonic profile": "harmonicProfile",
    "root note": "rootNote",
    "chord progression": "chordProgression",
    "synth waveform": "synthWaveform",
  };
  return aliases[normalized] ?? value.replace(/\s+/g, "");
}

function firstNumericInText(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNovelPhrase(
  candidates: string[],
  seenPhrases: Set<string>,
  fallback: string,
): string {
  for (const candidate of candidates) {
    const normalized = normalizePhrase(candidate);
    if (normalized.length === 0) continue;
    if (!seenPhrases.has(normalized)) return candidate;
  }
  return fallback;
}

function buildAutoFinalOutput(
  context: SynthesisContextV1,
  noveltyHistory: NoveltyHistory,
): FinalOutputV1 {
  const rankedSources = [...context.selected].sort(
    (a, b) =>
      b.scores.combined - a.scores.combined ||
      b.scores.peerReviewedClaims - a.scores.peerReviewedClaims,
  );

  const sourceWindow = rankedSources.slice(
    0,
    Math.min(6, rankedSources.length),
  );
  const sourceIds = unique(sourceWindow.map((row) => row.sourceId));
  const citations = sourceWindow.map((row) => row.citation);

  const topTopics = topMeaningfulTopics(context.aggregate.topicFrequency, 6);
  const nonTuningTopics = topTopics.filter(
    (row) => !isTuningCentricLabel(row.key),
  );
  const topTopicA =
    nonTuningTopics[0]?.key ?? topTopics[0]?.key ?? "harmonic profile";
  const topTopicB =
    nonTuningTopics[1]?.key ?? topTopics[1]?.key ?? "music perception";
  const topTopicC =
    nonTuningTopics[2]?.key ?? topTopics[2]?.key ?? "voice leading";

  const topParamTypesRaw = topEntries(
    context.aggregate.parameterTypeFrequency,
    6,
  ).map((row) => humanizeParamType(row.key));
  const nonTuningParamTypes = topParamTypesRaw.filter(
    (type) => !isTuningCentricLabel(type),
  );
  const topParamTypes = unique([
    ...nonTuningParamTypes,
    ...topParamTypesRaw,
  ]).slice(0, 6);

  const tuningValues = unique(
    sourceWindow
      .flatMap((row) => row.compositionParameters)
      .filter((param) => param.type.toLowerCase() === "tuningsystem")
      .map((param) => param.value),
  ).slice(0, 3);

  const topNonTuningParamType = nonTuningParamTypes[0];
  const topNonTuningValues = topNonTuningParamType
    ? unique(
        sourceWindow
          .flatMap((row) => row.compositionParameters)
          .filter(
            (param) => humanizeParamType(param.type) === topNonTuningParamType,
          )
          .map((param) => param.value),
      ).slice(0, 3)
    : [];

  const extractedTempo =
    sourceWindow
      .flatMap((row) => row.compositionParameters)
      .find((param) => param.type.toLowerCase() === "tempo")?.value ?? "82 BPM";
  const tempoBpm = firstNumericInText(extractedTempo) ?? 82;
  const safeTempo = tempoBpm > 0 ? tempoBpm : DEFAULT_TEMPO_BPM;
  if (tempoBpm <= 0) {
    console.warn(
      `Non-positive tempo "${tempoBpm}" detected, defaulting to ${DEFAULT_TEMPO_BPM} BPM`,
    );
  }

  const primaryVariable = topNonTuningParamType
    ? `${topNonTuningParamType} strategy`
    : tuningValues.length >= 2
      ? `tuning strategy (${tuningValues.join(" vs ")})`
      : `${topParamTypes[0] ?? "harmonic profile"} variation`;

  const variableCandidates = unique(
    [
      primaryVariable,
      ...(topNonTuningParamType
        ? [
            `${topNonTuningParamType} variation across fixed arrangement`,
            `interaction between ${topTopicA} and ${topNonTuningParamType}`,
            ...(tuningValues.length > 0
              ? [
                  `${topNonTuningParamType} comparison under fixed tuning control`,
                ]
              : []),
          ]
        : []),
      ...(nonTuningTopics.length >= 2
        ? [`contrast between ${topTopicA} and ${topTopicB}`]
        : []),
      ...(tuningValues.length >= 2
        ? [
            `tuning strategy (${tuningValues.slice(0, 2).join(" vs ")})`,
            `temperament mapping contrast (${tuningValues.slice(0, 2).join(" vs ")})`,
          ]
        : []),
    ].filter((value) => normalizePhrase(value).length > 0),
  );
  const chosenVariable = pickNovelPhrase(
    variableCandidates,
    noveltyHistory.variablePhrases,
    primaryVariable,
  );
  const tuningIsPrimaryVariable = isTuningCentricLabel(chosenVariable);

  const healingSignals = [
    topTopicA,
    topTopicB,
    topTopicC,
    ...topParamTypes,
  ].some((value) => {
    const normalized = normalizePhrase(value);
    return (
      normalized.includes("healing") ||
      normalized.includes("wellbeing") ||
      normalized.includes("well being") ||
      normalized.includes("stress") ||
      normalized.includes("physiology") ||
      normalized.includes("body") ||
      normalized.includes("somatic") ||
      normalized.includes("pain") ||
      normalized.includes("sleep")
    );
  });
  const outcomePhrase = healingSignals
    ? "perceived calm, bodily ease, and continuity"
    : "perceived consonance, roughness, and continuity";

  const titleFallback = `${toTitleCase(topTopicA)} vs ${toTitleCase(topTopicB)} Controlled Comparison`;
  const titleCandidates = [
    `${toTitleCase(topTopicA)} vs ${toTitleCase(topTopicB)} Controlled Comparison`,
    `${toTitleCase(topTopicA)} and ${toTitleCase(topTopicC)} Multi-Source Study`,
    `${toTitleCase(topTopicB)} Protocol Under ${toTitleCase(topTopicC)} Constraints`,
    `${toTitleCase(topTopicA)} Comparative Micro-Study`,
  ];
  const title = pickNovelPhrase(
    titleCandidates,
    noveltyHistory.titlePhrases,
    titleFallback,
  );
  const questionWithNovelty = `How does ${chosenVariable} influence ${outcomePhrase} in a controlled harmonic micro-study?`;
  const hypothesisText = tuningIsPrimaryVariable
    ? `If we render one identical arrangement with ${chosenVariable} while holding all other musical factors fixed, then listener ratings will show a consistent ordering in consonance and roughness between versions, because interval-ratio alignment and temperament error distribution change partial overlap and beating behavior.`
    : `If we render one identical arrangement with ${chosenVariable} while holding all other musical factors fixed, then listener ratings will show a consistent ordering in ${outcomePhrase} between versions, because this variable changes tension-release contour and perceptual expectation without introducing mix or instrumentation confounds.`;

  const rationaleMd = [
    `Selected sources span acoustic mechanisms (ratio, periodicity, temperament) and structural/cognitive mechanisms (harmonic topology, pitch-space organization, historical usage), allowing non-tuning and tuning variables to be compared under one protocol [${citations.slice(0, 3).join(", ")}].`,
    tuningIsPrimaryVariable
      ? `The selected evidence supports a tuning-led comparison while still preserving broader contextual controls from harmony and perception research [${citations.join(", ")}].`
      : `The selected evidence supports manipulating ${chosenVariable} while keeping tuning fixed as a control, so broader musical and perceptual hypotheses can be tested without collapsing to temperament-only framing [${citations.join(", ")}].`,
    `Falsification criterion: if blinded ratings show no stable ordering across versions in ${outcomePhrase}, or if annotations fail to cluster by condition, the hypothesis is not supported.`,
  ].join("\n\n");

  const variableChecklist = tuningIsPrimaryVariable
    ? tuningValues.length > 0
      ? tuningValues
          .map(
            (value, idx) =>
              `Render Version ${String.fromCharCode(65 + idx)} using ${value}.`,
          )
          .slice(0, 3)
      : [
          "Render at least two versions with distinct tuning/parameter mappings.",
        ]
    : [
        topNonTuningValues[0]
          ? `Render Version A with ${topNonTuningParamType}: ${topNonTuningValues[0]}.`
          : `Render Version A with baseline ${chosenVariable}.`,
        topNonTuningValues[1]
          ? `Render Version B with ${topNonTuningParamType}: ${topNonTuningValues[1]}.`
          : `Render Version B with alternate ${chosenVariable}.`,
        ...(topNonTuningValues[2]
          ? [
              `Render Version C with ${topNonTuningParamType}: ${topNonTuningValues[2]}.`,
            ]
          : []),
        ...(tuningValues[0]
          ? [`Keep tuning fixed at ${tuningValues[0]} across all versions.`]
          : []),
      ];

  const recipeBody = [
    "## Goal",
    `Evaluate ${chosenVariable} under controlled musical conditions using a blinded comparison design.`,
    "",
    "## Shared Arrangement",
    `- Tempo: ${tempoBpm} BPM`,
    "- Meter: 4/4",
    "- Length: 24-32 bars",
    "- Keep MIDI notes, sound sources, automation, and mix balance identical across versions.",
    "",
    "## Variable Under Test",
    `- Change only: ${chosenVariable}`,
    "- Keep all non-target variables fixed.",
    "",
    "## Evaluation",
    `- Blind-label exports and rate: ${outcomePhrase}.`,
    "- Annotate bar/chord locations where roughness is strongest.",
    "",
    `Evidence basis: [${citations.join(", ")}].`,
  ].join("\n");

  const parameters: CompositionParameter[] = [
    {
      type: "tempo",
      value: `${tempoBpm} BPM`,
      details: { bpm: tempoBpm },
    },
    {
      type: "form",
      value: "24-32 bar controlled comparison",
      details: { barsMin: 24, barsMax: 32, meter: "4/4" },
    },
    {
      type: "harmonicProfile",
      value: "Sustained triadic texture with fixed voicing",
      details: { objective: "maximize audibility of roughness differences" },
    },
  ];

  if (tuningIsPrimaryVariable) {
    parameters.push({
      type: "tuningSystem",
      value: tuningValues[0] ?? "Version A baseline tuning",
      details: { role: "comparison arm A" },
    });
    parameters.push({
      type: "tuningSystem",
      value: tuningValues[1] ?? "Version B alternate tuning",
      details: { role: "comparison arm B" },
    });
    if (tuningValues[2]) {
      parameters.push({
        type: "tuningSystem",
        value: tuningValues[2],
        details: { role: "comparison arm C" },
      });
    }
  } else {
    const variableParamType = canonicalizeParamTypeLabel(
      topNonTuningParamType ?? "harmonic profile",
    );
    if (topNonTuningValues[0]) {
      parameters.push({
        type: variableParamType,
        value: topNonTuningValues[0],
        details: { role: "comparison arm A" },
      });
    }
    if (topNonTuningValues[1]) {
      parameters.push({
        type: variableParamType,
        value: topNonTuningValues[1],
        details: { role: "comparison arm B" },
      });
    }
    if (topNonTuningValues[2]) {
      parameters.push({
        type: variableParamType,
        value: topNonTuningValues[2],
        details: { role: "comparison arm C" },
      });
    }
    if (tuningValues[0]) {
      parameters.push({
        type: "tuningSystem",
        value: tuningValues[0],
        details: { role: "fixed control" },
      });
    }
  }

  const dawChecklist = [
    "Create one master MIDI arrangement template.",
    "Freeze instrument and FX chain before rendering comparison arms.",
    ...variableChecklist,
    "Match loudness across exports to remove gain bias.",
    "Rename exports to blind labels (e.g., X/Y/Z).",
    `Rate each version for ${outcomePhrase}.`,
    "Capture bar-level notes for perceptual spikes.",
    "Summarize whether observed ordering supports or contradicts hypothesis.",
  ];
  const whatStaysConstant = [
    "MIDI notes",
    "arrangement length",
    "tempo",
    "sound sources",
    "automation",
    "mix balance",
    "export settings",
    ...(tuningIsPrimaryVariable ? [] : ["tuning system"]),
  ];

  return {
    version: "final_output_v1",
    hypothesis: {
      title,
      question: questionWithNovelty,
      hypothesis: hypothesisText,
      rationaleMd,
      sourceIds,
      concepts: unique([topTopicA, topTopicB, ...topParamTypes]).slice(0, 8),
    },
    recipe: {
      title: `${toTitleCase(topTopicA)} Comparison Micro-Study`,
      bodyMd: recipeBody,
      parameters,
      dawChecklist,
      protocol: {
        studyType: "comparison",
        durationSecs: Math.round(((28 * 60) / safeTempo) * 4),
        panelPlanned: ["self", "musician_peer_1", "musician_peer_2"],
        listeningContext:
          "Quiet room; repeat on headphones and monitors at fixed playback level.",
        listeningMethod:
          "Blinded multi-version comparison with consistent rating rubric.",
        whatVaries: [chosenVariable],
        whatStaysConstant,
      },
    },
    citations,
    notes:
      "Auto-synthesized from context pack using deterministic rule templates. Review before studio execution.",
  };
}

async function verifyPublish(
  client: ConvexHttpClient,
  expectedHypothesisId: string,
  expectedRecipeId: string,
) {
  const [hypotheses, recipes] = await Promise.all([
    client.query(api.hypotheses.listByStatus, { limit: 5 }),
    client.query(api.recipes.listByStatus, { limit: 5 }),
  ]);

  const latestHypothesis = Array.isArray(hypotheses) ? hypotheses[0] : null;
  const latestRecipe = Array.isArray(recipes) ? recipes[0] : null;

  const hypothesisOk = latestHypothesis?._id === expectedHypothesisId;
  const recipeOk =
    latestRecipe?._id === expectedRecipeId &&
    latestRecipe?.hypothesisId === expectedHypothesisId;

  return {
    hypothesisOk,
    recipeOk,
    latestHypothesisId: latestHypothesis?._id,
    latestRecipeId: latestRecipe?._id,
    latestRecipeHypothesisId: latestRecipe?.hypothesisId,
  };
}

async function fullMode(client: ConvexHttpClient, options: FullOptions) {
  const noveltyHistory = await loadNoveltyHistory(
    options.out,
    options.noveltyWindow,
  );
  const artifacts = await collectMode(client, options);

  const autoOutput = buildAutoFinalOutput(artifacts.context, noveltyHistory);
  const outputPath = join(artifacts.outBase, options.outputName);
  await writeFile(
    outputPath,
    `${JSON.stringify(autoOutput, null, 2)}\n`,
    "utf8",
  );

  const publishResult = await publishFinalOutput(
    client,
    autoOutput,
    outputPath,
  );
  const verification = await verifyPublish(
    client,
    publishResult.hypothesisId,
    publishResult.recipeId,
  );

  console.log("Full workflow completed:");
  console.log(`- Context: ${artifacts.contextJsonPath}`);
  console.log(`- Auto output: ${outputPath}`);
  console.log(`- Hypothesis ID: ${publishResult.hypothesisId}`);
  console.log(`- Recipe ID: ${publishResult.recipeId}`);
  console.log(`- Receipt: ${publishResult.receiptPath}`);
  console.log(
    `- Verification: hypothesisOk=${verification.hypothesisOk}, recipeOk=${verification.recipeOk}`,
  );
}

function parseCollectOptions(args: string[]): CollectOptions {
  return {
    target: parseNumberFlag(args, "--target", 6),
    fetch: parseNumberFlag(args, "--fetch", 120),
    minClaims: parseNumberFlag(args, "--min-claims", 2),
    minParams: parseNumberFlag(args, "--min-params", 1),
    noveltyWindow: parseNumberFlag(args, "--novelty-window", 6),
    maxReusedSources: parseNumberFlag(args, "--max-reused-sources", 2),
    requireTuningSignal: !args.includes("--allow-broad-domain"),
    out: parseStringFlag(args, "--out", "data/generated/synthesis"),
  };
}

function parsePublishOptions(args: string[]): PublishOptions {
  return {
    input: parseStringFlag(args, "--input"),
  };
}

function parseFullOptions(args: string[]): FullOptions {
  return {
    ...parseCollectOptions(args),
    outputName: parseStringFlag(
      args,
      "--output-name",
      "final-output.auto.json",
    ),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const { mode, args } = parseModeAndArgs(argv);
  const convexUrl =
    process.env.CONVEX_URL || process.env.CONVEX_SELF_HOSTED_URL;
  if (!convexUrl) {
    fail(
      "Missing Convex URL. Set CONVEX_URL or CONVEX_SELF_HOSTED_URL before running this script.",
    );
  }

  const client = new ConvexHttpClient(convexUrl);

  if (mode === "collect") {
    const options = parseCollectOptions(args);
    await collectMode(client, options);
    return;
  }

  if (mode === "publish") {
    const options = parsePublishOptions(args);
    await publishMode(client, options);
    return;
  }

  const options = parseFullOptions(args);
  await fullMode(client, options);
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
