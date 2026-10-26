import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { AIMessage } from "@langchain/core/messages";
import { createDeepAgent } from "deepagents";
import { traceable } from "langsmith/traceable";
import extract from "extract-zip";
import braces from "braces";
import { TASK_MODELS } from "../../convex/shared/llmPolicy.ts";

assert.equal(new AIMessage("image smoke").content, "image smoke");
assert.equal(typeof createDeepAgent, "function");
assert.equal(typeof traceable, "function");
assert.equal(typeof extract, "function");
assert.ok(Object.keys(TASK_MODELS).length > 0);
for (const method of ["compile", "expand", "stringify", "parse"]) {
  assert.throws(
    () => braces[method]("{".repeat(4999) + "x" + "}".repeat(4999)),
    /nesting depth/,
    `the image must apply the braces security patch for ${method}`,
  );
}
const config = JSON.parse(await readFile("langgraph.json", "utf8"));
for (const graph of Object.values(config.graphs)) {
  const path = typeof graph === "string" ? graph : graph.path;
  await access(path.split(":")[0]);
}
const peers = spawnSync("npm", ["ls", "--all", "--omit=optional"], {
  stdio: "inherit",
});
assert.equal(peers.status, 0, "npm must resolve a valid peer dependency tree");
console.log(
  "LangGraph image: dependencies, shared contracts, graph files and npm peers OK",
);
