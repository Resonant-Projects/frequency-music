import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type RunCommand = (command: string, args: readonly string[]) => number;

/** The CLI can exit 0 after Docker fails. Inspect a fresh tag, never an old build. */
export function verifyBuiltImage(
  run: RunCommand,
  cli: readonly [string, readonly string[]],
  candidate: string,
  target: string,
): void {
  if (run(cli[0], cli[1]) !== 0) throw new Error("LangGraph CLI build failed");
  if (run("docker", ["image", "inspect", candidate]) !== 0)
    throw new Error(`LangGraph CLI produced no image: ${candidate}`);
  if (
    run("docker", [
      "run",
      "--rm",
      "--network=none",
      "--entrypoint",
      "node",
      candidate,
      "scripts/smoke-langgraph-image.mjs",
    ]) !== 0
  )
    throw new Error("LangGraph image smoke check failed");
  if (run("docker", ["tag", candidate, target]) !== 0)
    throw new Error("Could not tag the verified LangGraph image");
}

async function buildImage(): Promise<void> {
  const agent = dirname(dirname(fileURLToPath(import.meta.url)));
  const temporary = await mkdtemp(join(tmpdir(), "frequency-langgraph-"));
  const context = join(temporary, "agent");
  const target =
    process.env.LANGGRAPH_IMAGE_TAG ?? "resonant-projects-agent:local";
  const candidate = `${target}-${randomUUID()}`;
  const run: RunCommand = (command, args) => {
    const result = spawnSync(command, [...args], { stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  };
  try {
    await cp(agent, context, {
      recursive: true,
      filter: (path) => {
        const name = basename(path);
        return (
          name !== "node_modules" &&
          name !== "dist" &&
          (!name.startsWith(".env") || name === ".env.schema")
        );
      },
    });
    // The CLI's Docker context otherwise omits these real cross-package imports.
    await cp(join(agent, "../convex/shared"), join(context, "convex/shared"), {
      recursive: true,
    });
    // npm does not apply Bun's patchedDependencies. Reuse the reviewed code
    // hunks, retaining the upstream manifest so npm's peer validation is real.
    const bracesPatch = await readFile(
      join(context, "patches/braces@3.0.3.patch"),
      "utf8",
    );
    const manifestHunk = "diff --git a/package.json b/package.json";
    if (!bracesPatch.includes(manifestHunk))
      throw new Error("Braces patch is missing its expected manifest hunk");
    await writeFile(
      join(context, "patches/braces-code.patch"),
      bracesPatch.split(manifestHunk)[0],
    );
    const manifestPath = join(context, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.scripts = {
      ...manifest.scripts,
      postinstall: [
        manifest.scripts?.postinstall,
        "patch --batch --fuzz=0 -p1 -d node_modules/braces < patches/braces-code.patch",
      ]
        .filter(Boolean)
        .join(" && "),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const config = JSON.parse(
      await readFile(join(context, "langgraph.json"), "utf8"),
    );
    config.dockerfile_lines = [
      ...(config.dockerfile_lines ?? []),
      "RUN apt-get update && apt-get install -y --no-install-recommends patch && rm -rf /var/lib/apt/lists/*",
      "COPY convex/shared /deps/convex/shared",
      "RUN ln -s /deps/agent/node_modules /deps/node_modules",
    ];
    await writeFile(
      join(context, "langgraph.json"),
      `${JSON.stringify(config, null, 2)}\n`,
    );
    verifyBuiltImage(
      run,
      [
        process.execPath,
        [
          join(agent, "node_modules/@langchain/langgraph-cli/dist/cli/cli.mjs"),
          "build",
          "--config",
          join(context, "langgraph.json"),
          "--tag",
          candidate,
        ],
      ],
      candidate,
      target,
    );
    console.log(`Verified LangGraph image: ${target}`);
  } finally {
    // Drop only this attempt's tag; the verified target keeps the image alive.
    spawnSync("docker", ["rmi", candidate], { stdio: "ignore" });
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  buildImage().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
