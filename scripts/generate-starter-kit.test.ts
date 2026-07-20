import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  buildStarterKit,
  starterKitMetadata,
  writeStarterKit,
  type StarterKitRecipe,
} from "./generate-starter-kit";

const tempDirectories: string[] = [];

const fixtureRecipe: StarterKitRecipe = {
  _id: "recipe-fixture-001",
  title: "Geometric Listening Study",
  whyThisMatters: "Tests whether geometric intervals change perceived focus.",
  parameters: [
    { type: "tuningSystem", value: "Geometric Temperament" },
    { type: "tempo", value: "96 BPM", details: { bpm: 96 } },
    { type: "rootNote", value: "C4" },
    { type: "rhythm", value: "quarter notes" },
    { type: "instrument", value: "soft sine synth" },
  ],
  protocol: {
    studyType: "litmus",
    durationSecs: 60,
    panelPlanned: ["self"],
    whatVaries: ["tuning"],
    whatStaysConstant: ["patch", "MIDI velocity"],
  },
  dawChecklist: ["Load tuning.scl and tuning.kbm.", "Import seed.mid."],
  hypothesis: {
    question: "Does geometric tuning create a distinct attentional quality?",
  },
};

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "starter-kit-test-"));
  tempDirectories.push(directory);
  return directory;
}

describe("starter kit assembly", () => {
  test("writes a complete four-file kit from an offline fixture recipe", async () => {
    const root = await temporaryDirectory();
    const result = await writeStarterKit(fixtureRecipe, root);

    expect(result.manifest).toEqual([
      "tuning.scl",
      "tuning.kbm",
      "seed.mid",
      "card.md",
    ]);
    await expect(
      readFile(join(result.outputDirectory, "tuning.scl"), "utf8"),
    ).resolves.toMatch(/^! tuning\.scl\n/);
    await expect(
      readFile(join(result.outputDirectory, "tuning.kbm"), "utf8"),
    ).resolves.toMatch(/^! tuning\.kbm\n/);
    expect(
      (await readFile(join(result.outputDirectory, "seed.mid"))).subarray(0, 4),
    ).toEqual(Buffer.from("MThd"));
    await expect(
      readFile(join(result.outputDirectory, "card.md"), "utf8"),
    ).resolves.toContain("# Geometric Listening Study");
  });

  test("refuses to overwrite unless force is set", async () => {
    const root = await temporaryDirectory();
    await writeStarterKit(fixtureRecipe, root);

    await expect(writeStarterKit(fixtureRecipe, root)).rejects.toThrow(
      "already exists; pass --force",
    );
    await expect(
      writeStarterKit(fixtureRecipe, root, { force: true }),
    ).resolves.toMatchObject({
      manifest: ["tuning.scl", "tuning.kbm", "seed.mid", "card.md"],
    });
  });

  test("makes degradation explicit in the parameter card", () => {
    const kit = buildStarterKit(fixtureRecipe);
    const card = kit.artifacts.find(
      (artifact) => artifact.filename === "card.md",
    );
    expect(card?.contents).toContain(
      "| instrument | soft sine synth | — | No starter-kit generator supports this parameter kind. |",
    );
    expect(card?.contents).toContain(
      "Standard MIDI notes are pitch-class scaffolding; load the Scala files to apply the intended tuning.",
    );
    expect(card?.contents).toContain(
      "Does geometric tuning create a distinct attentional quality?",
    );
    expect(card?.contents).toContain("- What varies: tuning");
    expect(card?.contents).toContain(
      "- What stays constant: patch; MIDI velocity",
    );
    expect(card?.contents).toContain("- Duration: 60 seconds");
    expect(card?.contents).toContain("- Load tuning.scl and tuning.kbm.");
    expect(card?.contents).toContain("- `seed.mid`");
  });

  test("fails rather than writing a kit containing only a card", async () => {
    const root = await temporaryDirectory();
    const ungeneratable: StarterKitRecipe = {
      ...fixtureRecipe,
      title: "Unsupported Recipe",
      parameters: [{ type: "instrument", value: "prepared piano" }],
    };

    await expect(writeStarterKit(ungeneratable, root)).rejects.toThrow(
      "No tuning or seed MIDI could be generated",
    );
  });

  test("builds stable recipe-link metadata from a written kit", () => {
    expect(
      starterKitMetadata(
        {
          slug: "geometric-listening-study",
          manifest: ["tuning.scl", "tuning.kbm", "seed.mid", "card.md"],
        },
        1234,
      ),
    ).toEqual({
      generatedAt: 1234,
      path: "exports/starter-kits/geometric-listening-study",
      manifest: ["tuning.scl", "tuning.kbm", "seed.mid", "card.md"],
    });
  });
});
