// Types: Entertainment / Lazer e Entretenimento

export type MediaType =
  | 'movie'
  | 'series'
  | 'book_fiction'
  | 'game'
  | 'podcast'
  | 'music_album'
  | 'outros';
export type MediaStatus = 'want' | 'watching' | 'completed' | 'abandoned';

export type MediaItem = {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  rating: number | null; // 1-5
  platform: string | null;
  genre: string | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HobbyLog = {
  id: string;
  activity: string;
  duration_min: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
};

export type CreateMediaInput = {
  title: string;
  type: MediaType;
  status?: MediaStatus;
  platform?: string;
  genre?: string;
};

export type CreateHobbyLogInput = {
  activity: string;
  duration_min?: number;
  notes?: string;
  logged_at?: string;
};
