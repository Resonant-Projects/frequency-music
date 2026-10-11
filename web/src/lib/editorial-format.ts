import type { Doc } from "../../../convex/_generated/dataModel";

type EditorialArtifact = Doc<"editorialArtifacts">;

/** Reader-facing name of an editorial artifact kind. */
export function formatEditorialKind(kind: EditorialArtifact["kind"]) {
  switch (kind) {
    case "experiment_recap":
      return "Experiment recap";
    case "what_changed_my_mind":
      return "What changed my mind";
    case "campaign_summary":
      return "Campaign summary";
    case "thesis_summary":
      return "Thesis summary";
  }
}

/**
 * Badge tone for an artifact's evidence status: gold when supported, violet
 * only while it is still speculative, cream for the neutral middle.
 */
export function evidenceStatusTone(
  status: EditorialArtifact["evidenceStatus"],
): "gold" | "violet" | "cream" {
  switch (status) {
    case "supported":
      return "gold";
    case "speculative":
      return "violet";
    case "mixed":
      return "cream";
  }
}
