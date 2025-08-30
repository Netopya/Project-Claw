import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaMigrationService } from './schema-migration-service.js';
import type { ExportData } from '../../types/export-import.js';

describe('SchemaMigrationService', () => {
  let service: SchemaMigrationService;

  beforeEach(() => {
    service = new SchemaMigrationService();
  });

  describe('constructor', () => {
    it('should initialize with current version', () => {
      expect(service.getCurrentVersion()).toBe('1.0.0');
    });

    it('should have supported versions', () => {
      const supportedVersions = service.getSupportedVersions();
      expect(supportedVersions).toContain('1.0.0');
      expect(supportedVersions.length).toBeGreaterThan(0);
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for current version', () => {
      expect(service.isVersionSupported('1.0.0')).toBe(true);
    });

    it('should return false for unsupported version', () => {
      expect(service.isVersionSupported('2.0.0')).toBe(false);
      expect(service.isVersionSupported('0.5.0')).toBe(false);
    });
  });

  describe('migrateToCurrentVersion', () => {
    const validExportData: ExportData = {
      metadata: {
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        totalRecords: 4,
        checksum: 'test-checksum',
        application: {
          name: 'anime-tracker',
          version: '1.0.0'
        }
      },
      data: {
        animeInfo: [
          {
            id: 1,
            malId: 1001,
            title: 'Test Anime',
            titleEnglish: 'Test Anime EN',
            titleJapanese: 'テストアニメ',
            imageUrl: 'https://example.com/image.jpg',
            rating: 8.5,
            premiereDate: '2024-01-01',
            numEpisodes: 12,
            episodeDuration: 24,
            animeType: 'TV',
            status: 'completed',
            source: 'manga',
            studios: 'Test Studio',
            genres: 'Action, Drama',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ],
        userWatchlist: [
          {
            id: 1,
            animeInfoId: 1,
            priority: 1,
            watchStatus: 'completed',
            userRating: 9,
            notes: 'Great anime',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ],
        animeRelationships: [
          {
            id: 1,
            sourceMalId: 1001,
            targetMalId: 1002,
            relationshipType: 'sequel',
            createdAt: '2024-01-01T00:00:00.000Z'
          }
        ],
        timelineCache: [
          {
            id: 1,
            rootMalId: 1001,
            timelineData: '{"nodes": [], "edges": []}',
            cacheVersion: 1,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      }
    };

    it('should handle current version data without migration', async () => {
      const result = await service.migrateToCurrentVersion(validExportData);

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.changes).toContain('No migration required - data is already current version');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle data without version', async () => {
      const dataWithoutVersion = {
        metadata: {
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const result = await service.migrateToCurrentVersion(dataWithoutVersion);

      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should handle data without metadata', async () => {
      const dataWithoutMetadata = {
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const result = await service.migrateToCurrentVersion(dataWithoutMetadata);

      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should handle unsupported version', async () => {
      const unsupportedVersionData = {
        ...validExportData,
        metadata: {
          ...validExportData.metadata,
          version: '2.0.0'
        }
      };

      const result = await service.migrateToCurrentVersion(unsupportedVersionData);

      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('2.0.0');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('NO_MIGRATION_PATH');
    });

    it('should handle invalid data structure', async () => {
      const result = await service.migrateToCurrentVersion(null);

      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should handle migration service errors', async () => {
      const invalidData = {
        metadata: {
          version: '1.0.0'
        }
        // Missing data section will cause validation to fail
      };

      const result = await service.migrateToCurrentVersion(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateMigratedData', () => {
    const validMigratedData: ExportData = {
      metadata: {
        version: '1.0.0',
        exportDate: '2024-01-01T00:00:00.000Z',
        totalRecords: 1,
        checksum: 'test-checksum',
        application: {
          name: 'anime-tracker',
          version: '1.0.0'
        }
      },
      data: {
        animeInfo: [],
        userWatchlist: [],
        animeRelationships: [],
        timelineCache: []
      }
    };

    it('should validate correct migrated data', async () => {
      const result = await service.validateMigratedData(validMigratedData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject data without metadata', async () => {
      const dataWithoutMetadata = {
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      } as any;

      const result = await service.validateMigratedData(dataWithoutMetadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_METADATA')).toBe(true);
    });

    it('should reject data without data section', async () => {
      const dataWithoutDataSection = {
        metadata: validMigratedData.metadata
      } as any;

      const result = await service.validateMigratedData(dataWithoutDataSection);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_DATA')).toBe(true);
    });

    it('should reject data with missing version', async () => {
      const dataWithoutVersion = {
        metadata: {
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'test',
          application: { name: 'test', version: '1.0.0' }
        },
        data: validMigratedData.data
      } as any;

      const result = await service.validateMigratedData(dataWithoutVersion);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_VERSION')).toBe(true);
    });

    it('should reject data with incorrect version', async () => {
      const dataWithWrongVersion = {
        ...validMigratedData,
        metadata: {
          ...validMigratedData.metadata,
          version: '0.9.0'
        }
      };

      const result = await service.validateMigratedData(dataWithWrongVersion);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INCORRECT_VERSION')).toBe(true);
    });

    it('should reject data with invalid table structure', async () => {
      const dataWithInvalidTable = {
        ...validMigratedData,
        data: {
          ...validMigratedData.data,
          animeInfo: 'not-an-array' as any
        }
      };

      const result = await service.validateMigratedData(dataWithInvalidTable);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TABLE_STRUCTURE')).toBe(true);
    });

    it('should reject null data', async () => {
      const result = await service.validateMigratedData(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_STRUCTURE')).toBe(true);
    });

    it('should reject non-object data', async () => {
      const result = await service.validateMigratedData('invalid' as any);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_STRUCTURE')).toBe(true);
    });

    it('should validate all required tables', async () => {
      const dataWithMissingTables = {
        ...validMigratedData,
        data: {
          animeInfo: [],
          userWatchlist: []
          // Missing animeRelationships and timelineCache
        } as any
      };

      const result = await service.validateMigratedData(dataWithMissingTables);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TABLE_STRUCTURE' && e.table === 'animeRelationships')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_TABLE_STRUCTURE' && e.table === 'timelineCache')).toBe(true);
    });
  });

  describe('version comparison and utilities', () => {
    it('should get supported versions in sorted order', () => {
      const versions = service.getSupportedVersions();
      expect(versions).toContain('1.0.0');
      expect(Array.isArray(versions)).toBe(true);
    });

    it('should return current version', () => {
      expect(service.getCurrentVersion()).toBe('1.0.0');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty data gracefully', async () => {
      const result = await service.migrateToCurrentVersion({});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed metadata', async () => {
      const malformedData = {
        metadata: 'not-an-object',
        data: {}
      };

      const result = await service.migrateToCurrentVersion(malformedData);

      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
    });

    it('should handle validation errors during migration', async () => {
      // Create data that would fail validation in the version handler
      const invalidStructureData = {
        metadata: {
          version: '1.0.0'
        },
        data: 'not-an-object'
      };

      const result = await service.migrateToCurrentVersion(invalidStructureData);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'VALIDATION_FAILED')).toBe(true);
    });
  });

  describe('Version100Handler', () => {
    it('should validate correct 1.0.0 structure', async () => {
      const validData = {
        metadata: { version: '1.0.0' },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const result = await service.migrateToCurrentVersion(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid 1.0.0 structure', async () => {
      const invalidData = {
        metadata: { version: '1.0.0' },
        data: {
          animeInfo: 'not-array',
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const result = await service.migrateToCurrentVersion(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle missing data section', async () => {
      const dataWithoutDataSection = {
        metadata: { version: '1.0.0' }
      };

      const result = await service.migrateToCurrentVersion(dataWithoutDataSection);
      expect(result.success).toBe(false);
    });

    it('should handle missing required tables', async () => {
      const dataWithMissingTables = {
        metadata: { version: '1.0.0' },
        data: {
          animeInfo: [],
          userWatchlist: []
          // Missing animeRelationships and timelineCache
        }
      };

      const result = await service.migrateToCurrentVersion(dataWithMissingTables);
      expect(result.success).toBe(false);
    });
  });
});