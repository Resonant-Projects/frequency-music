import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type RegistryStatus =
  | "known"
  | "provisional"
  | "experimental"
  | "deprecated";

export type RecipeParameterInput = {
  kind?: string;
  type?: string;
  value: string;
  details?: unknown;
  registryStatus?: RegistryStatus;
  canonicalKind?: string;
};

export type RecipeInput = {
  _id: string;
  title: string;
  hypothesisId: string;
  parameters: RecipeParameterInput[];
  protocol?: unknown;
  dawChecklist: string[];
};

export type ParameterUnit = "Hz" | "BPM" | "cents" | "ratio" | "EDO";

export type ParameterValueV1 = {
  canonicalKind: string;
  registryStatus?: RegistryStatus;
  value: {
    raw: string;
    number?: number;
    unit?: ParameterUnit;
  };
  lossy: boolean;
  details?: unknown;
};

export type RecipeExportV1 = {
  contract: "recipe_export_v1";
  recipeId: string;
  title: string;
  hypothesisId: string;
  generatedAt?: string;
  parameters: ParameterValueV1[];
  protocol: unknown;
  dawChecklist: string[];
  assets: Array<{
    type: "scl" | "kbm";
    filename: string;
    sha256: string;
  }>;
};

type EmittedFile = {
  filename: string;
  content: string;
};

type BuildOptions = {
  generatedAt?: string;
};

const TUNING_KINDS = new Set([
  "tuning",
  "tuningsystem",
  "temperament",
  "scale",
  "edo",
]);

function parseValue(raw: string): ParameterValueV1["value"] {
  const trimmed = raw.trim();
  const numericUnit = trimmed.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(hz|bpm|cents?)$/i,
  );
  if (numericUnit) {
    const unitByToken: Record<string, ParameterUnit> = {
      hz: "Hz",
      bpm: "BPM",
      cent: "cents",
      cents: "cents",
    };
    const token = numericUnit[2]?.toLowerCase() ?? "";
    return {
      raw,
      number: Number(numericUnit[1]),
      unit: unitByToken[token],
    };
  }

  const ratio = trimmed.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (ratio && Number(ratio[2]) !== 0) {
    return {
      raw,
      number: Number(ratio[1]) / Number(ratio[2]),
      unit: "ratio",
    };
  }

  const edo = trimmed.match(/^(\d+)\s*-\s*edo$/i);
  if (edo) return { raw, number: Number(edo[1]), unit: "EDO" };

  const equalTemperament = trimmed.match(/^(\d+)/);
  if (
    equalTemperament &&
    /(?:equal\s+temperament|\b\d+\s*-?\s*tet\b)/i.test(trimmed)
  ) {
    return {
      raw,
      number: Number(equalTemperament[1]),
      unit: "EDO",
    };
  }

  return { raw };
}

export function normalizeParameter(
  parameter: RecipeParameterInput,
): ParameterValueV1 {
  const canonicalKind =
    parameter.canonicalKind?.trim() ||
    parameter.kind?.trim() ||
    parameter.type?.trim() ||
    "unknown";
  const value = parseValue(parameter.value);

  return {
    canonicalKind,
    ...(parameter.registryStatus
      ? { registryStatus: parameter.registryStatus }
      : {}),
    value,
    lossy: value.number === undefined || value.unit === undefined,
    ...(parameter.details === undefined ? {} : { details: parameter.details }),
  };
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 64) || "recipe"
  );
}

function recipeSlug(recipe: RecipeInput): string {
  const idSuffix = slugify(recipe._id).slice(-8);
  return `${slugify(recipe.title)}-${idSuffix}`;
}

function isTuningParameter(parameter: ParameterValueV1): boolean {
  return TUNING_KINDS.has(parameter.canonicalKind.toLowerCase());
}

function explicitIntervals(details: unknown): string[] | undefined {
  if (!details || typeof details !== "object" || !("intervals" in details)) {
    return undefined;
  }
  const intervals = (details as { intervals?: unknown }).intervals;
  if (!Array.isArray(intervals) || intervals.length === 0) return undefined;

  const formatted = intervals.map((interval) => {
    if (typeof interval === "number" && Number.isFinite(interval)) {
      return interval.toFixed(5);
    }
    if (
      typeof interval === "string" &&
      /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(interval)
    ) {
      return interval.replaceAll(/\s/g, "");
    }
    return undefined;
  });

  if (formatted.some((interval) => interval === undefined)) return undefined;
  return formatted as string[];
}

