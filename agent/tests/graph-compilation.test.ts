import { describe, expect, test } from "vitest";
import { graph as correspondenceMinerGraph } from "../src/graphs/correspondence-miner";
import { graph as evidenceHunterGraph } from "../src/graphs/evidence-hunter";
import { graph as hypothesisDrafterGraph } from "../src/graphs/hypothesis-drafter";
import { graph as researchPipelineGraph } from "../src/graphs/research-pipeline";
import { graph as sourceScoutGraph } from "../src/graphs/source-scout";

describe("production graph compilation", () => {
  test("imports every registered LangGraph without state-channel collisions", () => {
    expect(correspondenceMinerGraph).toBeDefined();
    expect(evidenceHunterGraph).toBeDefined();
    expect(hypothesisDrafterGraph).toBeDefined();
    expect(researchPipelineGraph).toBeDefined();
    expect(sourceScoutGraph).toBeDefined();
  });
});
