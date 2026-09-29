// Split a paragraph for a provider's character cap at sentence boundaries,
// falling back to whitespace when a single sentence is over the cap. Never
// truncates: joining the chunks with a single space reproduces the input.
const SENTENCE_END = /(?<=[.!?])\s+/;

export function chunkForLimit(paragraph: string, maxChars: number): string[] {
  if (paragraph.length <= maxChars) return [paragraph];
  const pieces: string[] = [];
  let current = "";
  const push = () => {
    if (current) {
      pieces.push(current);
      current = "";
    }
  };
  for (const sentence of paragraph.split(SENTENCE_END)) {
    const units =
      sentence.length > maxChars
        ? splitOnWhitespace(sentence, maxChars)
        : [sentence];
    for (const unit of units) {
      if (!current) current = unit;
      else if (current.length + 1 + unit.length <= maxChars)
        current = `${current} ${unit}`;
      else {
        push();
        current = unit;
      }
    }
  }
  push();
  return pieces;
}

function splitOnWhitespace(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars)
      current = `${current} ${word}`;
    else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}
