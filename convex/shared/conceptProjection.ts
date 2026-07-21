import type { Doc } from "../_generated/dataModel";

export function conceptDomains(concept: Doc<"concepts">): string[] {
  return Array.from(new Set(concept.domains ?? [concept.domain])).toSorted();
}

export function describeConcept(concept: Doc<"concepts">) {
  return {
    name: concept.name,
    displayName: concept.displayName,
    description: concept.description,
    domains: conceptDomains(concept),
  };
}
