import { END, START, StateGraph } from "@langchain/langgraph";
import { ResearchPipelineAnnotation } from "../../state/researchPipelineState.js";
import {
  finalizeRunNode,
  loadScopeNode,
  routeCandidateNode,
  selectCandidatesNode,
  unsupportedWriteRouteNode,
} from "./nodes.js";

export const graph = new StateGraph(ResearchPipelineAnnotation)
  .addNode("load_scope", loadScopeNode)
  .addNode("select_candidates", selectCandidatesNode)
  .addNode("unsupported_write_route", unsupportedWriteRouteNode)
  .addNode("finalize_run", finalizeRunNode)
  .addEdge(START, "load_scope")
  .addEdge("load_scope", "select_candidates")
  .addConditionalEdges("select_candidates", routeCandidateNode, {
    extract: "unsupported_write_route",
    hypothesize: "unsupported_write_route",
    recipe: "unsupported_write_route",
    critique: "unsupported_write_route",
    archive: "unsupported_write_route",
    stop: "finalize_run",
  })
  .addEdge("unsupported_write_route", "finalize_run")
  .addEdge("finalize_run", END)
  .compile();
