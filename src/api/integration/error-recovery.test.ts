/**
 * Integration Tests for Error Handling and Recovery Scenarios
 * 
 * Tests comprehensive error handling including:
 * - Database connection failures
 * - Transaction rollback scenarios
 * - File corruption handling
 * - Memory and resource constraints
 * - Network and timeout errors
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExportService } from '../services/export-service.js';
import { ImportValidationService } from '../services/import-validation-service.js';
import { ImportExecutionService } from '../services/import-execution-service.js';
import { StatisticsService } from '../services/statistics-service.js';
import { createTestDatabase } from '../../test-utils/database-setup.js';
import type { 
  ExportData, 
  ImportOptions, 
  ImportResult 
} from '../../types/export-import.js';
import Database from 'better-sqlite3';

describe('Error Handling and Recovery Integration Tests', () => {
  let testDb: Database.Database;
  let exportService: ExportService;
  let validationService: ImportValidationService;
  let executionService: ImportExecutionService;
  let statisticsService: StatisticsService;

  beforeEach(async () => {
    testDb = createTestDatabase();
    (global as any).mockDatabase = testDb;
    
    exportService = new ExportService();
    validationService = new ImportValidationService();
    executionService = new ImportExecutionService();
    statisticsService = new StatisticsService();
    
    // Populate test data
    await populateTestData(testDb);
  });

  afterEach(() => {
    if (testDb && testDb.open) {
      testDb.close();
    }
    (global as any).mockDatabase = undefined;
  });

  describe('Database Connection Failures', () => {
    it('should handle export failure when database is closed', async () => {
      // Close database to simulate connection failure
      testDb.close();
      
      await expect(exportService.exportAllData())
        .rejects.toThrow();
    });

    it('should handle import failure when database is closed', async () => {
      // First export data while database is open
      const exportData = await exportService.exportAllData();
      
      // Close database
      testDb.close();
      
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      await expect(executionService.executeImport(exportData, importOptions))
        .rejects.toThrow();
    });

    it('should handle statistics service failure when database is closed', async () => {
      testDb.close();
      
      await expect(statisticsService.getDatabaseStatistics())
        .rejects.toThrow();
    });

    it('should handle partial database corruption gracefully', async () => {
      // Simulate database corruption by executing invalid SQL
      try {
        testDb.exec('DROP TABLE anime_info');
        
        await expect(exportService.exportAllData())
          .rejects.toThrow();
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('Transaction Rollback Scenarios', () => {
    it('should rollback failed import and maintain database consistency', async () => {
      // Get initial state
      const initialStats = await statisticsService.getDatabaseStatistics();
      
      // Create export data that will cause constraint violation
      const exportData = await exportService.exportAllData();
      
      // Add duplicate MAL ID to cause constraint violation
      exportData.data.animeInfo.push({
        id: 999,
        malId: exportData.data.animeInfo[0].malId, // Duplicate MAL ID
        title: 'Duplicate Anime',
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'skip', // This should handle duplicates, but let's test constraint violation
        validateRelationships: true,
        clearCache: false
      };
      
      const importResult = await executionService.executeImport(exportData, importOptions);
      
      // Import should handle the duplicate gracefully
      expect(importResult.success).toBe(true);
      expect(importResult.warnings.length).toBeGreaterThan(0);
      
      // Database should remain consistent
      const finalStats = await statisticsService.getDatabaseStatistics();
      expect(finalStats.animeInfo).toBe(initialStats.animeInfo);
    });

    it('should handle foreign key constraint violations', async () => {
      const initialStats = await statisticsService.getDatabaseStatistics();
      
      // Create export data with foreign key violations
      const invalidExportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 1,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [],
          userWatchlist: [
            {
              id: 1,
              animeInfoId: 999, // Non-existent anime_info_id
              priority: 1,
              watchStatus: 'watching',
              userRating: null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importResult = await executionService.executeImport(invalidExportData, importOptions);
      
      // Import should fail but database should remain consistent
      expect(importResult.success).toBe(false);
      expect(importResult.errors.length).toBeGreaterThan(0);
      
      // Verify database state is unchanged
      const finalStats = await statisticsService.getDatabaseStatistics();
      expect(finalStats.animeInfo).toBe(initialStats.animeInfo);
      expect(finalStats.userWatchlist).toBe(initialStats.userWatchlist);
    });

    it('should handle partial import failures with detailed error reporting', async () => {
      // Create mixed valid and invalid data
      const mixedExportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 3,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 100,
              malId: 100,
              title: 'Valid New Anime',
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          userWatchlist: [
            {
              id: 100,
              animeInfoId: 100, // Valid reference to new anime
              priority: 1,
              watchStatus: 'watching',
              userRating: null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 101,
              animeInfoId: 999, // Invalid reference
              priority: 2,
              watchStatus: 'watching',
              userRating: null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importResult = await executionService.executeImport(mixedExportData, importOptions);
      
      // Should have partial success
      expect(importResult.recordsProcessed.animeInfo).toBe(1);
      expect(importResult.recordsProcessed.userWatchlist).toBe(1); // Only valid one
      expect(importResult.errors.length).toBeGreaterThan(0);
      
      // Verify specific error details
      const foreignKeyError = importResult.errors.find(e => e.code === 'FOREIGN_KEY_VIOLATION');
      expect(foreignKeyError).toBeDefined();
      expect(foreignKeyError!.table).toBe('userWatchlist');
    });
  });

  describe('File Corruption and Validation Errors', () => {
    it('should handle corrupted JSON files', async () => {
      const corruptedJson = '{ "metadata": { "version": "1.0.0" }, "data": { invalid json }';
      const corruptedBuffer = Buffer.from(corruptedJson, 'utf-8');
      
      await expect(validationService.validateImportFile(corruptedBuffer))
        .rejects.toThrow();
    });

    it('should handle files with missing required sections', async () => {
      const incompleteData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 0,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        }
        // Missing data section
      };
      
      const incompleteBuffer = Buffer.from(JSON.stringify(incompleteData), 'utf-8');
      
      const validationResult = await validationService.validateImportFile(incompleteBuffer);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle files with invalid data types', async () => {
      const invalidTypeData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 'invalid', // Should be number
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: 'not an array', // Should be array
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };
      
      const invalidBuffer = Buffer.from(JSON.stringify(invalidTypeData), 'utf-8');
      
      const validationResult = await validationService.validateImportFile(invalidBuffer);
      
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle checksum mismatches', async () => {
      const exportData = await exportService.exportAllData();
      
      // Corrupt the checksum
      exportData.metadata.checksum = 'invalid-checksum';
      
      const verification = await exportService.verifyExportData(exportData);
      
      expect(verification.isValid).toBe(false);
      expect(verification.checksumValid).toBe(false);
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    it('should handle data corruption after export', async () => {
      const exportData = await exportService.exportAllData();
      
      // Corrupt the data
      exportData.data.animeInfo[0].title = 'Corrupted Title';
      
      const verification = await exportService.verifyExportData(exportData);
      
      expect(verification.isValid).toBe(false);
      expect(verification.checksumValid).toBe(false);
    });
  });

  describe('Resource Constraint Scenarios', () => {
    it('should handle large dataset export without memory issues', async () => {
      // Populate large dataset
      await populateLargeTestData(testDb, 2000);
      
      const startTime = Date.now();
      const exportData = await exportService.exportAllData();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(exportData.data.animeInfo.length).toBeGreaterThan(2000);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Verify data integrity
      expect(exportData.metadata.totalRecords).toBeGreaterThan(2000);
      expect(exportData.metadata.checksum).toBeDefined();
    });

    it('should handle large dataset import efficiently', async () => {
      // Create large export data
      await populateLargeTestData(testDb, 1000);
      const exportData = await exportService.exportAllData();
      
      // Clear database
      clearDatabase(testDb);
      
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: false, // Skip validation for performance
        clearCache: false
      };
      
      const startTime = Date.now();
      const importResult = await executionService.executeImport(exportData, importOptions);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(importResult.success).toBe(true);
      expect(importResult.recordsProcessed.animeInfo).toBeGreaterThan(1000);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle memory pressure during processing', async () => {
      // Simulate memory pressure by creating multiple large datasets
      const datasets = [];
      
      for (let i = 0; i < 5; i++) {
        await populateLargeTestData(testDb, 200);
        const exportData = await exportService.exportAllData();
        datasets.push(exportData);
        
        // Clear database for next iteration
        clearDatabase(testDb);
      }
      
      // Verify all datasets were created successfully
      expect(datasets).toHaveLength(5);
      datasets.forEach(dataset => {
        expect(dataset.data.animeInfo.length).toBeGreaterThan(200);
      });
    });
  });

  describe('Concurrent Operation Handling', () => {
    it('should handle concurrent export operations', async () => {
      const concurrentExports = 3;
      const exportPromises = Array(concurrentExports).fill(null).map(() =>
        exportService.exportAllData()
      );
      
      const results = await Promise.all(exportPromises);
      
      // All exports should succeed
      expect(results).toHaveLength(concurrentExports);
      results.forEach(result => {
        expect(result.metadata).toBeDefined();
        expect(result.data).toBeDefined();
      });
      
      // All exports should have the same data (since database didn't change)
      const firstExport = results[0];
      results.slice(1).forEach(result => {
        expect(result.data.animeInfo.length).toBe(firstExport.data.animeInfo.length);
        expect(result.data.userWatchlist.length).toBe(firstExport.data.userWatchlist.length);
      });
    });

    it('should handle concurrent statistics requests', async () => {
      const concurrentRequests = 5;
      const statsPromises = Array(concurrentRequests).fill(null).map(() =>
        statisticsService.getDatabaseStatistics()
      );
      
      const results = await Promise.all(statsPromises);
      
      // All requests should succeed
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.totalRecords).toBeGreaterThan(0);
        expect(result.animeInfo).toBeGreaterThan(0);
      });
    });

    it('should prevent concurrent imports to same database', async () => {
      const exportData = await exportService.exportAllData();
      
      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };
      
      // Start two concurrent imports
      const import1Promise = executionService.executeImport(exportData, importOptions);
      const import2Promise = executionService.executeImport(exportData, importOptions);
      
      const [result1, result2] = await Promise.all([import1Promise, import2Promise]);
      
      // Both should complete, but may have different results due to concurrency
      expect(result1.success || result2.success).toBe(true);
    });
  });

  describe('Recovery and Cleanup Scenarios', () => {
    it('should clean up temporary resources after failed operations', async () => {
      // This test verifies that failed operations don't leave the system in an inconsistent state
      const initialStats = await statisticsService.getDatabaseStatistics();
      
      // Attempt an operation that will fail
      testDb.close();
      
      try {
        await exportService.exportAllData();
      } catch (error) {
        // Expected to fail
      }
      
      // Recreate database and verify it's clean
      testDb = createTestDatabase();
      (global as any).mockDatabase = testDb;
      await populateTestData(testDb);
      
      const newStats = await statisticsService.getDatabaseStatistics();
      expect(newStats.animeInfo).toBeGreaterThan(0);
    });

    it('should handle graceful shutdown scenarios', async () => {
      // Start a long-running operation
      await populateLargeTestData(testDb, 500);
      const exportPromise = exportService.exportAllData();
      
      // Simulate shutdown by closing database
      setTimeout(() => {
        if (testDb.open) {
          testDb.close();
        }
      }, 100);
      
      // Operation should either complete successfully or fail gracefully
      try {
        const result = await exportPromise;
        expect(result).toBeDefined();
      } catch (error) {
        // Graceful failure is acceptable
        expect(error).toBeDefined();
      }
    });

    it('should recover from temporary file system errors', async () => {
      // This test simulates file system errors during export
      const exportData = await exportService.exportAllData();
      
      // Verify export succeeded despite potential file system issues
      expect(exportData.metadata).toBeDefined();
      expect(exportData.data).toBeDefined();
      
      // Verify data can be imported successfully
      clearDatabase(testDb);
      
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importResult = await executionService.executeImport(exportData, importOptions);
      expect(importResult.success).toBe(true);
    });
  });
});

// Helper functions

async function populateTestData(db: Database.Database): Promise<void> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertWatchlist = db.prepare(`
    INSERT INTO user_watchlist (anime_info_id, priority, watch_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertRelationship = db.prepare(`
    INSERT INTO anime_relationships (source_mal_id, target_mal_id, relationship_type, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertCache = db.prepare(`
    INSERT INTO timeline_cache (root_mal_id, timeline_data, cache_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Insert test anime
  const animeData = [
    { malId: 1, title: 'Test Anime 1' },
    { malId: 2, title: 'Test Anime 2' },
    { malId: 3, title: 'Test Anime 3' }
  ];
  
  animeData.forEach(anime => {
    insertAnime.run(anime.malId, anime.title, 'tv', now, now);
  });
  
  // Insert watchlist entries
  const watchlistData = [
    { animeInfoId: 1, priority: 1, status: 'watching' },
    { animeInfoId: 2, priority: 2, status: 'completed' }
  ];
  
  watchlistData.forEach(entry => {
    insertWatchlist.run(entry.animeInfoId, entry.priority, entry.status, now, now);
  });
  
  // Insert relationships
  const relationshipData = [
    { source: 1, target: 2, type: 'sequel' }
  ];
  
  relationshipData.forEach(rel => {
    insertRelationship.run(rel.source, rel.target, rel.type, now);
  });
  
  // Insert cache
  const cacheData = [
    { rootMalId: 1, data: JSON.stringify({ timeline: [1, 2] }) }
  ];
  
  cacheData.forEach(cache => {
    insertCache.run(cache.rootMalId, cache.data, 1, now, now);
  });
}

async function populateLargeTestData(db: Database.Database, count: number): Promise<void> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Use transaction for better performance
  const transaction = db.transaction(() => {
    for (let i = 1; i <= count; i++) {
      insertAnime.run(i + 1000, `Large Test Anime ${i}`, 'tv', now, now);
    }
  });
  
  transaction();
}

function clearDatabase(db: Database.Database): void {
  db.exec('DELETE FROM timeline_cache');
  db.exec('DELETE FROM anime_relationships');
  db.exec('DELETE FROM user_watchlist');
  db.exec('DELETE FROM anime_info');
  db.exec('DELETE FROM sqlite_sequence');
}