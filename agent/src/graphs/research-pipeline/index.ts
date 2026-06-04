import { END, START, StateGraph } from "@langchain/langgraph";
import { ResearchPipelineAnnotation } from "../../state/researchPipelineState.js";
import {
  createReviewDraftNode,
  finalizeRunNode,
  initializeRunNode,
  loadScopeNode,
  routeCandidateNode,
  selectCandidatesNode,
  unsupportedWriteRouteNode,
} from "./nodes.js";

export const graph = new StateGraph(ResearchPipelineAnnotation)
  .addNode("initialize_run", initializeRunNode)
  .addNode("load_scope", loadScopeNode)
  .addNode("select_candidates", selectCandidatesNode)
  .addNode("create_review_draft", createReviewDraftNode)
  .addNode("unsupported_write_route", unsupportedWriteRouteNode)
  .addNode("finalize_run", finalizeRunNode)
  .addEdge(START, "initialize_run")
  .addEdge("initialize_run", "load_scope")
  .addEdge("load_scope", "select_candidates")
  .addConditionalEdges("select_candidates", routeCandidateNode, {
    extract: "unsupported_write_route",
    hypothesize: "create_review_draft",
    recipe: "create_review_draft",
    critique: "unsupported_write_route",
    archive: "unsupported_write_route",
    stop: "finalize_run",
  })
  .addEdge("create_review_draft", "finalize_run")
  .addEdge("unsupported_write_route", "finalize_run")
  .addEdge("finalize_run", END)
  .compile();
