// The extract_v2 prompt, shared by the Convex extraction action and the
// operator extraction script (scripts/operator-extraction.ts) so a Source is
// extracted from the same instructions and the same text either way.

export const EXTRACTION_PROMPT_VERSION = "extract_v2";
/** Source text beyond this many characters is not shown to the model. */
export const EXTRACTION_CONTENT_MAX_CHARS = 30_000;

export const EXTRACT_SYSTEM_PROMPT = `You are a research assistant for a music theory and acoustics project called "Resonant Projects." Your task is to analyze source material and extract structured information relevant to the intersection of music, physics, and mathematics.

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

export const EXTRACT_USER_PROMPT = `Analyze this source and extract structured information.

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

/** The user prompt for one Source, with its text cut to the model limit. */
export function renderExtractionPrompt(source: {
  title?: string;
  canonicalUrl?: string;
  content: string;
}): string {
  const values: Record<string, string> = {
    title: source.title || "Untitled",
    url: source.canonicalUrl || "",
    content: source.content.slice(0, EXTRACTION_CONTENT_MAX_CHARS),
  };
  // One pass over the template: a title or text that contains "{{content}}"
  // or "$&" is inserted literally and never rescanned.
  return EXTRACT_USER_PROMPT.replace(
    /\{\{(title|url|content)\}\}/g,
    (_, key: string) => values[key] ?? "",
  );
}

/** SHA-256 of the Source text and prompt version: the Extraction's inputHash. */
export async function extractionInputHash(content: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${content}${EXTRACTION_PROMPT_VERSION}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
