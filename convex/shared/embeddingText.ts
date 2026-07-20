export type ConceptEmbeddingInput = {
  displayName: string;
  description?: string;
  aliases: string[];
};

export function conceptEmbeddingText(input: ConceptEmbeddingInput): string {
  const parts = [input.displayName.trim()];
  const description = input.description?.trim();
  if (description) parts.push(description);
  const aliases = input.aliases.map((alias) => alias.trim()).filter(Boolean);
  if (aliases.length > 0) parts.push(`Aliases: ${aliases.join(", ")}`);
  return parts.filter(Boolean).join("\n");
}

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Chunk size must be a positive integer");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
