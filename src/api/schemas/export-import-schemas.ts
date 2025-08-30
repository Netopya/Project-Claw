import { z } from 'zod';

// Base validation schemas for database entities
export const AnimeInfoSchema = z.object({
  id: z.number().int().positive(),
  malId: z.number().int().positive(),
  title: z.string().min(1),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  rating: z.number().min(0).max(10).nullable(),
  premiereDate: z.string().nullable(), // ISO string
  numEpisodes: z.number().int().positive().nullable(),
  episodeDuration: z.number().int().positive().nullable(),
  animeType: z.string().default('unknown'),
  status: z.string().nullable(),
  source: z.string().nullable(),
  studios: z.string().nullable(), // JSON string
  genres: z.string().nullable(), // JSON string
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserWatchlistEntrySchema = z.object({
  id: z.number().int().positive(),
  animeInfoId: z.number().int().positive(),
  priority: z.number().int(),
  watchStatus: z.enum(['plan_to_watch', 'watching', 'completed', 'dropped', 'on_hold']).default('plan_to_watch'),
  userRating: z.number().min(0).max(10).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AnimeRelationshipSchema = z.object({
  id: z.number().int().positive(),
  sourceMalId: z.number().int().positive(),
  targetMalId: z.number().int().positive(),
  relationshipType: z.string().min(1),
  createdAt: z.string(),
});

export const TimelineCacheSchema = z.object({
  id: z.number().int().positive(),
  rootMalId: z.number().int().positive(),
  timelineData: z.string().min(1), // JSON string
  cacheVersion: z.number().int().positive().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Export metadata schema
export const ExportMetadataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (e.g., 1.0.0)'),
  exportDate: z.string().datetime(),
  totalRecords: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  application: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
});

// Export data schema
export const ExportDataSchema = z.object({
  metadata: ExportMetadataSchema,
  data: z.object({
    animeInfo: z.array(AnimeInfoSchema),
    userWatchlist: z.array(UserWatchlistEntrySchema),
    animeRelationships: z.array(AnimeRelationshipSchema),
    timelineCache: z.array(TimelineCacheSchema),
  }),
});

// Import options schema
export const ImportOptionsSchema = z.object({
  mode: z.enum(['merge', 'replace']),
  handleDuplicates: z.enum(['skip', 'update', 'prompt']),
  validateRelationships: z.boolean().default(true),
  clearCache: z.boolean().default(false),
});

// Import error schema
export const ImportErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.any().optional(),
  table: z.string().optional(),
  recordId: z.union([z.number(), z.string()]).optional(),
});

// Import warning schema
export const ImportWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.any().optional(),
  table: z.string().optional(),
  recordId: z.union([z.number(), z.string()]).optional(),
});

// Import result schema
export const ImportResultSchema = z.object({
  success: z.boolean(),
  recordsProcessed: z.object({
    animeInfo: z.number().int().nonnegative(),
    userWatchlist: z.number().int().nonnegative(),
    animeRelationships: z.number().int().nonnegative(),
    timelineCache: z.number().int().nonnegative(),
  }),
  errors: z.array(ImportErrorSchema),
  warnings: z.array(ImportWarningSchema),
});

// Validation result schema
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(ImportErrorSchema),
  warnings: z.array(ImportWarningSchema),
  metadata: ExportMetadataSchema.optional(),
});

// Import preview schema
export const ImportPreviewSchema = z.object({
  metadata: ExportMetadataSchema,
  summary: z.object({
    animeInfo: z.number().int().nonnegative(),
    userWatchlist: z.number().int().nonnegative(),
    animeRelationships: z.number().int().nonnegative(),
    timelineCache: z.number().int().nonnegative(),
  }),
  conflicts: z.object({
    duplicateAnime: z.array(z.object({
      malId: z.number().int().positive(),
      title: z.string().min(1),
      existingTitle: z.string().optional(),
    })),
    duplicateWatchlistEntries: z.array(z.object({
      animeInfoId: z.number().int().positive(),
      title: z.string().min(1),
    })),
  }),
  schemaMigrationRequired: z.boolean(),
  estimatedProcessingTime: z.number().nonnegative(),
});

// Database statistics schema
export const DatabaseStatsSchema = z.object({
  animeInfo: z.number().int().nonnegative(),
  userWatchlist: z.number().int().nonnegative(),
  animeRelationships: z.number().int().nonnegative(),
  timelineCache: z.number().int().nonnegative(),
  totalRecords: z.number().int().nonnegative(),
  lastUpdated: z.string().datetime(),
});

// API error schema
export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.any().optional(),
  timestamp: z.string().datetime(),
});

// Generic API response schema
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: ApiErrorSchema.optional(),
});

// Specific API response schemas
export const ExportStatsResponseSchema = ApiResponseSchema(DatabaseStatsSchema);
export const ExportGenerateResponseSchema = ApiResponseSchema(z.object({
  filename: z.string().min(1),
  size: z.number().int().positive(),
  checksum: z.string().min(1),
}));

export const ImportValidateResponseSchema = ApiResponseSchema(ValidationResultSchema);
export const ImportPreviewResponseSchema = ApiResponseSchema(ImportPreviewSchema);
export const ImportExecuteResponseSchema = ApiResponseSchema(ImportResultSchema);

// File upload validation schema
export const FileUploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().refine(
    (type) => type === 'application/json' || type === 'text/json',
    'File must be a JSON file'
  ),
  size: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
});

// Schema version validation
export const SchemaVersionSchema = z.string().regex(
  /^\d+\.\d+\.\d+$/,
  'Schema version must be in semver format (e.g., 1.0.0)'
);

// Migration result schema
export const MigrationResultSchema = z.object({
  success: z.boolean(),
  fromVersion: z.string(),
  toVersion: z.string(),
  changes: z.array(z.string()),
  errors: z.array(ImportErrorSchema),
});

// Export type inference for TypeScript
export type AnimeInfoSchemaType = z.infer<typeof AnimeInfoSchema>;
export type UserWatchlistEntrySchemaType = z.infer<typeof UserWatchlistEntrySchema>;
export type AnimeRelationshipSchemaType = z.infer<typeof AnimeRelationshipSchema>;
export type TimelineCacheSchemaType = z.infer<typeof TimelineCacheSchema>;
export type ExportMetadataSchemaType = z.infer<typeof ExportMetadataSchema>;
export type ExportDataSchemaType = z.infer<typeof ExportDataSchema>;
export type ImportOptionsSchemaType = z.infer<typeof ImportOptionsSchema>;
export type ImportResultSchemaType = z.infer<typeof ImportResultSchema>;
export type ValidationResultSchemaType = z.infer<typeof ValidationResultSchema>;
export type ImportPreviewSchemaType = z.infer<typeof ImportPreviewSchema>;
export type DatabaseStatsSchemaType = z.infer<typeof DatabaseStatsSchema>;