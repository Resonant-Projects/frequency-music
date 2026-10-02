import { END, START, StateGraph } from "@langchain/langgraph";
import { SourceScoutAnnotation } from "../../state/sourceScoutState.js";
import {
  fetchTargetsNode,
  ingestSourcesNode,
  judgeResultsNode,
  planQueriesNode,
  proposeFeedsNode,
  recaptureSourcesNode,
  routeAfterQueries,
  routeAfterTargets,
  routeAtStart,
  searchLoopNode,
  summarizeNode,
} from "./nodes.js";

export const graph = new StateGraph(SourceScoutAnnotation)
  .addNode("fetch_targets", fetchTargetsNode)
  .addNode("plan_queries", planQueriesNode)
  .addNode("search_loop", searchLoopNode)
  .addNode("judge_results", judgeResultsNode)
  .addNode("ingest_sources", ingestSourcesNode)
  .addNode("propose_feeds", proposeFeedsNode)
  .addNode("summarize", summarizeNode)
  .addNode("recapture_sources", recaptureSourcesNode)
  .addConditionalEdges(START, routeAtStart, {
    fetch_targets: "fetch_targets",
    recapture_sources: "recapture_sources",
  })
  .addEdge("recapture_sources", "summarize")
  .addConditionalEdges("fetch_targets", routeAfterTargets, {
    plan_queries: "plan_queries",
    summarize: "summarize",
  })
  .addConditionalEdges("plan_queries", routeAfterQueries, {
    search_loop: "search_loop",
    summarize: "summarize",
  })
  .addEdge("search_loop", "judge_results")
  .addEdge("judge_results", "ingest_sources")
  .addEdge("judge_results", "propose_feeds")
  .addEdge(["ingest_sources", "propose_feeds"], "summarize")
  .addEdge("summarize", END)
  .compile();