function edoIntervals(parameter: ParameterValueV1): string[] | undefined {
  if (
    parameter.value.unit !== "EDO" ||
    parameter.value.number === undefined ||
    !Number.isInteger(parameter.value.number) ||
    parameter.value.number < 1 ||
    parameter.value.number > 4096
  ) {
    return undefined;
  }

  const divisions = parameter.value.number;
  return [
    ...Array.from({ length: divisions - 1 }, (_, index) =>
      (((index + 1) * 1200) / divisions).toFixed(5),
    ),
    "2/1",
  ];
}

function referenceFrequency(
  parameters: ParameterValueV1[],
): number | undefined {
  return parameters.find(
    (parameter) =>
      parameter.value.unit === "Hz" &&
      ["frequency", "referencefrequency", "concertpitch"].includes(
        parameter.canonicalKind.toLowerCase(),
      ),
  )?.value.number;
}

export function emitScl(
  filename: string,
  title: string,
  parameter: ParameterValueV1,
  referenceHz?: number,
): string | undefined {
  if (!isTuningParameter(parameter)) return undefined;
  const intervals =
    explicitIntervals(parameter.details) ?? edoIntervals(parameter);
  if (!intervals) return undefined;

  const reference = referenceHz === undefined ? "" : ` — A=${referenceHz}Hz`;
  return [
    `! ${filename}`,
    `! ${title} — ${parameter.value.raw}${reference}`,
    String(intervals.length),
    "!",
    ...intervals,
    "",
  ].join("\n");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function buildRecipeExport(
  recipe: RecipeInput,
  options: BuildOptions = {},
): { bundle: RecipeExportV1; files: EmittedFile[]; bundleFilename: string } {
  const parameters = recipe.parameters.map(normalizeParameter);
  const slug = recipeSlug(recipe);
  const referenceHz = referenceFrequency(parameters);
  const files: EmittedFile[] = [];

  for (const [index, parameter] of parameters.entries()) {
    if (!isTuningParameter(parameter)) continue;
    const filename = `${slug}-${String(index + 1).padStart(2, "0")}-${slugify(
      parameter.value.raw,
    )}.scl`;
    const content = emitScl(filename, recipe.title, parameter, referenceHz);
    if (content) files.push({ filename, content });
  }

  return {
    bundle: {
      contract: "recipe_export_v1",
      recipeId: recipe._id,
      title: recipe.title,
      hypothesisId: recipe.hypothesisId,
      ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
      parameters,
      protocol: recipe.protocol ?? null,
      dawChecklist: recipe.dawChecklist,
      assets: files.map((file) => ({
        type: "scl",
        filename: file.filename,
        sha256: sha256(file.content),
      })),
    },
    files,
    bundleFilename: `${slug}.recipe-export.json`,
  };
}

export function serializeBundle(bundle: RecipeExportV1): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

function parseArguments(args: string[]): {
  inputPath?: string;
  outDirectory: string;
  generatedAt?: string;
} {
  let inputPath: string | undefined;
  let outDirectory = "/tmp";
  let generatedAt: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--out") {
      outDirectory = args[index + 1] ?? "";
      index += 1;
    } else if (argument === "--generated-at") {
      generatedAt = args[index + 1];
      index += 1;
    } else if (!inputPath) {
      inputPath = argument;
    } else {
      throw new Error(`Unexpected argument: ${argument}`);
    }
  }

  if (!outDirectory) throw new Error("--out requires a directory");
  return { inputPath, outDirectory, generatedAt };
}

async function readRecipes(inputPath?: string): Promise<RecipeInput[]> {
  const text =
    inputPath && inputPath !== "-"
      ? await readFile(inputPath, "utf8")
      : await readStdin();
  const parsed = JSON.parse(text) as RecipeInput | RecipeInput[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function main(): Promise<void> {
  const { inputPath, outDirectory, generatedAt } = parseArguments(
    process.argv.slice(2),
  );
  const recipes = await readRecipes(inputPath);
  const outputPath = resolve(outDirectory);
  await mkdir(outputPath, { recursive: true });

  const seenFilenames = new Set<string>();
  for (const recipe of recipes) {
    const result = buildRecipeExport(recipe, { generatedAt });
    const filenames = [
      result.bundleFilename,
      ...result.files.map((file) => file.filename),
    ];
    for (const filename of filenames) {
      if (seenFilenames.has(filename)) {
        throw new Error(`Duplicate output filename: ${filename}`);
      }
      seenFilenames.add(filename);
    }

    await Promise.all([
      writeFile(
        resolve(outputPath, result.bundleFilename),
        serializeBundle(result.bundle),
      ),
      ...result.files.map((file) =>
        writeFile(resolve(outputPath, file.filename), file.content),
      ),
    ]);
  }

  console.log(`Wrote ${seenFilenames.size} files to ${outputPath}`);
}

if (import.meta.main) {
  await main();
}
