// oxlint-disable-next-line import/no-unassigned-import -- Loads env-backed values before client resolution.
import "varlock/auto-load";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Id } from "../convex/_generated/dataModel";
import { api } from "../convex/_generated/api";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";
import {
  renderParameterCard,
  type ParameterDisposition,
  type StarterKitRecipe,
} from "./lib/parameterCard";
import { generateSeedMidi, isSeedParameter } from "./lib/seedMidi";
import {
  isTuningParameter,
  parameterKind,
  parsePitchToken,
  parseTuningFromParametersWithReason,
  ROOT_NOTE_KINDS,
  slugify,
  toKbm,
  toScl,
  type TuningSpec,
} from "./lib/tuning";

export type { StarterKitRecipe } from "./lib/parameterCard";

const GENERATED_FILENAMES = [
  "tuning.scl",
  "tuning.kbm",
  "seed.mid",
  "card.md",
] as const;

export type GeneratedFilename = (typeof GENERATED_FILENAMES)[number];

export interface StarterKitArtifact {
  filename: GeneratedFilename;
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

export interface StarterKitMetadata {
  generatedAt: number;
  path: string;
  manifest: string[];
}

function tuningParameterIndex(
  recipe: StarterKitRecipe,
  tuning: TuningSpec | null,
): number | null {
  if (tuning === null) return null;
  const index = recipe.parameters.findIndex(isTuningParameter);
  return index === -1 ? null : index;
}

function rootNote(recipe: StarterKitRecipe): string | undefined {
  const parameter = recipe.parameters.find((candidate) =>
    ROOT_NOTE_KINDS.has(parameterKind(candidate).toLowerCase()),
  );
  return parameter
    ? (parsePitchToken(parameter.value) ?? undefined)
    : undefined;
}

function buildDispositions(
  recipe: StarterKitRecipe,
  tuning: TuningSpec | null,
  tuningIndex: number | null,
  seedIndexes: number[],
): ParameterDisposition[] {
  const honoredBySeed = new Set(seedIndexes);
  return recipe.parameters.map((parameter, index) => {
    if (index === tuningIndex && tuning) {
      return {
        index,
        honored: true,
        reason: "Generated tuning.scl and tuning.kbm from this parameter.",
      };
    }
    if (isTuningParameter(parameter)) {
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
    if (isSeedParameter(parameter)) {
      return {
        index,
        honored: false,
        reason:
          "The parameter value could not be parsed within the starter-kit contract.",
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
  const selectedTuningIndex = tuningParameterIndex(recipe, tuning);
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
  const manifest = [
    ...artifacts.map((artifact) => artifact.filename),
    "card.md",
  ];
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
  const outputExists = await pathExists(outputDirectory);
  if (outputExists && !options.force) {
    throw new Error(
      `Starter kit ${outputDirectory} already exists; pass --force to overwrite generated files.`,
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  if (outputExists && options.force) {
    await Promise.all(
      GENERATED_FILENAMES.map((filename) =>
        rm(resolve(outputDirectory, filename), { force: true }),
      ),
    );
  }
  await Promise.all(
    kit.artifacts.map((artifact) =>
      writeFile(resolve(outputDirectory, artifact.filename), artifact.contents),
    ),
  );
  return { ...kit, outputDirectory };
}

export function starterKitMetadata(
  kit: Pick<WrittenStarterKit, "slug" | "manifest">,
  generatedAt: number,
): StarterKitMetadata {
  return {
    generatedAt,
    path: `exports/starter-kits/${kit.slug}`,
    manifest: kit.manifest,
  };
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
    throw new Error(
      "Usage: vpx tsx scripts/generate-starter-kit.ts <recipeId> [--force]",
    );
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
  await client.mutation(api.recipes.update, {
    id: recipe._id,
    starterKit: starterKitMetadata(result, Date.now()),
    devBypassSecret: getDevBypassSecret(),
  });
  console.log(`Wrote starter kit: ${result.outputDirectory}`);
  console.log(`Manifest: ${result.manifest.join(", ")}`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
