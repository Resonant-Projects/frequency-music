import { v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";

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
      "citations": [
        {"quote": "supporting quote from the text", "label": "optional label"}
      ]
    }
  ],
  "compositionParameters": [
    {
      "type": "tempo|key|tuningSystem|rootNote|chordProgression|rhythm|instrument|synthWaveform|harmonicProfile|frequency|note",
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
    citations: Array<{ quote?: string; label?: string }>;
  }>;
  compositionParameters: Array<{
    type: string;
    value: string;
    details?: Record<string, unknown>;
  }>;
  topics: string[];
  openQuestions: string[];
}

/**
 * Extract structured data from a source using Claude
 */
export const extractSource = action({
  args: {
    sourceId: v.id("sources"),
  },
  handler: async (ctx, args) => {
    // Get the source
    const source = await ctx.runQuery(api.sources.get, { id: args.sourceId });
    if (!source) {
      throw new Error("Source not found");
    }

    // Check if already extracted
    if (source.status === "extracted") {
      return { skipped: true, reason: "already extracted" };
    }

    // Get content
    const content = source.rawText || source.transcript;
    if (!content) {
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "no_text",
        blockedDetails: "No text content available for extraction",
      });
      return { skipped: true, reason: "no content" };
    }

    // Mark as extracting
    await ctx.runMutation(api.sources.updateStatus, {
      id: args.sourceId,
      status: "extracting",
    });

    // Build the prompt
    const userPrompt = EXTRACT_USER_PROMPT
      .replace("{{title}}", source.title || "Untitled")
      .replace("{{url}}", source.canonicalUrl || "")
      .replace("{{content}}", content.slice(0, 30000)); // Limit content length

    // Call Claude
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: EXTRACT_SYSTEM_PROMPT,
          messages: [
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const assistantMessage = data.content[0]?.text;

      if (!assistantMessage) {
        throw new Error("No response from Claude");
      }

      // Parse the JSON response
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from response");
      }

      const extraction: ExtractionResult = JSON.parse(jsonMatch[0]);

      // Compute input hash for deduplication
      const encoder = new TextEncoder();
      const hashData = encoder.encode(content + "extract_v1");
      const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const inputHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Check for existing extraction with same hash
      const existingExtractions = await ctx.runQuery(api.extractions.getByInputHash, { inputHash });
      if (existingExtractions) {
        await ctx.runMutation(api.sources.updateStatus, {
          id: args.sourceId,
          status: "extracted",
        });
        return { skipped: true, reason: "duplicate extraction" };
      }

      // Store the extraction
      await ctx.runMutation(internal.extract.storeExtraction, {
        sourceId: args.sourceId,
        model: "claude-sonnet-4-20250514",
        promptVersion: "extract_v1",
        inputHash,
        summary: extraction.summary,
        claims: extraction.claims.map((c) => ({
          text: c.text,
          evidenceLevel: c.evidenceLevel as any,
          citations: c.citations || [],
        })),
        compositionParameters: extraction.compositionParameters.map((p) => ({
          type: p.type as any,
          value: p.value,
          details: p.details,
        })),
        topics: extraction.topics || [],
        openQuestions: extraction.openQuestions || [],
        confidence: 0.8, // Could be computed from claim evidence levels
      });

      // Update source status
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "extracted",
      });

      return {
        success: true,
        summary: extraction.summary,
        claimCount: extraction.claims.length,
        parameterCount: extraction.compositionParameters.length,
      };

    } catch (error) {
      // Mark as errored
      await ctx.runMutation(api.sources.updateStatus, {
        id: args.sourceId,
        status: "review_needed",
        blockedReason: "ai_error",
        blockedDetails: `Extraction failed: ${error}`,
      });
      throw error;
    }
  },
});

/**
 * Store an extraction result
 */
export const storeExtraction = internalMutation({
  args: {
    sourceId: v.id("sources"),
    model: v.string(),
    promptVersion: v.string(),
    inputHash: v.string(),
    summary: v.string(),
    claims: v.array(
      v.object({
        text: v.string(),
        evidenceLevel: v.union(
          v.literal("peer_reviewed"),
          v.literal("preprint"),
          v.literal("anecdotal"),
          v.literal("speculative"),
          v.literal("personal")
        ),
        citations: v.array(
          v.object({
            label: v.optional(v.string()),
            url: v.optional(v.string()),
            quote: v.optional(v.string()),
          })
        ),
      })
    ),
    compositionParameters: v.array(
      v.object({
        type: v.union(
          v.literal("tempo"),
          v.literal("key"),
          v.literal("tuningSystem"),
          v.literal("rootNote"),
          v.literal("chordProgression"),
          v.literal("rhythm"),
          v.literal("instrument"),
          v.literal("synthWaveform"),
          v.literal("harmonicProfile"),
          v.literal("frequency"),
          v.literal("note")
        ),
        value: v.string(),
        details: v.optional(v.any()),
      })
    ),
    topics: v.array(v.string()),
    openQuestions: v.array(v.string()),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("extractions", {
      ...args,
      createdBy: "system",
      createdAt: Date.now(),
    });
  },
});

/**
 * Extract all sources that are ready
 */
export const extractAllReady = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const sources = await ctx.runQuery(api.sources.listByStatus, {
      status: "text_ready",
      limit,
    });

    const results: Record<string, { success?: boolean; error?: string; summary?: string }> = {};

    for (const source of sources) {
      try {
        const result = await ctx.runAction(api.extract.extractSource, {
          sourceId: source._id,
        });
        results[source.title || source._id] = {
          success: true,
          summary: result.summary,
        };
      } catch (error) {
        results[source.title || source._id] = {
          success: false,
          error: `${error}`,
        };
      }
    }

    return results;
  },
});
