import { z } from 'zod';

// Zod validation schemas for export data structures

export const ExportMetadataSchema = z.object({
  version: z.string().min(1),
  exportDate: z.string().datetime(),
  totalRecords: z.number().int().min(0),
  checksum: z.string().min(1),
  application: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
});

export const AnimeInfoSchema = z.object({
  id: z.number().int().positive(),
  malId: z.number().int().positive(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  imageUrl: z.string().nullable(),
  rating: z.number().nullable(),
  premiereDate: z.string().nullable(),
  numEpisodes: z.number().int().nullable(),
  episodeDuration: z.number().int().nullable(),
  animeType: z.string().default('unknown'),
  status: z.string().nullable(),
  source: z.string().nullable(),
  studios: z.string().nullable(),
  genres: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const UserWatchlistEntrySchema = z.object({
  id: z.number().int().positive(),
  animeInfoId: z.number().int().positive(),
  priority: z.number().int().positive(),
  watchStatus: z.string().default('plan_to_watch'),
  userRating: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const AnimeRelationshipSchema = z.object({
  id: z.number().int().positive(),
  sourceMalId: z.number().int().positive(),
  targetMalId: z.number().int().positive(),
  relationshipType: z.string().min(1),
  createdAt: z.string().nullable(),
});

export const TimelineCacheSchema = z.object({
  id: z.number().int().positive(),
  rootMalId: z.number().int().positive(),
  timelineData: z.string().min(1),
  cacheVersion: z.number().int().default(1),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const ExportDataSchema = z.object({
  metadata: ExportMetadataSchema,
  data: z.object({
    animeInfo: z.array(AnimeInfoSchema),
    userWatchlist: z.array(UserWatchlistEntrySchema),
    animeRelationships: z.array(AnimeRelationshipSchema),
    timelineCache: z.array(TimelineCacheSchema),
  }),
});

// Type exports
export type ExportMetadataType = z.infer<typeof ExportMetadataSchema>;
export type AnimeInfoType = z.infer<typeof AnimeInfoSchema>;
export type UserWatchlistEntryType = z.infer<typeof UserWatchlistEntrySchema>;
export type AnimeRelationshipType = z.infer<typeof AnimeRelationshipSchema>;
export type TimelineCacheType = z.infer<typeof TimelineCacheSchema>;
export type ExportDataType = z.infer<typeof ExportDataSchema>;