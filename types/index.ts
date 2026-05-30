export type SourceType = "pdf" | "url" | "manual";

export interface Playlist {
  id: string;
  document_id: string;
  name: string;
  color: string | null;
  position: number | null;
  review_count: number;
  created_at: string;
}

export interface DocumentSource {
  id: string;
  document_id: string;
  source_type: "pdf" | "url";
  source_url: string | null;
  label: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  source_type: SourceType;
  source_url: string | null;
  folder_id: string | null;
  position: number | null;
  created_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
}

export interface Card {
  id: string;
  document_id: string;
  chunk_id: string;
  front: string;
  back: string;
  hint: string | null;
  image_url: string | null;
  position: number | null;
  require_drawing: boolean;
  is_vocab: boolean;
  created_at: string;
}

export interface CardReview {
  id: string;
  card_id: string;
  user_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string;
}

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface UserSettings {
  interval_again: number;
  interval_hard: number;
  interval_good: number;
  interval_easy: number;
  type_in_answer: boolean;
  skip_max_level: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  interval_again: 1,
  interval_hard: 1,
  interval_good: 1,
  interval_easy: 6,
  type_in_answer: false,
  skip_max_level: false,
};
