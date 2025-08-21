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
  num_episodes?: number;
  related_anime?: Array<{
    node: {
      id: number;
      title: string;
    };
    relation_type: string;
  }>;
}

// Error response type
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}