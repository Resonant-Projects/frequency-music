export interface ExampleLike {
  inputs?: Record<string, unknown>;
}

export interface ExampleCreateLike {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export function parseJsonlRows(
  text: string,
  path: string,
): Record<string, unknown>[] {
  return text
    .split("\n")
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      try {
        const parsed = JSON.parse(line);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("row must be a JSON object");
        }
        return parsed as Record<string, unknown>;
      } catch (error) {
        throw new Error(
          `${path}:${lineNumber}: invalid JSONL row: ${(error as Error).message}`,
        );
      }
    });
}

export function pickKeys(row: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, row[key]]));
}

export function canonicalInputKey(
  rowOrInputs: Record<string, unknown>,
  inputKeys: string[],
) {
  return JSON.stringify(inputKeys.map((key) => [key, rowOrInputs[key]]));
}

export function buildMissingExamples(
  rows: Record<string, unknown>[],
  existing: ExampleLike[],
  inputKeys: string[],
  outputKeys: string[],
) {
  const existingKeys = new Set(
    existing
      .map((example) => example.inputs)
      .filter((inputs): inputs is Record<string, unknown> => Boolean(inputs))
      .map((inputs) => canonicalInputKey(inputs, inputKeys)),
  );

  const missing: ExampleCreateLike[] = [];
  for (const row of rows) {
    const inputs = pickKeys(row, inputKeys);
    const key = canonicalInputKey(inputs, inputKeys);
    if (existingKeys.has(key)) continue;

    missing.push({
      inputs,
      outputs: pickKeys(row, outputKeys),
    });
    existingKeys.add(key);
  }

  return missing;
}
