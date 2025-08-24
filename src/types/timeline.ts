// Timeline-specific type definitions for the anime series timeline feature

export interface AnimeInfo {
  id: number;
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  rating: number | null;
  premiereDate: Date | null;
  numEpisodes: number | null;
  episodeDuration: number | null; // Duration in minutes
  animeType: AnimeType;
  status: AnimeStatus | null;
  source: string | null;
  studios: string[];
  genres: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWatchlistEntry {
  id: number;
  animeInfoId: number;
  priority: number;
  watchStatus: WatchStatus;
  userRating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  animeInfo?: AnimeInfo; // Joined data
}

export interface AnimeRelationship {
  id: number;
  sourceMalId: number;
  targetMalId: number;
  relationshipType: RelationshipType;
  createdAt: Date;
}

export interface TimelineEntry {
  malId: number;
  title: string;
  titleEnglish: string | null;
  animeType: AnimeType;
  premiereDate: Date | null;
  numEpisodes: number | null;
  episodeDuration: number | null;
  chronologicalOrder: number;
  isMainEntry: boolean; // True if this is the anime the user added
  relationshipPath: string[]; // Path of relationships from root
}

export interface SeriesTimeline {
  rootMalId: number;
  entries: TimelineEntry[];
  totalEntries: number;
  mainTimelineCount: number; // Excluding side stories/alternatives
  lastUpdated: Date;
}

// Enum types
export type AnimeType = 'unknown' | 'tv' | 'ova' | 'movie' | 'special' | 'ona' | 'music';
export type AnimeStatus = 'finished_airing' | 'currently_airing' | 'not_yet_aired';
export type WatchStatus = 'plan_to_watch' | 'watching' | 'completed' | 'dropped' | 'on_hold';
export type RelationshipType = 
  | 'sequel' 
  | 'prequel' 
  | 'side_story' 
  | 'alternative_version' 
  | 'alternative_setting' 
  | 'parent_story' 
  | 'spin_off' 
  | 'adaptation' 
  | 'character' 
  | 'summary' 
  | 'full_story' 
  | 'other';

// Graph traversal specific types
export interface RelationshipNode {
  malId: number;
  animeInfo: AnimeInfo;
  relationships: AnimeRelationship[];
}

export interface GraphTraversalResult {
  nodes: Map<number, RelationshipNode>;
  visitedOrder: number[];
  cyclesDetected: number[][];
}

// Chronological sorting types
export interface ChronologicalSortCriteria {
  premiereDate: Date | null;
  relationshipTypePriority: number;
  episodeCount: number;
  animeType: AnimeType;
  isMainTimeline: boolean;
}

export interface SortedTimelineEntry extends TimelineEntry {
  sortCriteria: ChronologicalSortCriteria;
}