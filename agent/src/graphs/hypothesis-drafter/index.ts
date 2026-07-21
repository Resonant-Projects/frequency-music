import { END, START, StateGraph } from "@langchain/langgraph";
import { HypothesisDrafterAnnotation } from "../../state/hypothesisDrafterState.js";
import {
  checkCapacityNode,
  draftNode,
  gatherContextNode,
  pickTargetNode,
  routeAfterCapacity,
  routeAfterSelfCheck,
  routeAfterTarget,
  selfCheckNode,
  summarizeNode,
  writeDraftNode,
} from "./nodes.js";

export const graph = new StateGraph(HypothesisDrafterAnnotation)
  .addNode("check_capacity", checkCapacityNode)
  .addNode("pick_target", pickTargetNode)
  .addNode("gather_context", gatherContextNode)
  .addNode("draft", draftNode)
  .addNode("self_check", selfCheckNode)
  .addNode("write_draft", writeDraftNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "check_capacity")
  .addConditionalEdges("check_capacity", routeAfterCapacity, {
    pick_target: "pick_target",
    summarize: "summarize",
  })
  .addConditionalEdges("pick_target", routeAfterTarget, {
    gather_context: "gather_context",
    summarize: "summarize",
  })
  .addEdge("gather_context", "draft")
  .addEdge("draft", "self_check")
  .addConditionalEdges("self_check", routeAfterSelfCheck, {
    draft: "draft",
    write_draft: "write_draft",
    summarize: "summarize",
  })
  .addEdge("write_draft", "summarize")
  .addEdge("summarize", END)
  .compile();
