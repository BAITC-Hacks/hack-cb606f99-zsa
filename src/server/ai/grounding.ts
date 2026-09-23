// Recover the original quote after harmless changes to case, spacing or final punctuation.
// This never accepts a paraphrase or returns text that is absent from the user's sources.
export function sourceQuote(value: string, sources: string[]): string | undefined {
  for (const source of sources) if (source.includes(value)) return value;
  const phrase = value.replace(/[.!?…]+$/u, "").trim();
  if (!phrase) return undefined;
  const pattern = phrase.split(/\s+/u)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const expression = new RegExp(pattern, "iu");
  for (const source of sources) {
    const match = expression.exec(source);
    if (match) return match[0];
  }
  return undefined;
}
