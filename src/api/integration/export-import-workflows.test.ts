/**
 * Integration Tests for Complete Export-Import Workflows
 * 
 * Tests end-to-end workflows including:
 * - Full export-import cycle
 * - Schema migration scenarios
 * - Data integrity verification
 * - Error handling and recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExportService } from '../services/export-service.js';
import { ImportValidationService } from '../services/import-validation-service.js';
import { ImportExecutionService } from '../services/import-execution-service.js';
import { SchemaMigrationService } from '../services/schema-migration-service.js';
import { StatisticsService } from '../services/statistics-service.js';
import { createTestDatabase } from '../../test-utils/database-setup.js';
import { db, getSQLiteConnection } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { 
  ExportData, 
  ImportOptions, 
  ImportResult,
  DatabaseStats 
} from '../../types/export-import.js';
import Database from 'better-sqlite3';

describe('Export-Import Workflows Integration Tests', () => {
  let testDb: Database.Database;
  let originalDb: Database.Database;

  beforeEach(async () => {
    // Create test database
    testDb = createTestDatabase();
    
    // Store original database connection
    originalDb = getSQLiteConnection();
    
    // Mock the database connection to use test database
    (global as any).mockDatabase = testDb;
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    // Restore original database connection
    (global as any).mockDatabase = undefined;
  });

  describe('Full Export-Import Cycle', () => {
    it('should complete full export-import cycle with data integrity', async () => {
      // Step 1: Populate database with test data
      const testData = await populateTestDatabase(testDb);
      
      // Step 2: Export all data
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      // Verify export data structure
      expect(exportData.metadata).toBeDefined();
      expect(exportData.metadata.version).toBe('1.0.0');
      expect(exportData.metadata.totalRecords).toBeGreaterThan(0);
      expect(exportData.data).toBeDefined();
      expect(exportData.data.animeInfo).toHaveLength(testData.animeCount);
      expect(exportData.data.userWatchlist).toHaveLength(testData.watchlistCount);
      expect(exportData.data.animeRelationships).toHaveLength(testData.relationshipCount);
      expect(exportData.data.timelineCache).toHaveLength(testData.cacheCount);
      
      // Step 3: Clear database (simulate fresh installation)
      clearDatabase(testDb);
      
      // Step 4: Import data back
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(exportData, importOptions);
      
      // Verify import success
      expect(importResult.success).toBe(true);
      expect(importResult.errors).toHaveLength(0);
      expect(importResult.recordsProcessed.animeInfo).toBe(testData.animeCount);
      expect(importResult.recordsProcessed.userWatchlist).toBe(testData.watchlistCount);
      expect(importResult.recordsProcessed.animeRelationships).toBe(testData.relationshipCount);
      expect(importResult.recordsProcessed.timelineCache).toBe(testData.cacheCount);
      
      // Step 5: Verify data integrity after import
      const statisticsService = new StatisticsService();
      const finalStats = await statisticsService.getDatabaseStatistics();
      
      expect(finalStats.animeInfo).toBe(testData.animeCount);
      expect(finalStats.userWatchlist).toBe(testData.watchlistCount);
      expect(finalStats.animeRelationships).toBe(testData.relationshipCount);
      expect(finalStats.timelineCache).toBe(testData.cacheCount);
      
      // Step 6: Verify specific data integrity
      await verifyDataIntegrity(testDb, testData);
    });

    it('should handle merge mode import correctly', async () => {
      // Step 1: Populate initial database
      const initialData = await populateTestDatabase(testDb);
      
      // Step 2: Export initial data
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      // Step 3: Add more data to database
      const additionalData = await addAdditionalTestData(testDb);
      
      // Step 4: Import original data in merge mode
      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(exportData, importOptions);
      
      // Verify merge results
      expect(importResult.success).toBe(true);
      expect(importResult.warnings.length).toBeGreaterThan(0); // Should have duplicate warnings
      
      // Verify final counts include both original and additional data
      const statisticsService = new StatisticsService();
      const finalStats = await statisticsService.getDatabaseStatistics();
      
      expect(finalStats.animeInfo).toBe(initialData.animeCount + additionalData.animeCount);
      expect(finalStats.userWatchlist).toBe(initialData.watchlistCount + additionalData.watchlistCount);
    });

    it('should handle large dataset export-import efficiently', async () => {
      // Create large dataset
      const largeDataset = await populateLargeTestDatabase(testDb, 1000);
      
      const startTime = Date.now();
      
      // Export large dataset
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      const exportTime = Date.now() - startTime;
      console.log(`Export of ${largeDataset.animeCount} records took ${exportTime}ms`);
      
      // Clear and import
      clearDatabase(testDb);
      
      const importStartTime = Date.now();
      
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(exportData, importOptions);
      
      const importTime = Date.now() - importStartTime;
      console.log(`Import of ${largeDataset.animeCount} records took ${importTime}ms`);
      
      // Verify performance is reasonable (less than 30 seconds for 1000 records)
      expect(exportTime).toBeLessThan(30000);
      expect(importTime).toBeLessThan(30000);
      
      // Verify data integrity
      expect(importResult.success).toBe(true);
      expect(importResult.recordsProcessed.animeInfo).toBe(largeDataset.animeCount);
    });
  });

  describe('Schema Migration Scenarios', () => {
    it('should handle current version data without migration', async () => {
      // Populate test data
      await populateTestDatabase(testDb);
      
      // Export data (current version)
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      // Test migration service
      const migrationService = new SchemaMigrationService();
      const migrationResult = await migrationService.migrateToCurrentVersion(exportData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.fromVersion).toBe('1.0.0');
      expect(migrationResult.toVersion).toBe('1.0.0');
      expect(migrationResult.changes).toContain('No migration required');
      expect(migrationResult.migratedData).toEqual(exportData);
    });

    it('should detect and handle missing version metadata', async () => {
      // Create export data without version
      const invalidExportData = {
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
      
      const migrationService = new SchemaMigrationService();
      const migrationResult = await migrationService.migrateToCurrentVersion(invalidExportData);
      
      expect(migrationResult.success).toBe(false);
      expect(migrationResult.errors).toHaveLength(1);
      expect(migrationResult.errors[0].code).toBe('MISSING_VERSION');
    });

    it('should validate migrated data structure', async () => {
      // Create valid export data
      await populateTestDatabase(testDb);
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      const migrationService = new SchemaMigrationService();
      const validation = await migrationService.validateMigratedData(exportData);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid migrated data structure', async () => {
      // Create invalid export data structure
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
      
      const migrationService = new SchemaMigrationService();
      const validation = await migrationService.validateMigratedData(invalidData);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.code === 'INVALID_TABLE_STRUCTURE')).toBe(true);
    });
  });

  describe('Data Integrity Verification', () => {
    it('should detect and report foreign key violations', async () => {
      // Create export data with foreign key violations
      const invalidExportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 2,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1,
              title: 'Test Anime',
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
      
      const importService = new ImportExecutionService();
      const validationErrors = importService.validateImportData(invalidExportData);
      
      expect(validationErrors.length).toBeGreaterThan(0);
      expect(validationErrors.some(e => e.code === 'INVALID_FOREIGN_KEY')).toBe(true);
    });

    it('should verify checksum integrity', async () => {
      // Populate test data and export
      await populateTestDatabase(testDb);
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      // Verify original checksum
      const verification = await exportService.verifyExportData(exportData);
      expect(verification.isValid).toBe(true);
      expect(verification.checksumValid).toBe(true);
      
      // Corrupt the data and verify checksum fails
      exportData.data.animeInfo[0].title = 'Corrupted Title';
      const corruptedVerification = await exportService.verifyExportData(exportData);
      expect(corruptedVerification.isValid).toBe(false);
      expect(corruptedVerification.checksumValid).toBe(false);
    });

    it('should validate data relationships after import', async () => {
      // Create test data with complex relationships
      const testData = await populateComplexTestDatabase(testDb);
      
      // Export and reimport
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      clearDatabase(testDb);
      
      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(exportData, importOptions);
      
      expect(importResult.success).toBe(true);
      
      // Verify relationships are intact
      await verifyRelationshipIntegrity(testDb, testData);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should rollback failed import and maintain database consistency', async () => {
      // Populate initial data
      const initialData = await populateTestDatabase(testDb);
      
      // Create export data that will cause import failure
      const exportService = new ExportService();
      const exportData = await exportService.exportAllData();
      
      // Corrupt the export data to cause import failure
      exportData.data.animeInfo.push({
        id: 999,
        malId: 1, // Duplicate MAL ID - will cause constraint violation
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
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(exportData, importOptions);
      
      // Import should fail but database should remain consistent
      expect(importResult.success).toBe(false);
      expect(importResult.errors.length).toBeGreaterThan(0);
      
      // Verify original data is still intact
      const statisticsService = new StatisticsService();
      const finalStats = await statisticsService.getDatabaseStatistics();
      
      expect(finalStats.animeInfo).toBe(initialData.animeCount);
      expect(finalStats.userWatchlist).toBe(initialData.watchlistCount);
    });

    it('should handle database connection errors gracefully', async () => {
      // Close database connection to simulate error
      testDb.close();
      
      const exportService = new ExportService();
      
      await expect(exportService.exportAllData())
        .rejects.toThrow();
    });

    it('should handle corrupted import file gracefully', async () => {
      const validationService = new ImportValidationService();
      
      // Test with invalid JSON
      const invalidJsonBuffer = Buffer.from('{ invalid json }', 'utf-8');
      
      await expect(validationService.validateImportFile(invalidJsonBuffer))
        .rejects.toThrow();
    });

    it('should handle partial import failures with detailed error reporting', async () => {
      // Create export data with mixed valid and invalid records
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
              id: 1,
              malId: 1,
              title: 'Valid Anime 1',
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
            },
            {
              id: 2,
              malId: 2,
              title: 'Valid Anime 2',
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
              id: 1,
              animeInfoId: 1, // Valid reference
              priority: 1,
              watchStatus: 'watching',
              userRating: null,
              notes: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 2,
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
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };
      
      const importService = new ImportExecutionService();
      const importResult = await importService.executeImport(mixedExportData, importOptions);
      
      // Should have partial success with detailed error reporting
      expect(importResult.recordsProcessed.animeInfo).toBe(2);
      expect(importResult.recordsProcessed.userWatchlist).toBe(1); // Only valid one
      expect(importResult.errors.length).toBeGreaterThan(0);
      expect(importResult.errors.some(e => e.code === 'FOREIGN_KEY_VIOLATION')).toBe(true);
    });
  });
});

// Helper functions for test data setup

async function populateTestDatabase(db: Database.Database): Promise<{
  animeCount: number;
  watchlistCount: number;
  relationshipCount: number;
  cacheCount: number;
}> {
  // Insert anime info
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const animeData = [
    { malId: 1, title: 'Attack on Titan', type: 'tv' },
    { malId: 2, title: 'Attack on Titan Season 2', type: 'tv' },
    { malId: 3, title: 'Attack on Titan Season 3', type: 'tv' },
    { malId: 4, title: 'Death Note', type: 'tv' },
    { malId: 5, title: 'One Piece', type: 'tv' }
  ];
  
  const now = new Date().toISOString();
  animeData.forEach(anime => {
    insertAnime.run(anime.malId, anime.title, anime.type, now, now);
  });
  
  // Insert watchlist entries
  const insertWatchlist = db.prepare(`
    INSERT INTO user_watchlist (anime_info_id, priority, watch_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const watchlistData = [
    { animeInfoId: 1, priority: 1, status: 'watching' },
    { animeInfoId: 2, priority: 2, status: 'plan_to_watch' },
    { animeInfoId: 4, priority: 3, status: 'completed' }
  ];
  
  watchlistData.forEach(entry => {
    insertWatchlist.run(entry.animeInfoId, entry.priority, entry.status, now, now);
  });
  
  // Insert relationships
  const insertRelationship = db.prepare(`
    INSERT INTO anime_relationships (source_mal_id, target_mal_id, relationship_type, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const relationshipData = [
    { source: 1, target: 2, type: 'sequel' },
    { source: 2, target: 3, type: 'sequel' }
  ];
  
  relationshipData.forEach(rel => {
    insertRelationship.run(rel.source, rel.target, rel.type, now);
  });
  
  // Insert timeline cache
  const insertCache = db.prepare(`
    INSERT INTO timeline_cache (root_mal_id, timeline_data, cache_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const cacheData = [
    { rootMalId: 1, data: JSON.stringify({ timeline: [1, 2, 3] }) }
  ];
  
  cacheData.forEach(cache => {
    insertCache.run(cache.rootMalId, cache.data, 1, now, now);
  });
  
  return {
    animeCount: animeData.length,
    watchlistCount: watchlistData.length,
    relationshipCount: relationshipData.length,
    cacheCount: cacheData.length
  };
}

async function addAdditionalTestData(db: Database.Database): Promise<{
  animeCount: number;
  watchlistCount: number;
}> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertWatchlist = db.prepare(`
    INSERT INTO user_watchlist (anime_info_id, priority, watch_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Add new anime
  const newAnime = [
    { malId: 6, title: 'Naruto', type: 'tv' },
    { malId: 7, title: 'Bleach', type: 'tv' }
  ];
  
  newAnime.forEach(anime => {
    insertAnime.run(anime.malId, anime.title, anime.type, now, now);
  });
  
  // Get the new anime_info_ids
  const getAnimeId = db.prepare('SELECT id FROM anime_info WHERE mal_id = ?');
  const anime6Id = (getAnimeId.get(6) as any).id;
  const anime7Id = (getAnimeId.get(7) as any).id;
  
  // Add to watchlist
  const newWatchlist = [
    { animeInfoId: anime6Id, priority: 4, status: 'watching' },
    { animeInfoId: anime7Id, priority: 5, status: 'plan_to_watch' }
  ];
  
  newWatchlist.forEach(entry => {
    insertWatchlist.run(entry.animeInfoId, entry.priority, entry.status, now, now);
  });
  
  return {
    animeCount: newAnime.length,
    watchlistCount: newWatchlist.length
  };
}

async function populateLargeTestDatabase(db: Database.Database, count: number): Promise<{
  animeCount: number;
  watchlistCount: number;
  relationshipCount: number;
  cacheCount: number;
}> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertWatchlist = db.prepare(`
    INSERT INTO user_watchlist (anime_info_id, priority, watch_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Insert anime in batches
  const transaction = db.transaction(() => {
    for (let i = 1; i <= count; i++) {
      insertAnime.run(i, `Test Anime ${i}`, 'tv', now, now);
      
      // Add every 3rd anime to watchlist
      if (i % 3 === 0) {
        insertWatchlist.run(i, Math.floor(i / 3), 'plan_to_watch', now, now);
      }
    }
  });
  
  transaction();
  
  return {
    animeCount: count,
    watchlistCount: Math.floor(count / 3),
    relationshipCount: 0,
    cacheCount: 0
  };
}

async function populateComplexTestDatabase(db: Database.Database): Promise<{
  animeCount: number;
  relationshipCount: number;
}> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertRelationship = db.prepare(`
    INSERT INTO anime_relationships (source_mal_id, target_mal_id, relationship_type, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Create complex anime series with multiple relationships
  const animeData = [
    { malId: 1, title: 'Fate/stay night' },
    { malId: 2, title: 'Fate/Zero' },
    { malId: 3, title: 'Fate/stay night: UBW' },
    { malId: 4, title: 'Fate/stay night: Heaven\'s Feel' },
    { malId: 5, title: 'Fate/Apocrypha' },
    { malId: 6, title: 'Fate/Grand Order' }
  ];
  
  animeData.forEach(anime => {
    insertAnime.run(anime.malId, anime.title, 'tv', now, now);
  });
  
  // Create complex relationships
  const relationships = [
    { source: 2, target: 1, type: 'prequel' },
    { source: 1, target: 3, type: 'alternative_version' },
    { source: 1, target: 4, type: 'alternative_version' },
    { source: 1, target: 5, type: 'side_story' },
    { source: 1, target: 6, type: 'spin_off' }
  ];
  
  relationships.forEach(rel => {
    insertRelationship.run(rel.source, rel.target, rel.type, now);
  });
  
  return {
    animeCount: animeData.length,
    relationshipCount: relationships.length
  };
}

function clearDatabase(db: Database.Database): void {
  db.exec('DELETE FROM timeline_cache');
  db.exec('DELETE FROM anime_relationships');
  db.exec('DELETE FROM user_watchlist');
  db.exec('DELETE FROM anime_info');
  
  // Reset auto-increment counters
  db.exec('DELETE FROM sqlite_sequence');
}

async function verifyDataIntegrity(db: Database.Database, expectedData: any): Promise<void> {
  // Verify anime info
  const animeCount = db.prepare('SELECT COUNT(*) as count FROM anime_info').get() as any;
  expect(animeCount.count).toBe(expectedData.animeCount);
  
  // Verify watchlist
  const watchlistCount = db.prepare('SELECT COUNT(*) as count FROM user_watchlist').get() as any;
  expect(watchlistCount.count).toBe(expectedData.watchlistCount);
  
  // Verify relationships
  const relationshipCount = db.prepare('SELECT COUNT(*) as count FROM anime_relationships').get() as any;
  expect(relationshipCount.count).toBe(expectedData.relationshipCount);
  
  // Verify cache
  const cacheCount = db.prepare('SELECT COUNT(*) as count FROM timeline_cache').get() as any;
  expect(cacheCount.count).toBe(expectedData.cacheCount);
  
  // Verify foreign key integrity
  const orphanedWatchlist = db.prepare(`
    SELECT COUNT(*) as count 
    FROM user_watchlist w 
    LEFT JOIN anime_info a ON w.anime_info_id = a.id 
    WHERE a.id IS NULL
  `).get() as any;
  expect(orphanedWatchlist.count).toBe(0);
  
  const orphanedRelationships = db.prepare(`
    SELECT COUNT(*) as count 
    FROM anime_relationships r 
    LEFT JOIN anime_info a1 ON r.source_mal_id = a1.mal_id 
    LEFT JOIN anime_info a2 ON r.target_mal_id = a2.mal_id 
    WHERE a1.mal_id IS NULL OR a2.mal_id IS NULL
  `).get() as any;
  expect(orphanedRelationships.count).toBe(0);
}

async function verifyRelationshipIntegrity(db: Database.Database, expectedData: any): Promise<void> {
  // Verify all relationships exist
  const relationships = db.prepare(`
    SELECT r.*, a1.title as source_title, a2.title as target_title
    FROM anime_relationships r
    JOIN anime_info a1 ON r.source_mal_id = a1.mal_id
    JOIN anime_info a2 ON r.target_mal_id = a2.mal_id
  `).all();
  
  expect(relationships).toHaveLength(expectedData.relationshipCount);
  
  // Verify bidirectional relationship queries work
  for (const rel of relationships as any[]) {
    const sourceRels = db.prepare(`
      SELECT * FROM anime_relationships 
      WHERE source_mal_id = ? OR target_mal_id = ?
    `).all(rel.source_mal_id, rel.source_mal_id);
    
    expect(sourceRels.length).toBeGreaterThan(0);
  }
}