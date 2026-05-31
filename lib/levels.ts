const XP_MULTIPLIERS: Record<string, number> = {
  again: 3,
  hard: 7,
  good: 12,
  easy: 18,
};

export function calcCardXp(rating: string, intervalDays: number): number {
  const m = XP_MULTIPLIERS[rating] ?? 10;
  return Math.max(1, Math.round(m * Math.sqrt(intervalDays + 1)));
}

export const CARD_LEVEL_THRESHOLDS = [0, 5, 12, 25, 50, 100, 175, 275, 400, 500];
export const MAX_CARD_LEVEL = 10;

export const DECK_LEVEL_NAMES: Record<number, string> = {
  1: "Beginner",
  2: "Novice",
  3: "Learner",
  4: "Familiar",
  5: "Intermediate",
  6: "Practiced",
  7: "Advanced",
  8: "Proficient",
  9: "Veteran",
  10: "Expert",
};

export function getCardLevel(xp: number): number {
  for (let i = CARD_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= CARD_LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getCardLevelProgress(xp: number): { level: number; progress: number; xpInLevel: number; xpToNext: number } {
  const level = getCardLevel(xp);
  if (level >= MAX_CARD_LEVEL) return { level, progress: 1, xpInLevel: xp - CARD_LEVEL_THRESHOLDS[level - 1], xpToNext: 0 };
  const current = CARD_LEVEL_THRESHOLDS[level - 1];
  const next = CARD_LEVEL_THRESHOLDS[level];
  const xpInLevel = xp - current;
  const xpToNext = next - current;
  return { level, progress: xpInLevel / xpToNext, xpInLevel, xpToNext };
}

export function getDeckLevel(cardXpMap: Map<string, number>, cardIds: string[]): { level: number; progress: number; deckXp: number } {
  if (cardIds.length === 0) return { level: 1, progress: 0, deckXp: 0 };
  const deckXp = cardIds.reduce((sum, id) => sum + (cardXpMap.get(id) ?? 0), 0);
  const avgLevel = cardIds.reduce((sum, id) => sum + getCardLevel(cardXpMap.get(id) ?? 0), 0) / cardIds.length;
  const level = Math.max(1, Math.min(MAX_CARD_LEVEL, Math.floor(avgLevel)));
  const progress = avgLevel - Math.floor(avgLevel);
  return { level, progress, deckXp };
}
