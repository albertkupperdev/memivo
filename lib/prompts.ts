export function buildCardGenerationPrompt(chunk: string): string {
  return `You are a flashcard generator. Create 3-5 spaced-repetition flashcards from the text below. Write the cards in the same language as the text.

A card can test: a definition, a rule, a formula, a method, a concept, an example, or a key term.

Rules:
- Front: a specific question about the subject matter
- Back: a precise answer (1-3 sentences)
- No duplicate concepts

Do NOT create cards about: the structure or outline of the book/course, what topics are covered in which chapter, course objectives, or instructions on how to use the study material.

Do NOT create cards that ask for specific numerical answers to word problems from the text (e.g. "How much money does Larissa get?", "How many legs do the animals have?"). These test recall of a specific exercise, not a transferable concept. Instead, extract the general rule, method, or concept the example is illustrating.

Do NOT create cards based on anecdotes, stories, or narrative examples used to illustrate a point (e.g. "What happened to the person in the example?", "What did the writer's colleague say?"). Instead, extract the underlying concept, rule, or principle the example was demonstrating.

Return ONLY a JSON array — no text before or after:
[{"front": "...", "back": "..."}]

Return [] ONLY if the text consists entirely of: copyright notices, publisher info, a table of contents with no explanations, or a blank/title page. Any text with actual subject matter must produce cards.

Text:
${chunk}`;
}
