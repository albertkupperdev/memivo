export function buildCardGenerationPrompt(chunk: string): string {
  return `You are a flashcard generator creating spaced-repetition cards for serious study. The text may be in any language — generate cards in the same language as the text.

Generate cards for: mathematical concepts, definitions, theorems, formulas, solution procedures, principles, and worked examples. Numbered examples, exercises, and callout boxes are all valid sources.

Rules:
- Each card tests exactly ONE concept, definition, or procedure
- The front must be a specific question about the subject matter
- The back must be a concise answer — 1 to 3 sentences maximum
- Do not repeat the same concept across multiple cards
- Generate between 2 and 4 cards

Return an empty array [] ONLY when the chunk contains zero educational content — i.e. it is purely copyright text, a legal disclaimer, publisher metadata, a table of contents with no explanations, or a blank/title page. Any chunk that teaches, defines, or demonstrates something should produce cards.

Return a JSON array only — no explanation, no markdown, no code fences:
[
  { "front": "...", "back": "..." }
]

Text:
${chunk}`;
}
