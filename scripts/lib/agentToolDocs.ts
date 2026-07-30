import { AGENT_TOOL_MANIFEST } from "../../convex/shared/agentToolManifest";

const BEGIN = "<!-- AGENT_TOOLS:BEGIN -->";
const END = "<!-- AGENT_TOOLS:END -->";

function table(kind: "read" | "research_write" | "audit_write"): string {
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
  "### Direct provenance-stamped research write tools",
  "",
  "These provenance-stamped research writes are limited to reversible graph enrichment, canonical source intake, and disabled feed proposals. They enforce their domain-specific invariants in Convex mutations.",
  "",
  table("research_write"),
  "",
  "### Audit-only write tools",
  "",
  "These tools write only to agent audit/review records and must not substitute for approved research-data writes.",
  "",
  table("audit_write"),
  "",
  END,
].join("\n");

export function renderAgentToolDocs(current: string): string {
  const pattern = new RegExp(`${BEGIN}[\\s\\S]*${END}`);
  if (!pattern.test(current)) {
    throw new Error("Agent tool markers not found.");
  }
  return current.replace(pattern, generated);
}
