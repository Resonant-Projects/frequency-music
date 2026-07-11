export function normalizeConceptDomainSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-");
}
