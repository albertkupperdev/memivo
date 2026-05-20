export function buildCardGenerationPrompt(chunk: string): string {
  return `You are a flashcard generator. Create 3-5 spaced-repetition flashcards from the text below. Write the cards in the same language as the text.

A card can test: a definition, a rule, a formula, a method, a concept, an example, or a key term.

Rules:
- Front: a specific question about the subject matter
- Back: a precise answer (1-3 sentences)
- No duplicate concepts

Do NOT create cards about: the structure or outline of the book/course, what topics are covered in which chapter, course objectives, or instructions on how to use the study material.

Return ONLY a JSON array — no text before or after:
[{"front": "...", "back": "..."}]

Return [] ONLY if the text consists entirely of: copyright notices, publisher info, a table of contents with no explanations, or a blank/title page. Any text with actual subject matter must produce cards.

Text:
${chunk}`;
}
