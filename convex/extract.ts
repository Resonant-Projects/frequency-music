"use node";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./auth";
import { DEFAULT_MODEL, MODELS } from "./llm";
import { generateJson } from "./llmNode";

export { MODELS };

// ============================================================================
// EXTRACTION PROMPTS
// ============================================================================

const EXTRACT_SYSTEM_PROMPT = `You are a research assistant for a music theory and acoustics project called "Resonant Projects." Your task is to analyze source material and extract structured information relevant to the intersection of music, physics, and mathematics.

Focus on extracting:
1. **Claims**: Factual assertions about music, sound, frequency, harmony, perception, or related physics/math
2. **Composition Parameters**: Any specific musical values mentioned (frequencies, tempos, tuning systems, intervals, etc.)
3. **Concepts**: Key topics and terminology
4. **Open Questions**: Things worth investigating further

Be rigorous about evidence levels:
- peer_reviewed: Published in academic journals with peer review
- preprint: Academic but not yet peer reviewed
- anecdotal: Personal accounts, case studies, informal observations
- speculative: Theoretical proposals without direct evidence
- personal: Your own inferences from the text

For every claim, separate:
- truthConfidence: how confident the source makes you that the claim is well-supported
- interestLevel: how creatively fertile the claim seems for composition work

Use low|medium|high for both fields. These are not true/false labels.

For composition parameters, be specific about values and units. If a claim mentions "432 Hz tuning," extract that as a parameter with type "frequency" or "rootNote."`;

const EXTRACT_USER_PROMPT = `Analyze this source and extract structured information.

Title: {{title}}
URL: {{url}}
Content:
---
{{content}}
---

Respond with a JSON object containing:
{
  "summary": "3-5 sentence summary of the key points",
  "claims": [
    {
      "text": "The specific claim being made",
      "evidenceLevel": "peer_reviewed|preprint|anecdotal|speculative|personal",
      "truthConfidence": "low|medium|high",
      "interestLevel": "low|medium|high",
      "citations": [
        {"quote": "supporting quote from the text", "label": "optional label"}
      ]
    }
  ],
  "compositionParameters": [
    {
      "kind": "parameter type label such as tempo|key|tuningSystem|rootNote|interval|measurement|duration|frequency|note",
      "value": "human-readable value (e.g., '432 Hz', '120 BPM', 'Pythagorean')",
      "details": { /* structured details like { "hz": 432 } or { "bpm": 120 } */ }
    }
  ],
  "topics": ["list", "of", "relevant", "concepts"],
  "openQuestions": ["Questions worth investigating further"]
}

Only include claims that are substantive and relevant to music, frequency, acoustics, or related fields. Be conservative - quality over quantity.`;

// ============================================================================
// EXTRACTION ACTION
// ============================================================================

interface ExtractionResult {
  summary: string;
  claims: Array<{
    text: string;
    evidenceLevel: string;
    truthConfidence?: string;
    interestLevel?: string;
    citations: Array<{ quote?: string; label?: string }>;
  }>;
  compositionParameters: Array<{
    kind?: string;
    type?: string;
    value: string;
    details?: Record<string, unknown>;
  }>;
  topics: string[];
  openQuestions: string[];
}

