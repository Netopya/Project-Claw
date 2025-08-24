// Core anime data types
export interface Anime {
  id: number;
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  rating: number | null;
  premiereDate: Date | null;
  numEpisodes: number | null;
  seriesInfo: SeriesInfo | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// Input data for creating new anime
export interface CreateAnimeData {
  malId: number;
  title: string;
  titleEnglish?: string | null;
  titleJapanese?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  premiereDate?: Date | null;
  numEpisodes?: number | null;
  seriesInfo?: SeriesInfo | null;
}

// Update data for existing anime
export interface UpdateAnimeData {
  title?: string;
  titleEnglish?: string | null;
  titleJapanese?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  premiereDate?: Date | null;
  numEpisodes?: number | null;
  seriesInfo?: SeriesInfo | null;
  priority?: number;
}

export interface SeriesInfo {
  totalSeries: number;
  currentPosition: number;
  hasSequels: boolean;
  hasPrequels: boolean;
  relatedTitles: string[];
}

// API request/response types
export interface AddAnimeRequest {
  url: string;
}

export interface ReorderRequest {
  animeIds: number[];
}

// MyAnimeList API response types
export interface MyAnimeListResponse {
  id: number;
  title: string;
  alternative_titles?: {
    en?: string;
    ja?: string;
  };
  main_picture?: {
    medium: string;
    large: string;
  };
  mean?: number;
  start_date?: string;
  end_date?: string;
  num_episodes?: number;
  average_episode_duration?: number; // Duration in seconds
  media_type?: string; // tv, movie, ova, special, ona, music
  status?: string; // finished_airing, currently_airing, not_yet_aired
  source?: string; // manga, novel, original, etc.
  studios?: Array<{
    id: number;
    name: string;
  }>;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  related_anime?: Array<{
    node: {
      id: number;
      title: string;
      main_picture?: {
        medium: string;
        large: string;
      };
    };
    relation_type: string;
    relation_type_formatted: string;
  }>;
}

// Enhanced API response for comprehensive data
export interface EnhancedMyAnimeListResponse extends MyAnimeListResponse {
  // Additional fields for timeline functionality
  broadcast?: {
    day_of_the_week?: string;
    start_time?: string;
  };
  rating?: string; // g, pg, pg_13, r, r+, rx
  synopsis?: string;
}

// Error response type
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}