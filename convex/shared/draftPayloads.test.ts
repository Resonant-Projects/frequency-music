import { describe, expect, test } from "bun:test";
import {
  agentDraftHypothesisPayloadValidator as schemaHypothesisValidator,
  agentDraftRecipePayloadValidator as schemaRecipeValidator,
  agentReviewDraftPayloadValidator as schemaUnionValidator,
  recipeProtocolValidator as schemaProtocolValidator,
} from "../schema";
import {
  agentDraftHypothesisPayloadValidator,
  agentDraftRecipePayloadValidator,
  agentReviewDraftPayloadValidator,
  hypothesisDraftPayloadZ,
  recipeDraftPayloadZ,
  recipeProtocolValidator,
} from "./draftPayloads";

const field = (fieldType: unknown, optional = false) => ({
  fieldType,
  optional,
});
const object = (value: Record<string, unknown>) => ({ type: "object", value });
const array = (value: unknown) => ({ type: "array", value });
const id = (tableName: string) => ({ type: "id", tableName });
const literal = (value: string) => ({ type: "literal", value });
const union = (...value: unknown[]) => ({ type: "union", value });
const string = { type: "string" };
const number = { type: "number" };
const any = { type: "any" };

const FROZEN_PROTOCOL = object({
  studyType: field(union(literal("litmus"), literal("comparison"))),
  durationSecs: field(number),
  panelPlanned: field(array(string)),
  listeningContext: field(string, true),
  listeningMethod: field(string, true),
  baselineArtifactId: field(id("compositions"), true),
  whatVaries: field(array(string)),
  whatStaysConstant: field(array(string)),
});

const FROZEN_HYPOTHESIS = object({
  title: field(string),
  question: field(string),
  statement: field(string),
  rationale: field(string),
  whyThisMatters: field(string),
  concepts: field(array(string), true),
  sourceIds: field(array(id("sources"))),
  extractionIds: field(array(id("extractions"))),
  thesisId: field(id("theses"), true),
  confidence: field(number, true),
});

const FROZEN_PARAMETER = object({
  kind: field(string, true),
  type: field(string, true),
  value: field(string),
  details: field(any, true),
  registryStatus: field(
    union(
      literal("known"),
      literal("provisional"),
      literal("experimental"),
      literal("deprecated"),
    ),
    true,
  ),
  canonicalKind: field(string, true),
});

const FROZEN_RECIPE = object({
  hypothesisId: field(id("hypotheses"), true),
  title: field(string),
  parameters: field(array(FROZEN_PARAMETER)),
  protocol: field(FROZEN_PROTOCOL, true),
  whyThisMatters: field(string),
  bodyMd: field(string, true),
  dawChecklist: field(array(string), true),
  instrumentationNotes: field(string, true),
});

const FROZEN_UNION = union(FROZEN_HYPOTHESIS, FROZEN_RECIPE);

describe("frozen pre-swap draft validator shapes", () => {
  test("schema validators match the captured hand-written shapes", () => {
    expect(schemaHypothesisValidator.json).toEqual(FROZEN_HYPOTHESIS);
    expect(schemaRecipeValidator.json).toEqual(FROZEN_RECIPE);
    expect(schemaUnionValidator.json).toEqual(FROZEN_UNION);
    expect(schemaProtocolValidator.json).toEqual(FROZEN_PROTOCOL);
  });
});

describe("zod-first draft payload validators", () => {
  test("derived validators are shape-identical to the frozen validators", () => {
    expect(agentDraftHypothesisPayloadValidator.json).toEqual(
      FROZEN_HYPOTHESIS,
    );
    expect(agentDraftRecipePayloadValidator.json).toEqual(FROZEN_RECIPE);
    expect(agentReviewDraftPayloadValidator.json).toEqual(FROZEN_UNION);
    expect(recipeProtocolValidator.json).toEqual(FROZEN_PROTOCOL);
  });

  test("zod keeps agent-facing refinements", () => {
    expect(
      hypothesisDraftPayloadZ.safeParse({
        title: "",
        question: "q",
        statement: "s",
        rationale: "r",
        whyThisMatters: "w",
        sourceIds: [],
        extractionIds: [],
      }).success,
    ).toBe(false);
  });

  test("recipe payload accepts the full composition parameter shape", () => {
    const parsed = recipeDraftPayloadZ.safeParse({
      title: "t",
      whyThisMatters: "w",
      parameters: [
        {
          kind: "tempo",
          type: "tempo",
          value: "96bpm",
          details: { curve: "linear" },
          registryStatus: "provisional",
          canonicalKind: "tempo",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});
