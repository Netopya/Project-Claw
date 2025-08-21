import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const anime = sqliteTable('anime', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  malId: integer('mal_id').notNull().unique(),
  title: text('title').notNull(),
  titleEnglish: text('title_english'),
  titleJapanese: text('title_japanese'),
  imageUrl: text('image_url'),
  rating: real('rating'),
  premiereDate: text('premiere_date'), // Store as ISO string
  numEpisodes: integer('num_episodes'),
  seriesInfo: text('series_info'), // JSON string
  priority: integer('priority').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Anime = typeof anime.$inferSelect;
export type NewAnime = typeof anime.$inferInsert;