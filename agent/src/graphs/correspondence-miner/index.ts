import { END, START, StateGraph } from "@langchain/langgraph";
import { CorrespondenceMinerAnnotation } from "../../state/correspondenceMinerState.js";
import {
  fetchCandidatesNode,
  judgeLoopNode,
  routeAfterFetch,
  summarizeNode,
  writeOrDiscardNode,
} from "./nodes.js";

export const graph = new StateGraph(CorrespondenceMinerAnnotation)
  .addNode("fetch_candidates", fetchCandidatesNode)
  .addNode("judge_loop", judgeLoopNode)
  .addNode("write_or_discard", writeOrDiscardNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "fetch_candidates")
  .addConditionalEdges("fetch_candidates", routeAfterFetch, {
    judge_loop: "judge_loop",
    summarize: "summarize",
  })
  .addEdge("judge_loop", "write_or_discard")
  .addEdge("write_or_discard", "summarize")
  .addEdge("summarize", END)
  .compile();
