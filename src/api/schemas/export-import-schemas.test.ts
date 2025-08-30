import { describe, it, expect } from 'vitest';
import {
  AnimeInfoSchema,
  UserWatchlistEntrySchema,
  AnimeRelationshipSchema,
  TimelineCacheSchema,
  ExportMetadataSchema,
  ExportDataSchema,
  ImportOptionsSchema,
  ImportErrorSchema,
  ImportWarningSchema,
  ImportResultSchema,
  ValidationResultSchema,
  ImportPreviewSchema,
  DatabaseStatsSchema,
  ApiErrorSchema,
  ApiResponseSchema,
  FileUploadSchema,
  SchemaVersionSchema,
  MigrationResultSchema,
} from './export-import-schemas';

describe('Export-Import Schemas', () => {
  describe('AnimeInfoSchema', () => {
    const validAnimeInfo = {
      id: 1,
      malId: 12345,
      title: 'Test Anime',
      titleEnglish: 'Test Anime English',
      titleJapanese: 'テストアニメ',
      imageUrl: 'https://example.com/image.jpg',
      rating: 8.5,
      premiereDate: '2023-01-01',
      numEpisodes: 12,
      episodeDuration: 24,
      animeType: 'tv',
      status: 'finished_airing',
      source: 'manga',
      studios: '["Studio A", "Studio B"]',
      genres: '["Action", "Drama"]',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    it('validates valid anime info', () => {
      const result = AnimeInfoSchema.safeParse(validAnimeInfo);
      expect(result.success).toBe(true);
    });

    it('requires positive integer id', () => {
      const invalid = { ...validAnimeInfo, id: -1 };
      const result = AnimeInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('requires positive integer malId', () => {
      const invalid = { ...validAnimeInfo, malId: 0 };
      const result = AnimeInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('requires non-empty title', () => {
      const invalid = { ...validAnimeInfo, title: '' };
      const result = AnimeInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('allows null values for optional fields', () => {
      const withNulls = {
        ...validAnimeInfo,
        titleEnglish: null,
        titleJapanese: null,
        imageUrl: null,
        rating: null,
        premiereDate: null,
        numEpisodes: null,
        episodeDuration: null,
        status: null,
        source: null,
        studios: null,
        genres: null,
      };
      const result = AnimeInfoSchema.safeParse(withNulls);
      expect(result.success).toBe(true);
    });

    it('validates rating range', () => {
      const tooLow = { ...validAnimeInfo, rating: -1 };
      const tooHigh = { ...validAnimeInfo, rating: 11 };
      
      expect(AnimeInfoSchema.safeParse(tooLow).success).toBe(false);
      expect(AnimeInfoSchema.safeParse(tooHigh).success).toBe(false);
      
      const validRating = { ...validAnimeInfo, rating: 10 };
      expect(AnimeInfoSchema.safeParse(validRating).success).toBe(true);
    });

    it('validates imageUrl format when provided', () => {
      const invalidUrl = { ...validAnimeInfo, imageUrl: 'not-a-url' };
      const result = AnimeInfoSchema.safeParse(invalidUrl);
      expect(result.success).toBe(false);
    });
  });

  describe('UserWatchlistEntrySchema', () => {
    const validWatchlistEntry = {
      id: 1,
      animeInfoId: 123,
      priority: 1,
      watchStatus: 'watching' as const,
      userRating: 8.0,
      notes: 'Great anime!',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    it('validates valid watchlist entry', () => {
      const result = UserWatchlistEntrySchema.safeParse(validWatchlistEntry);
      expect(result.success).toBe(true);
    });

    it('validates watch status enum', () => {
      const validStatuses = ['plan_to_watch', 'watching', 'completed', 'dropped', 'on_hold'];
      
      for (const status of validStatuses) {
        const entry = { ...validWatchlistEntry, watchStatus: status };
        const result = UserWatchlistEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      }

      const invalidStatus = { ...validWatchlistEntry, watchStatus: 'invalid' };
      const result = UserWatchlistEntrySchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it('uses default watch status', () => {
      const withoutStatus = { ...validWatchlistEntry };
      delete (withoutStatus as any).watchStatus;
      
      const result = UserWatchlistEntrySchema.safeParse(withoutStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.watchStatus).toBe('plan_to_watch');
      }
    });

    it('validates user rating range', () => {
      const tooLow = { ...validWatchlistEntry, userRating: -1 };
      const tooHigh = { ...validWatchlistEntry, userRating: 11 };
      
      expect(UserWatchlistEntrySchema.safeParse(tooLow).success).toBe(false);
      expect(UserWatchlistEntrySchema.safeParse(tooHigh).success).toBe(false);
    });
  });

  describe('ExportMetadataSchema', () => {
    const validMetadata = {
      version: '1.0.0',
      exportDate: '2023-01-01T00:00:00Z',
      totalRecords: 100,
      checksum: 'abc123',
      application: {
        name: 'Project Claw',
        version: '1.0.0',
      },
    };

    it('validates valid metadata', () => {
      const result = ExportMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('validates semver format for version', () => {
      const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0-beta'];
      
      for (const version of invalidVersions) {
        const invalid = { ...validMetadata, version };
        const result = ExportMetadataSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      }
    });

    it('validates datetime format for exportDate', () => {
      const invalidDate = { ...validMetadata, exportDate: '2023-01-01' };
      const result = ExportMetadataSchema.safeParse(invalidDate);
      expect(result.success).toBe(false);
    });

    it('requires non-negative totalRecords', () => {
      const negative = { ...validMetadata, totalRecords: -1 };
      const result = ExportMetadataSchema.safeParse(negative);
      expect(result.success).toBe(false);
    });

    it('requires non-empty checksum', () => {
      const empty = { ...validMetadata, checksum: '' };
      const result = ExportMetadataSchema.safeParse(empty);
      expect(result.success).toBe(false);
    });
  });

  describe('ExportDataSchema', () => {
    const validExportData = {
      metadata: {
        version: '1.0.0',
        exportDate: '2023-01-01T00:00:00Z',
        totalRecords: 2,
        checksum: 'abc123',
        application: {
          name: 'Project Claw',
          version: '1.0.0',
        },
      },
      data: {
        animeInfo: [{
          id: 1,
          malId: 12345,
          title: 'Test Anime',
          titleEnglish: null,
          titleJapanese: null,
          imageUrl: null,
          rating: null,
          premiereDate: null,
          numEpisodes: null,
          episodeDuration: null,
          animeType: 'unknown',
          status: null,
          source: null,
          studios: null,
          genres: null,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        }],
        userWatchlist: [{
          id: 1,
          animeInfoId: 1,
          priority: 1,
          watchStatus: 'plan_to_watch' as const,
          userRating: null,
          notes: null,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        }],
        animeRelationships: [],
        timelineCache: [],
      },
    };

    it('validates complete export data', () => {
      const result = ExportDataSchema.safeParse(validExportData);
      expect(result.success).toBe(true);
    });

    it('allows empty arrays for data tables', () => {
      const emptyData = {
        ...validExportData,
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: [],
        },
      };
      const result = ExportDataSchema.safeParse(emptyData);
      expect(result.success).toBe(true);
    });
  });

  describe('ImportOptionsSchema', () => {
    const validOptions = {
      mode: 'merge' as const,
      handleDuplicates: 'update' as const,
      validateRelationships: true,
      clearCache: false,
    };

    it('validates valid import options', () => {
      const result = ImportOptionsSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });

    it('validates mode enum', () => {
      const validModes = ['merge', 'replace'];
      
      for (const mode of validModes) {
        const options = { ...validOptions, mode };
        const result = ImportOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      }

      const invalidMode = { ...validOptions, mode: 'invalid' };
      const result = ImportOptionsSchema.safeParse(invalidMode);
      expect(result.success).toBe(false);
    });

    it('validates handleDuplicates enum', () => {
      const validHandling = ['skip', 'update', 'prompt'];
      
      for (const handling of validHandling) {
        const options = { ...validOptions, handleDuplicates: handling };
        const result = ImportOptionsSchema.safeParse(options);
        expect(result.success).toBe(true);
      }
    });

    it('uses default values', () => {
      const minimal = {
        mode: 'merge' as const,
        handleDuplicates: 'skip' as const,
      };
      
      const result = ImportOptionsSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.validateRelationships).toBe(true);
        expect(result.data.clearCache).toBe(false);
      }
    });
  });

  describe('ImportResultSchema', () => {
    const validResult = {
      success: true,
      recordsProcessed: {
        animeInfo: 10,
        userWatchlist: 8,
        animeRelationships: 5,
        timelineCache: 3,
      },
      errors: [],
      warnings: [],
    };

    it('validates valid import result', () => {
      const result = ImportResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('validates with errors and warnings', () => {
      const withIssues = {
        ...validResult,
        success: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          table: 'animeInfo',
          recordId: 123,
        }],
        warnings: [{
          code: 'DUPLICATE_FOUND',
          message: 'Duplicate entry found',
          details: { malId: 456 },
        }],
      };
      
      const result = ImportResultSchema.safeParse(withIssues);
      expect(result.success).toBe(true);
    });

    it('requires non-negative record counts', () => {
      const negative = {
        ...validResult,
        recordsProcessed: { ...validResult.recordsProcessed, animeInfo: -1 },
      };
      const result = ImportResultSchema.safeParse(negative);
      expect(result.success).toBe(false);
    });
  });

  describe('DatabaseStatsSchema', () => {
    const validStats = {
      animeInfo: 100,
      userWatchlist: 95,
      animeRelationships: 50,
      timelineCache: 25,
      totalRecords: 270,
      lastUpdated: '2023-01-01T00:00:00Z',
    };

    it('validates valid database stats', () => {
      const result = DatabaseStatsSchema.safeParse(validStats);
      expect(result.success).toBe(true);
    });

    it('requires non-negative counts', () => {
      const negative = { ...validStats, animeInfo: -1 };
      const result = DatabaseStatsSchema.safeParse(negative);
      expect(result.success).toBe(false);
    });

    it('validates datetime format for lastUpdated', () => {
      const invalidDate = { ...validStats, lastUpdated: '2023-01-01' };
      const result = DatabaseStatsSchema.safeParse(invalidDate);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiResponseSchema', () => {
    it('validates successful response with data', () => {
      const schema = ApiResponseSchema(DatabaseStatsSchema);
      const response = {
        success: true,
        data: {
          animeInfo: 10,
          userWatchlist: 8,
          animeRelationships: 5,
          timelineCache: 3,
          totalRecords: 26,
          lastUpdated: '2023-01-01T00:00:00Z',
        },
      };
      
      const result = schema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('validates error response', () => {
      const schema = ApiResponseSchema(DatabaseStatsSchema);
      const response = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Connection failed',
          timestamp: '2023-01-01T00:00:00Z',
        },
      };
      
      const result = schema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('allows response with neither data nor error', () => {
      const schema = ApiResponseSchema(DatabaseStatsSchema);
      const response = { success: true };
      
      const result = schema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('FileUploadSchema', () => {
    const validFile = {
      filename: 'export.json',
      mimetype: 'application/json',
      size: 1024,
    };

    it('validates valid file upload', () => {
      const result = FileUploadSchema.safeParse(validFile);
      expect(result.success).toBe(true);
    });

    it('accepts text/json mimetype', () => {
      const textJson = { ...validFile, mimetype: 'text/json' };
      const result = FileUploadSchema.safeParse(textJson);
      expect(result.success).toBe(true);
    });

    it('rejects non-JSON files', () => {
      const nonJson = { ...validFile, mimetype: 'text/plain' };
      const result = FileUploadSchema.safeParse(nonJson);
      expect(result.success).toBe(false);
    });

    it('enforces file size limit', () => {
      const tooLarge = { ...validFile, size: 101 * 1024 * 1024 }; // 101MB
      const result = FileUploadSchema.safeParse(tooLarge);
      expect(result.success).toBe(false);
    });

    it('requires positive file size', () => {
      const zeroSize = { ...validFile, size: 0 };
      const result = FileUploadSchema.safeParse(zeroSize);
      expect(result.success).toBe(false);
    });
  });

  describe('SchemaVersionSchema', () => {
    it('validates valid semver versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30'];
      
      for (const version of validVersions) {
        const result = SchemaVersionSchema.safeParse(version);
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid version formats', () => {
      const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0-beta', '1.0.0.1'];
      
      for (const version of invalidVersions) {
        const result = SchemaVersionSchema.safeParse(version);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('MigrationResultSchema', () => {
    const validMigration = {
      success: true,
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      changes: ['Added new field', 'Updated schema'],
      errors: [],
    };

    it('validates valid migration result', () => {
      const result = MigrationResultSchema.safeParse(validMigration);
      expect(result.success).toBe(true);
    });

    it('validates failed migration with errors', () => {
      const failed = {
        ...validMigration,
        success: false,
        errors: [{
          code: 'MIGRATION_ERROR',
          message: 'Failed to migrate field',
        }],
      };
      
      const result = MigrationResultSchema.safeParse(failed);
      expect(result.success).toBe(true);
    });

    it('allows empty changes array', () => {
      const noChanges = { ...validMigration, changes: [] };
      const result = MigrationResultSchema.safeParse(noChanges);
      expect(result.success).toBe(true);
    });
  });

  describe('Error and Warning Schemas', () => {
    it('validates import error with all fields', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data format',
        details: { field: 'malId', value: 'invalid' },
        table: 'animeInfo',
        recordId: 123,
      };
      
      const result = ImportErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('validates import error with minimal fields', () => {
      const error = {
        code: 'GENERIC_ERROR',
        message: 'Something went wrong',
      };
      
      const result = ImportErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    });

    it('validates import warning', () => {
      const warning = {
        code: 'DUPLICATE_FOUND',
        message: 'Duplicate entry detected',
        details: { malId: 456 },
      };
      
      const result = ImportWarningSchema.safeParse(warning);
      expect(result.success).toBe(true);
    });

    it('requires non-empty code and message', () => {
      const emptyCode = { code: '', message: 'Valid message' };
      const emptyMessage = { code: 'VALID_CODE', message: '' };
      
      expect(ImportErrorSchema.safeParse(emptyCode).success).toBe(false);
      expect(ImportErrorSchema.safeParse(emptyMessage).success).toBe(false);
    });
  });
});