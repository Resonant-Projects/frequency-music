// Render the agent-tool tables from the shared manifest.
// Usage: bun scripts/generate-agent-tool-docs.ts [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { AGENT_TOOL_MANIFEST } from "../convex/shared/agentToolManifest";

const DOC = "docs/agent-tool-surface.md";
const BEGIN = "<!-- AGENT_TOOLS:BEGIN -->";
const END = "<!-- AGENT_TOOLS:END -->";

function table(kind: "read" | "audit_write"): string {
  const rows = AGENT_TOOL_MANIFEST.filter((tool) => tool.kind === kind).map(
    (tool) =>
      `| \`${tool.name}\` | \`/agent-tools/${tool.name}\` | \`${tool.backing}\` | ${tool.description} | ${tool.context} |`,
  );
  return [
    "| Tool | HTTP path | Backing function | Purpose | Context notes |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

const generated = [
  BEGIN,
  "",
  "### Read-only research tools",
  "",
  table("read"),
  "",
  "### Audit-only write tools",
  "",
  "These are the only write tools currently exposed. They write only to agent audit/review records and must not substitute for approved research-data writes.",
  "",
  table("audit_write"),
  "",
  END,
].join("\n");

const current = readFileSync(DOC, "utf8");
const pattern = new RegExp(`${BEGIN}[\\s\\S]*${END}`);
if (!pattern.test(current)) {
  console.error(`Markers not found in ${DOC}.`);
  process.exit(2);
}
const next = current.replace(pattern, generated);

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
