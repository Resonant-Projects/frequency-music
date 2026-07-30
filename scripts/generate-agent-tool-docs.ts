// Render the agent-tool tables from the shared manifest.
// Usage: bun scripts/generate-agent-tool-docs.ts [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { renderAgentToolDocs } from "./lib/agentToolDocs";

const DOC = "docs/agent-tool-surface.md";

const current = readFileSync(DOC, "utf8");
let next: string;
try {
  next = renderAgentToolDocs(current);
} catch {
  console.error(`Markers not found in ${DOC}.`);
  process.exit(2);
}

if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error(
      `${DOC} is stale. Run: bun scripts/generate-agent-tool-docs.ts`,
    );
    process.exit(1);
  }
  console.log(`${DOC} is up to date.`);
} else {
  writeFileSync(DOC, next);
  console.log(`${DOC} regenerated.`);
}
