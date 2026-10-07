// Word error rate of a transcript against the text that was spoken: the
// optional speech-recognition check on rendered chunks. A diagnostic for
// garbled or skipped speech, not a judgement of how natural a voice sounds.
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = words(reference);
  const hyp = words(hypothesis);
  if (ref.length === 0) return hyp.length ? 1 : 0;
  let previous = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const current = [i];
    for (let j = 1; j <= hyp.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[hyp.length]! / ref.length;
}
