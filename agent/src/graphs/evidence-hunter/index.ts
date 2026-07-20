import { END, START, StateGraph } from "@langchain/langgraph";
import { EvidenceHunterAnnotation } from "../../state/evidenceHunterState.js";
import {
  addEvidenceNode,
  judgeStanceNode,
  pickTargetsNode,
  routeAfterTargets,
  searchClaimsNode,
  summarizeNode,
} from "./nodes.js";

export const graph = new StateGraph(EvidenceHunterAnnotation)
  .addNode("pick_targets", pickTargetsNode)
  .addNode("search_claims", searchClaimsNode)
  .addNode("judge_stance", judgeStanceNode)
  .addNode("add_evidence", addEvidenceNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "pick_targets")
  .addConditionalEdges("pick_targets", routeAfterTargets, {
    search_claims: "search_claims",
    summarize: "summarize",
  })
  .addEdge("search_claims", "judge_stance")
  .addEdge("judge_stance", "add_evidence")
  .addEdge("add_evidence", "summarize")
  .addEdge("summarize", END)
  .compile();
