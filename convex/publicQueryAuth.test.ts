import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { UNGATED_PUBLIC_QUERIES } from "./publicQueryAllowlist";

const CONVEX_DIR = new URL(".", import.meta.url);

// Calls that refuse a caller with no identity and no service secret.
// requireOperatorIdentity is the sources.ts wrapper around requireAuth.
const GATE_CALLS = [
  "requireReader(",
  "requireAuth(",
  "requireHumanIdentity(",
  "requireDecisionUser(",
  "requireOperatorIdentity(",
];

function isModuleFile(name: string) {
  return (
    name.endsWith(".ts") &&
    !name.endsWith(".test.ts") &&
    name !== "testHelpers.ts"
  );
}

/** Keys ("<module>:<name>") of public queries that run with no gate. */
function ungatedPublicQueries(): string[] {
  const ungated: string[] = [];
  for (const name of readdirSync(CONVEX_DIR).filter(isModuleFile).toSorted()) {
    const source = readFileSync(new URL(name, CONVEX_DIR), "utf8");
    for (const match of source.matchAll(
      /^export const (\w+) = (query|readerQuery)\(/gm,
    )) {
      if (match[2] === "readerQuery") continue;
      const rest = source.slice(match.index);
      // The declaration ends at its closing `});`. Stopping at the next
      // export instead would credit it with a helper declared below it.
      const ends = [rest.indexOf("\n});"), rest.indexOf("\nexport const ", 1)];
      const end = Math.min(...ends.filter((i) => i !== -1), rest.length);
      const body = rest.slice(0, end);
      if (GATE_CALLS.some((call) => body.includes(call))) continue;
      ungated.push(`${name.slice(0, -".ts".length)}:${match[1]}`);
    }
  }
  return ungated;
}

describe("public query auth", () => {
  const ungated = ungatedPublicQueries();

  test("every ungated public query is on the allowlist", () => {
    const unlisted = ungated.filter((key) => !(key in UNGATED_PUBLIC_QUERIES));
    expect(unlisted).toEqual([]);
  });

  test("every allowlist entry still names an ungated public query", () => {
    const live = new Set(ungated);
    const stale = Object.keys(UNGATED_PUBLIC_QUERIES).filter(
      (key) => !live.has(key),
    );
    expect(stale).toEqual([]);
  });

  test("Sources, inbox and listening reads are all gated", () => {
    const tier = Object.keys(UNGATED_PUBLIC_QUERIES).filter((key) =>
      /^(sources|inbox|listening):/.test(key),
    );
    expect(tier).toEqual([]);
  });
});
