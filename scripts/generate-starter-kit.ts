// oxlint-disable-next-line import/no-unassigned-import -- Loads env-backed values before client resolution.
import "varlock/auto-load";
import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { getConvexClient } from "./lib/convexClient";
import {
  renderParameterCard,
  type ParameterDisposition,
  type StarterKitRecipe,
} from "./lib/parameterCard";
import { generateSeedMidi } from "./lib/seedMidi";
import {
  parameterKind,
  parseTuningFromParameters,
  parseTuningFromParametersWithReason,
  toKbm,
  toScl,
  type TuningSpec,
} from "./lib/tuning";

export type { StarterKitRecipe } from "./lib/parameterCard";

export interface StarterKitArtifact {
  filename: "tuning.scl" | "tuning.kbm" | "seed.mid" | "card.md";
  contents: string | Uint8Array;
}

export interface BuiltStarterKit {
  slug: string;
  artifacts: StarterKitArtifact[];
  manifest: string[];
  generatedArtifactCount: number;
}

export interface WrittenStarterKit extends BuiltStarterKit {
  outputDirectory: string;
}

const TUNING_KINDS = new Set([
  "edo",
  "scale",
  "temperament",
  "tuning",
  "tuningsystem",
]);
const SEED_KINDS = new Set([
  "chordprogression",
  "form",
  "key",
  "note",
  "rhythm",
  "rootnote",
  "tempo",
]);

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 72) || "recipe"
  );
}

function tuningParameterIndex(recipe: StarterKitRecipe): number | null {
  for (const [index, parameter] of recipe.parameters.entries()) {
    if (parseTuningFromParameters([parameter]) !== null) return index;
  }
  return null;
}

function rootNote(recipe: StarterKitRecipe): string | undefined {
  const parameter = recipe.parameters.find((candidate) =>
    ["key", "note", "rootnote"].includes(
      parameterKind(candidate).toLowerCase(),
    ),
  );
  return parameter?.value.match(/[A-Ga-g][#b]?-?\d*/)?.[0];
}

function buildDispositions(
  recipe: StarterKitRecipe,
  tuning: TuningSpec | null,
  tuningIndex: number | null,
  seedIndexes: number[],
): ParameterDisposition[] {
  const honoredBySeed = new Set(seedIndexes);
  return recipe.parameters.map((parameter, index) => {
    const kind = parameterKind(parameter).toLowerCase();
    if (index === tuningIndex && tuning) {
      return {
        index,
        honored: true,
        reason: "Generated tuning.scl and tuning.kbm from this parameter.",
      };
    }
    if (TUNING_KINDS.has(kind)) {
      return {
        index,
        honored: false,
        reason:
          tuningIndex === null
            ? "The tuning value could not be expressed by the supported generators."
            : "This comparison tuning was not selected; one kit emits one tuning file pair.",
      };
    }
    if (honoredBySeed.has(index)) {
      return {
        index,
        honored: true,
        reason: "Applied to the deterministic seed MIDI.",
      };
    }
    if (SEED_KINDS.has(kind)) {
      return {
        index,
        honored: false,
        reason: "The parameter value could not be parsed within the starter-kit contract.",
      };
    }
    return {
      index,
      honored: false,
      reason: "No starter-kit generator supports this parameter kind.",
    };
  });
}

export function buildStarterKit(recipe: StarterKitRecipe): BuiltStarterKit {
  const artifacts: StarterKitArtifact[] = [];
  const degradationNotes: string[] = [];
  const tuningResult = parseTuningFromParametersWithReason(recipe.parameters);
  const tuning = tuningResult.spec;
  const selectedTuningIndex = tuningParameterIndex(recipe);
  let seedIndexes: number[] = [];

  if (tuning) {
    artifacts.push({
      filename: "tuning.scl",
      contents: toScl(tuning, `${recipe.title} starter-kit tuning`),
    });
    artifacts.push({
      filename: "tuning.kbm",
      contents: toKbm(tuning, rootNote(recipe)),
    });
  } else {
    degradationNotes.push(tuningResult.reason.message);
  }

  const seed = generateSeedMidi(
    recipe.parameters,
    tuning ?? { kind: "edo", divisions: 12 },
  );
  if (tuning || seed.honoredParameterIndexes.length > 0) {
    seedIndexes = seed.honoredParameterIndexes;
    if (!tuning) {
      degradationNotes.push(
        "Seed MIDI uses a 12-EDO pitch palette because no recipe tuning was generatable.",
      );
    }
    artifacts.push({ filename: "seed.mid", contents: seed.bytes });
  }

  degradationNotes.push(
    "Standard MIDI notes are pitch-class scaffolding; load the Scala files to apply the intended tuning.",
  );
  const manifest = [...artifacts.map((artifact) => artifact.filename), "card.md"];
  const dispositions = buildDispositions(
    recipe,
    tuning,
    selectedTuningIndex,
    seedIndexes,
  );
  artifacts.push({
    filename: "card.md",
    contents: renderParameterCard({
      recipe,
      dispositions,
      degradationNotes,
      manifest,
    }),
  });

  return {
    slug: slugify(recipe.title),
    artifacts,
    manifest,
    generatedArtifactCount: artifacts.length - 1,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeStarterKit(
  recipe: StarterKitRecipe,
  rootDirectory: string,
  options: { force?: boolean } = {},
): Promise<WrittenStarterKit> {
  const kit = buildStarterKit(recipe);
  if (kit.generatedArtifactCount === 0) {
    throw new Error(
      "No tuning or seed MIDI could be generated; refusing to write a card-only kit.",
    );
  }

  const outputDirectory = resolve(rootDirectory, kit.slug);
  if ((await pathExists(outputDirectory)) && !options.force) {
    throw new Error(
      `Starter kit ${outputDirectory} already exists; pass --force to overwrite generated files.`,
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    kit.artifacts.map((artifact) =>
      writeFile(resolve(outputDirectory, artifact.filename), artifact.contents),
    ),
  );
  return { ...kit, outputDirectory };
}

function parseArguments(args: string[]): { recipeId: string; force: boolean } {
  let recipeId: string | undefined;
  let force = false;
  for (const argument of args) {
    if (argument === "--force") force = true;
    else if (!recipeId) recipeId = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }
  if (!recipeId) {
    throw new Error("Usage: vpx tsx scripts/generate-starter-kit.ts <recipeId> [--force]");
  }
  return { recipeId, force };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const { recipeId, force } = parseArguments(args);
  const client = getConvexClient();
  const recipe = await client.query(api.recipes.get, {
    id: recipeId as Id<"recipes">,
  });
  if (!recipe) throw new Error(`Recipe not found: ${recipeId}`);

  const result = await writeStarterKit(
    recipe,
    resolve(process.cwd(), "exports/starter-kits"),
    { force },
  );
  console.log(`Wrote starter kit: ${result.outputDirectory}`);
  console.log(`Manifest: ${result.manifest.join(", ")}`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
