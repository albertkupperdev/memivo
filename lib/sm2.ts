import type { ReviewRating, UserSettings } from "@/types";

export interface CardState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface SM2Result extends CardState {
  due_date: string;
}

const QUALITY: Record<ReviewRating, number> = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
};

export function applyReview(state: CardState, rating: ReviewRating, settings?: UserSettings): SM2Result {
  const quality = QUALITY[rating];
  let { ease_factor, interval_days, repetitions } = state;

  const s = {
    again: settings?.interval_again ?? 1,
    hard:  settings?.interval_hard  ?? 1,
    good:  settings?.interval_good  ?? 1,
    easy:  settings?.interval_easy  ?? 6,
  };

  if (rating === "again") {
    repetitions = 0;
    interval_days = s.again;
  } else if (rating === "hard") {
    repetitions = 0;
    interval_days = s.hard;
  } else {
    if (repetitions === 0) interval_days = s.good;
    else if (repetitions === 1) interval_days = s.easy;
    else interval_days = Math.round(interval_days * ease_factor);

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ease_factor = Math.max(1.3, ease_factor);
    repetitions += 1;
  }

  const due = new Date();
  due.setTime(due.getTime() + interval_days * 24 * 60 * 60 * 1000);
  const due_date = due.toISOString();

  return { ease_factor, interval_days, repetitions, due_date };
}

export function formatInterval(days: number): string {
  if (days < 1 / (24 * 60)) return "< 1 min";
  if (days < 1 / 24) return `${Math.round(days * 24 * 60)} min`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 7) return `${Math.round(days)}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}
