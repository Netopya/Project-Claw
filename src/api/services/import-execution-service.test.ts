import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImportExecutionService } from './import-execution-service.js';
import { db, getSQLiteConnection, initializeDatabase } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { ExportData, ImportOptions } from '../../types/export-import.js';

describe('ImportExecutionService', () => {
  let service: ImportExecutionService;
  let sqlite: any;

  beforeEach(async () => {
    service = new ImportExecutionService();
    sqlite = getSQLiteConnection();
    
    // Initialize clean database for each test
    await initializeDatabase();
  });

  afterEach(() => {
    // Clean up after each test
    try {
      sqlite.prepare('DELETE FROM timeline_cache').run();
      sqlite.prepare('DELETE FROM anime_relationships').run();
      sqlite.prepare('DELETE FROM user_watchlist').run();
      sqlite.prepare('DELETE FROM anime_info').run();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('executeImport', () => {
    it('should successfully import data in replace mode', async () => {
      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Test Anime 1',
              titleEnglish: 'Test Anime 1 EN',
              titleJapanese: null,
              imageUrl: 'https://example.com/image1.jpg',
              rating: 8.5,
              premiereDate: '2024-01-01',
              numEpisodes: 12,
              episodeDuration: 24,
              animeType: 'TV',
              status: 'finished_airing',
              source: 'manga',
              studios: '["Studio A"]',
              genres: '["Action", "Drama"]',
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
              userRating: 9.0,
              notes: 'Great anime!',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            }
          ],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(1);
      expect(result.recordsProcessed.userWatchlist).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify data was inserted
      const animeRecords = await db.select().from(animeInfo);
      expect(animeRecords).toHaveLength(1);
      expect(animeRecords[0].malId).toBe(1001);
      expect(animeRecords[0].title).toBe('Test Anime 1');

      const watchlistRecords = await db.select().from(userWatchlist);
      expect(watchlistRecords).toHaveLength(1);
      expect(watchlistRecords[0].priority).toBe(1);
    });

    it('should successfully import data in merge mode with skip duplicates', async () => {
      // First, insert some existing data
      await db.insert(animeInfo).values({
        malId: 1001,
        title: 'Existing Anime',
        animeType: 'TV'
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001, // Duplicate
              title: 'Test Anime 1',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            },
            {
              id: 2,
              malId: 1002, // New
              title: 'Test Anime 2',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(1); // Only new record
      expect(result.warnings.some(w => w.code === 'DUPLICATE_SKIPPED')).toBe(true);

      // Verify we have 2 records total (1 existing + 1 new)
      const animeRecords = await db.select().from(animeInfo);
      expect(animeRecords).toHaveLength(2);
    });

    it('should successfully import data in merge mode with update duplicates', async () => {
      // First, insert some existing data
      await db.insert(animeInfo).values({
        malId: 1001,
        title: 'Existing Anime',
        animeType: 'TV'
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Updated Anime Title',
              titleEnglish: 'Updated English Title',
              titleJapanese: null,
              imageUrl: null,
              rating: 8.0,
              premiereDate: null,
              numEpisodes: 24,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(1);
      expect(result.warnings.some(w => w.code === 'DUPLICATE_UPDATED')).toBe(true);

      // Verify data was updated
      const animeRecords = await db.select().from(animeInfo);
      expect(animeRecords).toHaveLength(1);
      expect(animeRecords[0].title).toBe('Updated Anime Title');
      expect(animeRecords[0].titleEnglish).toBe('Updated English Title');
      expect(animeRecords[0].rating).toBe(8.0);
    });

    it('should handle foreign key violations in relationships', async () => {
      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Test Anime 1',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [],
          animeRelationships: [
            {
              id: 1,
              sourceMalId: 1001,
              targetMalId: 9999, // Non-existent
              relationshipType: 'sequel',
              createdAt: '2024-01-01T00:00:00.000Z'
            }
          ],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true); // Should succeed but skip invalid relationships
      expect(result.recordsProcessed.animeInfo).toBe(1);
      expect(result.recordsProcessed.animeRelationships).toBe(0);
      expect(result.errors.some(e => e.code === 'FOREIGN_KEY_VIOLATION')).toBe(true);
    });

    it('should rollback on critical errors', async () => {
      // Create a mock that will cause an error during anime info insertion
      const originalPrepare = sqlite.prepare;
      let callCount = 0;
      
      sqlite.prepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO anime_info') && callCount === 0) {
          callCount++;
          throw new Error('Simulated database error');
        }
        return originalPrepare.call(sqlite, sql);
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Test Anime 1',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === 'TRANSACTION_ROLLBACK')).toBe(true);

      // Verify no data was inserted due to rollback
      const animeRecords = await db.select().from(animeInfo);
      expect(animeRecords).toHaveLength(0);

      // Restore original method
      sqlite.prepare = originalPrepare;
    });

    it('should clear timeline cache when requested', async () => {
      // First, insert some cache data
      await db.insert(animeInfo).values({
        malId: 1001,
        title: 'Test Anime',
        animeType: 'TV'
      });

      await db.insert(timelineCache).values({
        rootMalId: 1001,
        timelineData: '{"test": "data"}',
        cacheVersion: 1
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const options: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: true
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.code === 'CACHE_CLEARED')).toBe(true);

      // Verify cache was cleared
      const cacheRecords = await db.select().from(timelineCache);
      expect(cacheRecords).toHaveLength(0);
    });

    it('should import timeline cache with JSON validation', async () => {
      // First, insert anime data
      await db.insert(animeInfo).values({
        malId: 1001,
        title: 'Test Anime',
        animeType: 'TV'
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: [
            {
              id: 1,
              rootMalId: 1001,
              timelineData: '{"nodes": [], "edges": []}',
              cacheVersion: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
              id: 2,
              rootMalId: 1002,
              timelineData: 'invalid json',
              cacheVersion: 1,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            }
          ]
        }
      };

      const options: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const result = await service.executeImport(exportData, options);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.timelineCache).toBe(1); // Only valid JSON imported
      expect(result.errors.some(e => e.code === 'INVALID_JSON_DATA')).toBe(true);

      // Verify only valid cache was inserted
      const cacheRecords = await db.select().from(timelineCache);
      expect(cacheRecords).toHaveLength(1);
      expect(cacheRecords[0].rootMalId).toBe(1001);
    });
  });

  describe('validateImportData', () => {
    it('should validate import data structure', () => {
      const validData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Test Anime',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [
            {
              id: 1,
              animeInfoId: 1,
              priority: 1,
              watchStatus: 'completed',
              userRating: null,
              notes: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const errors = service.validateImportData(validData);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing data section', () => {
      const invalidData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        }
        // Missing data section
      } as ExportData;

      const errors = service.validateImportData(invalidData);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe('MISSING_DATA_SECTION');
    });

    it('should detect foreign key violations', () => {
      const invalidData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test-checksum',
          application: { name: 'test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            {
              id: 1,
              malId: 1001,
              title: 'Test Anime',
              titleEnglish: null,
              titleJapanese: null,
              imageUrl: null,
              rating: null,
              premiereDate: null,
              numEpisodes: null,
              episodeDuration: null,
              animeType: 'TV',
              status: null,
              source: null,
              studios: null,
              genres: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          userWatchlist: [
            {
              id: 1,
              animeInfoId: 999, // Non-existent
              priority: 1,
              watchStatus: 'completed',
              userRating: null,
              notes: null,
              createdAt: null,
              updatedAt: null
            }
          ],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const errors = service.validateImportData(invalidData);
      expect(errors.some(e => e.code === 'INVALID_FOREIGN_KEY')).toBe(true);
    });
  });

  describe('createBackup', () => {
    it('should create a backup file', async () => {
      // Insert some test data first
      await db.insert(animeInfo).values({
        malId: 1001,
        title: 'Test Anime',
        animeType: 'TV'
      });

      const backupPath = await service.createBackup();
      
      expect(backupPath).toMatch(/backup-.*\.db$/);
      expect(backupPath).toContain('./data/');
    });
  });
});