export function parseConfidenceBand(
  value: unknown,
): "low" | "medium" | "high" | undefined {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

/**
 * Extract structured data from a source using AI SDK + OpenRouter
 */
export const extractSource = action({
  args: {
    sourceId: v.id("sources"),
    model: v.optional(v.string()), // Override model if needed
    force: v.optional(v.boolean()), // Re-extract even if already done
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      skipped: v.literal(true),
      reason: v.string(),
    }),
    v.object({
      success: v.literal(true),
      model: v.string(),
      summary: v.string(),
      claimCount: v.number(),
      parameterCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    // Get the source
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });
    if (!source) {
      throw new Error("Source not found");
    }

    // Check if already extracted (skip unless forced)
    if (source.status === "extracted" && !args.force) {
      return { skipped: true as const, reason: "already extracted" };
    }

    // Get content
    const content = source.rawText || source.transcript;
    if (!content) {
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: "No text content available for extraction",
        devBypassSecret: args.devBypassSecret,
      });
      return { skipped: true as const, reason: "no content" };
    }

    // Mark as extracting
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "extracting",
      devBypassSecret: args.devBypassSecret,
    });

    // Build the prompt
    const userPrompt = EXTRACT_USER_PROMPT.replace(
      "{{title}}",
      source.title || "Untitled",
    )
      .replace("{{url}}", source.canonicalUrl || "")
      .replace("{{content}}", content.slice(0, 30000)); // Limit content length

    const modelId = args.model || DEFAULT_MODEL;

    try {
      const { json } = await generateJson({
        task: "extract_v2",
        model: modelId,
        system: EXTRACT_SYSTEM_PROMPT,
        prompt: userPrompt,
        metadata: {
          sourceId: args.sourceId,
          sourceType: source.type,
          promptVersion: "extract_v2",
        },
      });

      const extraction = json as ExtractionResult;

      // Compute input hash for deduplication
      const encoder = new TextEncoder();
      const hashData = encoder.encode(`${content}extract_v2`);
      const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Check for existing extraction with same hash
      const existingExtractions = await ctx.runQuery(
        api.extractions.getByInputHash,
        { inputHash },
      );
      if (existingExtractions && !args.force) {
        await ctx.runMutation(api.sources.updateStatus, {
          id: args.sourceId,
          status: "extracted",
          devBypassSecret: args.devBypassSecret,
        });
        return { skipped: true as const, reason: "duplicate extraction" };
      }

      // Filter and map parameters before storing
      const filteredParameters = extraction.compositionParameters.flatMap(
        (p) => {
          const kind = p.kind?.trim();
          const type = p.type?.trim();
          const resolvedKind = kind || type;
          const value = p.value?.trim();
          if (!resolvedKind || !value) return [];
          return [
            {
              kind: resolvedKind,
              type: type || resolvedKind,
              value,
              details: p.details,
            },
          ];
        },
      );

      // Store the extraction
      await ctx.runMutation(internal.extractInternal.storeExtraction, {
        sourceId: args.sourceId,
        model: modelId,
        promptVersion: "extract_v2",
        inputHash,
        summary: extraction.summary,
        claims: extraction.claims.map((c) => ({
          text: c.text,
          evidenceLevel: c.evidenceLevel as any,
          truthConfidence: parseConfidenceBand(c.truthConfidence),
          interestLevel: parseConfidenceBand(c.interestLevel),
          citations: c.citations || [],
        })),
        compositionParameters: filteredParameters,
        topics: extraction.topics || [],
        openQuestions: extraction.openQuestions || [],
        confidence: 0.8,
      });

      // Update source status
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "extracted",
        devBypassSecret: args.devBypassSecret,
      });

      return {
        success: true as const,
        model: modelId,
        summary: extraction.summary,
        claimCount: extraction.claims.length,
        parameterCount: filteredParameters.length,
      };
    } catch (error) {
      // Mark as errored
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "ai_error",
        blockedDetails: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        devBypassSecret: args.devBypassSecret,
      });
      throw error;
    }
  },
});

/**
 * Extract all sources that are ready
 */
export const extractAllReady = action({
  args: {
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
    devBypassSecret: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        success: v.boolean(),
        error: v.optional(v.string()),
        summary: v.optional(v.string()),
        model: v.optional(v.string()),
      }),
    ),
    processed: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAuth(ctx, args);
    const limit = args.limit ?? 10;
    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit,
    });

    const results: Array<{
      id: string;
      title: string;
      success: boolean;
      error?: string;
      summary?: string;
      model?: string;
    }> = [];

    for (const source of sources) {
      try {
        const result = await ctx.runAction(api.extract.extractSource, {
          sourceId: source._id,
          model: args.model,
          devBypassSecret: args.devBypassSecret,
        });
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: true,
          summary: result.summary,
          model: result.model,
        });
      } catch (error) {
        results.push({
          id: source._id,
          title: source.title || "Untitled",
          success: false,
          error: `${error}`,
        });
      }
    }

    return { results, processed: results.length };
  },
});

/**
 * List available models
 */
export const listModels = action({
  args: {},
  returns: v.object({
    fast: v.string(),
    default: v.string(),
    quality: v.string(),
    sonnet: v.string(),
    haiku: v.string(),
    gemini: v.string(),
    gpt4: v.string(),
    deepseek: v.string(),
    grok: v.string(),
  }),
  handler: () => {
    return MODELS;
  },
});
