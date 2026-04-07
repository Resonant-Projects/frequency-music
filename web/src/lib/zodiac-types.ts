import type { Doc } from "../../../convex/_generated/dataModel";

export type ConstellationConcept = Pick<
  Doc<"concepts">,
  "_id" | "name" | "displayName" | "mentionCount" | "domain"
>;

export interface ZodiacConstellationEdge {
  from: string;
  to: string;
  relationship: string;
}

export interface ZodiacSubTopic {
  label: string;
  conceptNames: string[];
  itemCount: number;
}

export type OrbitalSource = Pick<
  Doc<"sources">,
  "_id" | "title" | "status" | "topics" | "createdAt"
>;

export type OrbitalExtraction = Pick<
  Doc<"extractions">,
  "_id" | "sourceId" | "confidence" | "topics"
>;

export type OrbitalHypothesis = Pick<Doc<"hypotheses">, "_id" | "title" | "status" | "concepts">;

export type OrbitalRecipe = Pick<Doc<"recipes">, "_id" | "title" | "hypothesisId" | "status">;

export interface ItemRelation {
  id: string;
  type: string;
  title: string;
  relationship: string;
}

export type PipelineSectionItem =
  | Pick<Doc<"sources">, "_id" | "title" | "status">
  | Pick<Doc<"hypotheses">, "_id" | "title" | "status">
  | Pick<Doc<"recipes">, "_id" | "title" | "status">;

export interface ConceptDetailData {
  concept: Doc<"concepts">;
  linkedSources: Array<Pick<Doc<"sources">, "_id" | "title" | "status">>;
  linkedHypotheses: Array<Pick<Doc<"hypotheses">, "_id" | "title" | "status">>;
  linkedRecipes: Array<Pick<Doc<"recipes">, "_id" | "title" | "status">>;
  edgeCount: number;
}
