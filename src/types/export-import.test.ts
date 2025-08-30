import { describe, it, expect } from 'vitest';
import type {
  ExportData,
  ExportMetadata,
  ImportOptions,
  ImportResult,
  ImportPreview,
  ValidationResult,
  DatabaseStats,
  ApiResponse,
  ImportError,
  ImportWarning,
  MigrationResult,
  VersionHandler,
  ImportMode,
  DuplicateHandling,
} from './export-import';

describe('Export-Import Types', () => {
  describe('Type Compatibility', () => {
    it('should allow valid ExportMetadata', () => {
      const metadata: ExportMetadata = {
        version: '1.0.0',
        exportDate: '2023-01-01T00:00:00Z',
        totalRecords: 100,
        checksum: 'abc123',
        application: {
          name: 'Project Claw',
          version: '1.0.0',
        },
      };
      
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.totalRecords).toBe(100);
    });

    it('should allow valid ExportData structure', () => {
      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00Z',
          totalRecords: 0,
          checksum: 'empty',
          application: {
            name: 'Project Claw',
            version: '1.0.0',
          },
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: [],
        },
      };
      
      expect(exportData.data.animeInfo).toEqual([]);
      expect(exportData.metadata.version).toBe('1.0.0');
    });

    it('should allow valid ImportOptions with all modes', () => {
      const mergeOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false,
      };

      const replaceOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'skip',
        validateRelationships: false,
        clearCache: true,
      };

      expect(mergeOptions.mode).toBe('merge');
      expect(replaceOptions.mode).toBe('replace');
    });

    it('should allow valid ImportResult with success', () => {
      const result: ImportResult = {
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
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(10);
    });

    it('should allow ImportResult with errors and warnings', () => {
      const error: ImportError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data',
        table: 'animeInfo',
        recordId: 123,
        details: { field: 'malId' },
      };

      const warning: ImportWarning = {
        code: 'DUPLICATE_FOUND',
        message: 'Duplicate entry',
        table: 'userWatchlist',
        recordId: 456,
      };

      const result: ImportResult = {
        success: false,
        recordsProcessed: {
          animeInfo: 5,
          userWatchlist: 0,
          animeRelationships: 0,
          timelineCache: 0,
        },
        errors: [error],
        warnings: [warning],
      };
      
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');
    });

    it('should allow valid ValidationResult', () => {
      const validationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00Z',
          totalRecords: 50,
          checksum: 'valid123',
          application: {
            name: 'Project Claw',
            version: '1.0.0',
          },
        },
      };
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.metadata?.version).toBe('1.0.0');
    });

    it('should allow valid ImportPreview with conflicts', () => {
      const preview: ImportPreview = {
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00Z',
          totalRecords: 20,
          checksum: 'preview123',
          application: {
            name: 'Project Claw',
            version: '1.0.0',
          },
        },
        summary: {
          animeInfo: 15,
          userWatchlist: 12,
          animeRelationships: 8,
          timelineCache: 5,
        },
        conflicts: {
          duplicateAnime: [
            {
              malId: 12345,
              title: 'Existing Anime',
              existingTitle: 'Current Title',
            },
          ],
          duplicateWatchlistEntries: [
            {
              animeInfoId: 1,
              title: 'Duplicate Entry',
            },
          ],
        },
        schemaMigrationRequired: false,
        estimatedProcessingTime: 30,
      };
      
      expect(preview.conflicts.duplicateAnime).toHaveLength(1);
      expect(preview.estimatedProcessingTime).toBe(30);
    });

    it('should allow valid DatabaseStats', () => {
      const stats: DatabaseStats = {
        animeInfo: 100,
        userWatchlist: 95,
        animeRelationships: 50,
        timelineCache: 25,
        totalRecords: 270,
        lastUpdated: '2023-01-01T00:00:00Z',
      };
      
      expect(stats.totalRecords).toBe(270);
      expect(stats.lastUpdated).toBe('2023-01-01T00:00:00Z');
    });

    it('should allow valid ApiResponse with data', () => {
      const successResponse: ApiResponse<DatabaseStats> = {
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
      
      expect(successResponse.success).toBe(true);
      expect(successResponse.data?.totalRecords).toBe(26);
    });

    it('should allow valid ApiResponse with error', () => {
      const errorResponse: ApiResponse<DatabaseStats> = {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Connection failed',
          timestamp: '2023-01-01T00:00:00Z',
          details: { connectionString: 'hidden' },
        },
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error?.code).toBe('DATABASE_ERROR');
    });

    it('should allow valid MigrationResult', () => {
      const migration: MigrationResult = {
        success: true,
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        changes: [
          'Added episodeDuration field',
          'Updated animeType enum values',
        ],
        errors: [],
      };
      
      expect(migration.changes).toHaveLength(2);
      expect(migration.fromVersion).toBe('1.0.0');
    });

    it('should allow valid VersionHandler interface', () => {
      const handler: VersionHandler = {
        version: '1.0.0',
        migrate: async (data: any) => {
          // Mock migration logic
          return data as ExportData;
        },
        validate: (data: any) => {
          return typeof data === 'object' && data !== null;
        },
      };
      
      expect(handler.version).toBe('1.0.0');
      expect(typeof handler.migrate).toBe('function');
      expect(typeof handler.validate).toBe('function');
    });
  });

  describe('Enum Types', () => {
    it('should allow valid ImportMode values', () => {
      const merge: ImportMode = 'merge';
      const replace: ImportMode = 'replace';
      
      expect(merge).toBe('merge');
      expect(replace).toBe('replace');
    });

    it('should allow valid DuplicateHandling values', () => {
      const skip: DuplicateHandling = 'skip';
      const update: DuplicateHandling = 'update';
      const prompt: DuplicateHandling = 'prompt';
      
      expect(skip).toBe('skip');
      expect(update).toBe('update');
      expect(prompt).toBe('prompt');
    });
  });

  describe('Optional Fields', () => {
    it('should allow ImportError with minimal fields', () => {
      const minimalError: ImportError = {
        code: 'GENERIC_ERROR',
        message: 'Something went wrong',
      };
      
      expect(minimalError.details).toBeUndefined();
      expect(minimalError.table).toBeUndefined();
      expect(minimalError.recordId).toBeUndefined();
    });

    it('should allow ImportError with all optional fields', () => {
      const fullError: ImportError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data format',
        details: { field: 'malId', expectedType: 'number' },
        table: 'animeInfo',
        recordId: 'anime-123',
      };
      
      expect(fullError.details).toBeDefined();
      expect(fullError.table).toBe('animeInfo');
      expect(fullError.recordId).toBe('anime-123');
    });

    it('should allow ValidationResult without metadata', () => {
      const validationWithoutMetadata: ValidationResult = {
        isValid: false,
        errors: [
          {
            code: 'INVALID_FORMAT',
            message: 'File format is invalid',
          },
        ],
        warnings: [],
      };
      
      expect(validationWithoutMetadata.metadata).toBeUndefined();
      expect(validationWithoutMetadata.isValid).toBe(false);
    });

    it('should allow ApiResponse without data or error', () => {
      const minimalResponse: ApiResponse = {
        success: true,
      };
      
      expect(minimalResponse.data).toBeUndefined();
      expect(minimalResponse.error).toBeUndefined();
    });
  });

  describe('Complex Type Interactions', () => {
    it('should allow nested error structures in ImportResult', () => {
      const complexResult: ImportResult = {
        success: false,
        recordsProcessed: {
          animeInfo: 5,
          userWatchlist: 3,
          animeRelationships: 0,
          timelineCache: 0,
        },
        errors: [
          {
            code: 'FOREIGN_KEY_VIOLATION',
            message: 'Referenced anime not found',
            table: 'userWatchlist',
            recordId: 10,
            details: {
              animeInfoId: 999,
              constraint: 'fk_anime_info_id',
            },
          },
        ],
        warnings: [
          {
            code: 'SCHEMA_MISMATCH',
            message: 'Old schema version detected',
            details: {
              expectedVersion: '1.1.0',
              actualVersion: '1.0.0',
            },
          },
        ],
      };
      
      expect(complexResult.errors[0].details.animeInfoId).toBe(999);
      expect(complexResult.warnings[0].details.expectedVersion).toBe('1.1.0');
    });

    it('should allow ImportPreview with empty conflicts', () => {
      const noConflictsPreview: ImportPreview = {
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00Z',
          totalRecords: 10,
          checksum: 'clean123',
          application: {
            name: 'Project Claw',
            version: '1.0.0',
          },
        },
        summary: {
          animeInfo: 10,
          userWatchlist: 10,
          animeRelationships: 5,
          timelineCache: 2,
        },
        conflicts: {
          duplicateAnime: [],
          duplicateWatchlistEntries: [],
        },
        schemaMigrationRequired: false,
        estimatedProcessingTime: 5,
      };
      
      expect(noConflictsPreview.conflicts.duplicateAnime).toHaveLength(0);
      expect(noConflictsPreview.conflicts.duplicateWatchlistEntries).toHaveLength(0);
    });
  });
});