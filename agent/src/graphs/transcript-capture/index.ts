import { END, START, StateGraph } from "@langchain/langgraph";
import { TranscriptCaptureAnnotation } from "../../state/transcriptCaptureState.js";
import { captureTranscriptsNode, summarizeNode } from "./nodes.js";

export const graph = new StateGraph(TranscriptCaptureAnnotation)
  .addNode("capture_transcripts", captureTranscriptsNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "capture_transcripts")
  .addEdge("capture_transcripts", "summarize")
  .addEdge("summarize", END)
  .compile();
