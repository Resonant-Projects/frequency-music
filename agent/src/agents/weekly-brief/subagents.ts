import { convexTools } from "../../tools/index.js";
import {
  contradictionSubagentPrompt,
  researchSubagentPrompt,
  stakeNamingSubagentPrompt,
} from "./prompts.js";

export const subagents = [
  {
    name: "research",
    description:
      "Unpack recent extractions and identify usable music/physics/math bridges.",
    systemPrompt: researchSubagentPrompt,
    tools: convexTools,
  },
  {
    name: "contradiction-check",
    description:
      "Check recommendations against failure archive and low-yield editorial signals.",
    systemPrompt: contradictionSubagentPrompt,
    tools: convexTools,
  },
  {
    name: "stake-naming",
    description:
      "Strengthen whyThisMatters language into concrete compositional stakes.",
    systemPrompt: stakeNamingSubagentPrompt,
    tools: convexTools,
  },
];
