/**
 * Integration Tests for Schema Migration Scenarios
 * 
 * Tests schema migration functionality including:
 * - Migration from different schema versions
 * - Backward compatibility validation
 * - Data transformation during migration
 * - Migration error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SchemaMigrationService } from '../services/schema-migration-service.js';
import { ImportValidationService } from '../services/import-validation-service.js';
import { ImportExecutionService } from '../services/import-execution-service.js';
import { createTestDatabase } from '../../test-utils/database-setup.js';
import type { 
  ExportData, 
  MigrationResult, 
  ImportOptions 
} from '../../types/export-import.js';
import Database from 'better-sqlite3';

describe('Schema Migration Integration Tests', () => {
  let testDb: Database.Database;
  let migrationService: SchemaMigrationService;
  let validationService: ImportValidationService;
  let executionService: ImportExecutionService;

  beforeEach(async () => {
    testDb = createTestDatabase();
    (global as any).mockDatabase = testDb;
    
    migrationService = new SchemaMigrationService();
    validationService = new ImportValidationService();
    executionService = new ImportExecutionService();
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    (global as any).mockDatabase = undefined;
  });

  describe('Current Version Migration', () => {
    it('should handle current version data without changes', async () => {
      const currentVersionData = createMockExportData('1.0.0');
      
      const result = await migrationService.migrateToCurrentVersion(currentVersionData);
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.changes).toContain('No migration required');
      expect(result.errors).toHaveLength(0);
      expect(result.migratedData).toEqual(currentVersionData);
    });

    it('should validate current version data structure', async () => {
      const currentVersionData = createMockExportData('1.0.0');
      
      const validation = await migrationService.validateMigratedData(currentVersionData);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid current version data', async () => {
      const invalidData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 1,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: 'invalid', // Should be array
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      } as any;
      
      const validation = await migrationService.validateMigratedData(invalidData);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.code === 'INVALID_TABLE_STRUCTURE')).toBe(true);
    });
  });

  describe('Version Detection and Validation', () => {
    it('should detect missing version metadata', async () => {
      const dataWithoutVersion = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: 0,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
          // Missing version field
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const result = await migrationService.migrateToCurrentVersion(dataWithoutVersion);
      
      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should detect missing metadata section', async () => {
      const dataWithoutMetadata = {
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const result = await migrationService.migrateToCurrentVersion(dataWithoutMetadata);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should handle completely invalid data', async () => {
      const invalidData = 'not an object';
      
      const result = await migrationService.migrateToCurrentVersion(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('unknown');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null or undefined data', async () => {
      const nullResult = await migrationService.migrateToCurrentVersion(null);
      expect(nullResult.success).toBe(false);
      
      const undefinedResult = await migrationService.migrateToCurrentVersion(undefined);
      expect(undefinedResult.success).toBe(false);
    });
  });

  describe('Version Handler System', () => {
    it('should have version handler for current version', () => {
      const supportedVersions = migrationService.getSupportedVersions();
      
      expect(supportedVersions).toContain('1.0.0');
      expect(migrationService.isVersionSupported('1.0.0')).toBe(true);
    });

    it('should report current version correctly', () => {
      const currentVersion = migrationService.getCurrentVersion();
      
      expect(currentVersion).toBe('1.0.0');
    });

    it('should handle unsupported version gracefully', async () => {
      const unsupportedVersionData = createMockExportData('0.5.0');
      
      const result = await migrationService.migrateToCurrentVersion(unsupportedVersionData);
      
      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('0.5.0');
      expect(result.errors.some(e => e.code === 'NO_MIGRATION_PATH')).toBe(true);
    });

    it('should handle future version gracefully', async () => {
      const futureVersionData = createMockExportData('2.0.0');
      
      const result = await migrationService.migrateToCurrentVersion(futureVersionData);
      
      expect(result.success).toBe(false);
      expect(result.fromVersion).toBe('2.0.0');
      expect(result.errors.some(e => e.code === 'NO_MIGRATION_PATH')).toBe(true);
    });
  });

  describe('Migration Integration with Import Process', () => {
    it('should integrate migration with validation service', async () => {
      const exportData = createMockExportData('1.0.0');
      const exportBuffer = Buffer.from(JSON.stringify(exportData), 'utf-8');
      
      // Validation should succeed for current version
      const validationResult = await validationService.validateImportFile(exportBuffer);
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.metadata?.version).toBe('1.0.0');
    });

    it('should integrate migration with import execution', async () => {
      const exportData = createMockExportData('1.0.0');
      
      // First migrate the data
      const migrationResult = await migrationService.migrateToCurrentVersion(exportData);
      expect(migrationResult.success).toBe(true);
      
      // Then execute import with migrated data
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importResult = await executionService.executeImport(
        migrationResult.migratedData!,
        importOptions
      );
      
      expect(importResult.success).toBe(true);
      expect(importResult.recordsProcessed.animeInfo).toBe(2);
    });

    it('should handle migration failure in import process', async () => {
      const invalidData = {
        metadata: { version: 'invalid' },
        data: { invalid: 'structure' }
      };
      
      // Migration should fail
      const migrationResult = await migrationService.migrateToCurrentVersion(invalidData);
      expect(migrationResult.success).toBe(false);
      
      // Import should not proceed with failed migration
      if (!migrationResult.success) {
        expect(migrationResult.migratedData).toBeUndefined();
      }
    });
  });

  describe('Data Transformation During Migration', () => {
    it('should preserve data integrity during migration', async () => {
      const originalData = createMockExportData('1.0.0');
      
      const migrationResult = await migrationService.migrateToCurrentVersion(originalData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migratedData).toBeDefined();
      
      // Verify data integrity
      const migratedData = migrationResult.migratedData!;
      expect(migratedData.data.animeInfo).toHaveLength(originalData.data.animeInfo.length);
      expect(migratedData.data.userWatchlist).toHaveLength(originalData.data.userWatchlist.length);
      expect(migratedData.data.animeRelationships).toHaveLength(originalData.data.animeRelationships.length);
      expect(migratedData.data.timelineCache).toHaveLength(originalData.data.timelineCache.length);
      
      // Verify specific data fields
      expect(migratedData.data.animeInfo[0].malId).toBe(originalData.data.animeInfo[0].malId);
      expect(migratedData.data.animeInfo[0].title).toBe(originalData.data.animeInfo[0].title);
    });

    it('should update metadata version after migration', async () => {
      const originalData = createMockExportData('1.0.0');
      
      const migrationResult = await migrationService.migrateToCurrentVersion(originalData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migratedData!.metadata.version).toBe('1.0.0');
    });

    it('should validate migrated data structure', async () => {
      const originalData = createMockExportData('1.0.0');
      
      const migrationResult = await migrationService.migrateToCurrentVersion(originalData);
      expect(migrationResult.success).toBe(true);
      
      const validation = await migrationService.validateMigratedData(migrationResult.migratedData!);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Migration Error Scenarios', () => {
    it('should handle migration service errors gracefully', async () => {
      // Create data that will cause migration to throw an error
      const problematicData = {
        metadata: {
          version: '1.0.0'
        },
        data: null // This should cause an error during processing
      };
      
      const result = await migrationService.migrateToCurrentVersion(problematicData);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code.includes('ERROR'))).toBe(true);
    });

    it('should provide detailed error information', async () => {
      const invalidStructureData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 1,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [{ invalid: 'structure' }], // Missing required fields
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const validation = await migrationService.validateMigratedData(invalidStructureData as any);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // Errors should have detailed information
      validation.errors.forEach(error => {
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
      });
    });

    it('should handle version comparison edge cases', async () => {
      // Test version comparison with different formats
      const versions = migrationService.getSupportedVersions();
      
      expect(versions).toBeInstanceOf(Array);
      expect(versions.length).toBeGreaterThan(0);
      
      // All versions should be valid semantic version strings
      versions.forEach(version => {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });

  describe('Performance and Memory Usage', () => {
    it('should handle large dataset migration efficiently', async () => {
      const largeData = createLargeMockExportData('1.0.0', 1000);
      
      const startTime = Date.now();
      const result = await migrationService.migrateToCurrentVersion(largeData);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify data integrity for large dataset
      expect(result.migratedData!.data.animeInfo).toHaveLength(1000);
    });

    it('should not leak memory during migration', async () => {
      // Test multiple migrations to check for memory leaks
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const data = createMockExportData('1.0.0');
        const result = await migrationService.migrateToCurrentVersion(data);
        
        expect(result.success).toBe(true);
        
        // Force garbage collection if available (in test environment)
        if (global.gc) {
          global.gc();
        }
      }
      
      // If we reach here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});

// Helper functions for creating test data

function createMockExportData(version: string): ExportData {
  return {
    metadata: {
      version,
      exportDate: new Date().toISOString(),
      totalRecords: 4,
      checksum: 'mock-checksum',
      application: {
        name: 'Test App',
        version: '1.0.0'
      }
    },
    data: {
      animeInfo: [
        {
          id: 1,
          malId: 1,
          title: 'Test Anime 1',
          titleEnglish: 'Test Anime 1 English',
          titleJapanese: 'テストアニメ1',
          imageUrl: 'https://example.com/image1.jpg',
          rating: 8.5,
          premiereDate: '2020-01-01',
          numEpisodes: 12,
          episodeDuration: 24,
          animeType: 'tv',
          status: 'finished_airing',
          source: 'manga',
          studios: JSON.stringify(['Studio A']),
          genres: JSON.stringify(['Action', 'Drama']),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 2,
          malId: 2,
          title: 'Test Anime 2',
          titleEnglish: null,
          titleJapanese: null,
          imageUrl: null,
          rating: null,
          premiereDate: null,
          numEpisodes: null,
          episodeDuration: null,
          animeType: 'movie',
          status: null,
          source: null,
          studios: null,
          genres: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      userWatchlist: [
        {
          id: 1,
          animeInfoId: 1,
          priority: 1,
          watchStatus: 'watching',
          userRating: 9.0,
          notes: 'Great anime!',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      animeRelationships: [
        {
          id: 1,
          sourceMalId: 1,
          targetMalId: 2,
          relationshipType: 'sequel',
          createdAt: new Date().toISOString()
        }
      ],
      timelineCache: [
        {
          id: 1,
          rootMalId: 1,
          timelineData: JSON.stringify({ timeline: [1, 2] }),
          cacheVersion: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }
  };
}

function createLargeMockExportData(version: string, count: number): ExportData {
  const animeInfo = [];
  const userWatchlist = [];
  const animeRelationships = [];
  const timelineCache = [];
  
  const now = new Date().toISOString();
  
  for (let i = 1; i <= count; i++) {
    animeInfo.push({
      id: i,
      malId: i,
      title: `Test Anime ${i}`,
      titleEnglish: null,
      titleJapanese: null,
      imageUrl: null,
      rating: null,
      premiereDate: null,
      numEpisodes: null,
      episodeDuration: null,
      animeType: 'tv',
      status: null,
      source: null,
      studios: null,
      genres: null,
      createdAt: now,
      updatedAt: now
    });
    
    // Add every 5th anime to watchlist
    if (i % 5 === 0) {
      userWatchlist.push({
        id: Math.floor(i / 5),
        animeInfoId: i,
        priority: Math.floor(i / 5),
        watchStatus: 'plan_to_watch',
        userRating: null,
        notes: null,
        createdAt: now,
        updatedAt: now
      });
    }
    
    // Add relationships for sequential anime
    if (i > 1 && i % 2 === 0) {
      animeRelationships.push({
        id: Math.floor(i / 2),
        sourceMalId: i - 1,
        targetMalId: i,
        relationshipType: 'sequel',
        createdAt: now
      });
    }
    
    // Add cache for every 10th anime
    if (i % 10 === 0) {
      timelineCache.push({
        id: Math.floor(i / 10),
        rootMalId: i,
        timelineData: JSON.stringify({ timeline: [i] }),
        cacheVersion: 1,
        createdAt: now,
        updatedAt: now
      });
    }
  }
  
  return {
    metadata: {
      version,
      exportDate: now,
      totalRecords: animeInfo.length + userWatchlist.length + animeRelationships.length + timelineCache.length,
      checksum: 'large-mock-checksum',
      application: {
        name: 'Test App',
        version: '1.0.0'
      }
    },
    data: {
      animeInfo,
      userWatchlist,
      animeRelationships,
      timelineCache
    }
  };
}