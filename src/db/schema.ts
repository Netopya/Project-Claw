import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Comprehensive anime information separate from user preferences
export const animeInfo = sqliteTable('anime_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  malId: integer('mal_id').notNull().unique(),
  title: text('title').notNull(),
  titleEnglish: text('title_english'),
  titleJapanese: text('title_japanese'),
  imageUrl: text('image_url'),
  rating: real('rating'),
  premiereDate: text('premiere_date'), // Store as ISO string
  numEpisodes: integer('num_episodes'),
  episodeDuration: integer('episode_duration'), // Duration in minutes
  animeType: text('anime_type').notNull().default('unknown'), // TV, Movie, OVA, Special, etc.
  status: text('status'), // finished_airing, currently_airing, not_yet_aired
  source: text('source'), // manga, novel, original, etc.
  studios: text('studios'), // JSON array of studio names
  genres: text('genres'), // JSON array of genres
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// User's personal watchlist referencing anime_info
export const userWatchlist = sqliteTable('user_watchlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  animeInfoId: integer('anime_info_id').notNull().references(() => animeInfo.id),
  priority: integer('priority').notNull(),
  watchStatus: text('watch_status').notNull().default('plan_to_watch'), // plan_to_watch, watching, completed, dropped, on_hold
  userRating: real('user_rating'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Anime relationships for graph traversal
export const animeRelationships = sqliteTable('anime_relationships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceMalId: integer('source_mal_id').notNull().references(() => animeInfo.malId),
  targetMalId: integer('target_mal_id').notNull().references(() => animeInfo.malId),
  relationshipType: text('relationship_type').notNull(), // sequel, prequel, side_story, alternative_version, etc.
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Cached timeline data for performance
export const timelineCache = sqliteTable('timeline_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rootMalId: integer('root_mal_id').notNull().unique(),
  timelineData: text('timeline_data').notNull(), // JSON string of complete timeline
  cacheVersion: integer('cache_version').notNull().default(1),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Type exports for the new schema
export type AnimeInfo = typeof animeInfo.$inferSelect;
export type NewAnimeInfo = typeof animeInfo.$inferInsert;
export type UserWatchlistEntry = typeof userWatchlist.$inferSelect;
export type NewUserWatchlistEntry = typeof userWatchlist.$inferInsert;
export type AnimeRelationship = typeof animeRelationships.$inferSelect;
export type NewAnimeRelationship = typeof animeRelationships.$inferInsert;
export type TimelineCache = typeof timelineCache.$inferSelect;
export type NewTimelineCache = typeof timelineCache.$inferInsert;

// Legacy export for backward compatibility during migration
export const anime = animeInfo; // Temporary alias
export type Anime = AnimeInfo; // Temporary alias
export type NewAnime = NewAnimeInfo; // Temporary alias