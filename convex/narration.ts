"use node";
// Narration script builder: turns a weekly brief into a spoken-word script
// via one traced LLM call. Carries "use node" because llmNode.ts does.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { generateLlmText } from "./llmNode";
import {
  buildNarrationPrompt,
  NARRATION_PROMPT_VERSION,
  parseNarrationScript,
  scriptWordCount,
} from "./narrationPrompt";
import { narrationScriptZ, type NarrationScript } from "./shared/mediaJobs";

// Brief episodes run 8 to 14 minutes at 150 words per minute; target 11.
const BRIEF_TARGET_MINUTES = 11;
const BRIEF_MIN_WORDS = 1200;
const BRIEF_MAX_WORDS = 2100;

export const buildScriptForBrief = internalAction({
  args: { briefId: v.id("weeklyBriefs"), model: v.optional(v.string()) },
  handler: async (ctx, args): Promise<NarrationScript> => {
    const brief = await ctx.runQuery(internal.weeklyBriefs.getInternal, {
      briefId: args.briefId,
    });
    if (!brief) throw new Error("brief not found");
    const { system, prompt } = buildNarrationPrompt({
      kind: "weeklyBrief",
      bodyMd: brief.bodyMd,
      targetMinutes: BRIEF_TARGET_MINUTES,
      studioPrompts: brief.studioPrompts
        ? {
            tenMin: brief.studioPrompts.tenMinuteMd,
            thirtyMin: brief.studioPrompts.thirtyMinuteMd,
            ninetyMin: brief.studioPrompts.ninetyMinuteMd,
          }
        : undefined,
    });
    const { text } = await generateLlmText({
      task: "narration_v1",
      model: args.model,
      system,
      prompt,
      traceName: "narration_v1.brief",
      metadata: {
        briefId: args.briefId,
        promptVersion: NARRATION_PROMPT_VERSION,
      },
    });
    const script = narrationScriptZ.parse(parseNarrationScript(text));
    const words = scriptWordCount(script);
    if (words < BRIEF_MIN_WORDS || words > BRIEF_MAX_WORDS) {
      throw new Error(
        `script is ${words} words; expected ${BRIEF_MIN_WORDS} to ${BRIEF_MAX_WORDS}`,
      );
    }
    return script;
  },
});
