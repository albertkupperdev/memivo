export type SourceType = "pdf" | "url";

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
