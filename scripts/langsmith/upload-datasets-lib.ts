export interface ExampleLike {
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
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
          { cause: error },
        );
      }
    });
}

export function pickKeys(row: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, row[key]]));
}

export function assertRowsHaveKeys(
  rows: Record<string, unknown>[],
  keys: string[],
  path: string,
) {
  rows.forEach((row, index) => {
    const missing = keys.filter((key) => !(key in row));
    if (missing.length > 0) {
      throw new Error(
        `${path}:${index + 1}: missing configured fields: ${missing.join(", ")}`,
      );
    }
  });
}

export function canonicalInputKey(
  rowOrInputs: Record<string, unknown>,
  inputKeys: string[],
) {
  return stableStringify(inputKeys.map((key) => [key, rowOrInputs[key]]));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortJson(value));
}

export function canonicalExampleKey(
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
  inputKeys: string[],
  outputKeys: string[],
) {
  return stableStringify([
    inputKeys.map((key) => [key, inputs[key]]),
    outputKeys.map((key) => [key, outputs[key]]),
  ]);
}

export function buildMissingExamples(
  rows: Record<string, unknown>[],
  existing: ExampleLike[],
  inputKeys: string[],
  outputKeys: string[],
) {
  const existingKeys = new Set(
    existing
      .filter(
        (
          example,
        ): example is {
          inputs: Record<string, unknown>;
          outputs: Record<string, unknown>;
        } => Boolean(example.inputs) && Boolean(example.outputs),
      )
      .map((example) =>
        canonicalExampleKey(
          example.inputs,
          example.outputs,
          inputKeys,
          outputKeys,
        ),
      ),
  );

  const missing: ExampleCreateLike[] = [];
  for (const row of rows) {
    const inputs = pickKeys(row, inputKeys);
    const outputs = pickKeys(row, outputKeys);
    const key = canonicalExampleKey(inputs, outputs, inputKeys, outputKeys);
    if (existingKeys.has(key)) continue;

    missing.push({
      inputs,
      outputs,
    });
    existingKeys.add(key);
  }

  return missing;
}
