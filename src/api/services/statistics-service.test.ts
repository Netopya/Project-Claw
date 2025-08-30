import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatisticsService } from './statistics-service.js';
import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

describe('StatisticsService', () => {
  let statisticsService: StatisticsService;

  beforeEach(async () => {
    statisticsService = new StatisticsService();
    
    // Clean up all tables before each test
    await db.delete(timelineCache);
    await db.delete(animeRelationships);
    await db.delete(userWatchlist);
    await db.delete(animeInfo);
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(timelineCache);
    await db.delete(animeRelationships);
    await db.delete(userWatchlist);
    await db.delete(animeInfo);
  });

  describe('getDatabaseStatistics', () => {
    it('should return zero counts for empty database', async () => {
      const stats = await statisticsService.getDatabaseStatistics();

      expect(stats).toEqual({
        animeInfo: 0,
        userWatchlist: 0,
        animeRelationships: 0,
        timelineCache: 0,
        total: 0,
        lastUpdated: expect.any(String)
      });

      // Verify lastUpdated is a valid ISO string
      expect(new Date(stats.lastUpdated).toISOString()).toBe(stats.lastUpdated);
    });

    it('should return correct counts with sample data', async () => {
      // Insert test data
      const animeInfoRecords = await db.insert(animeInfo).values([
        {
          malId: 1,
          title: 'Test Anime 1',
          animeType: 'TV'
        },
        {
          malId: 2,
          title: 'Test Anime 2',
          animeType: 'Movie'
        }
      ]).returning();

      await db.insert(userWatchlist).values([
        {
          animeInfoId: animeInfoRecords[0].id,
          priority: 1,
          watchStatus: 'watching'
        },
        {
          animeInfoId: animeInfoRecords[1].id,
          priority: 2,
          watchStatus: 'completed'
        }
      ]);

      await db.insert(animeRelationships).values([
        {
          sourceMalId: 1,
          targetMalId: 2,
          relationshipType: 'sequel'
        }
      ]);

      await db.insert(timelineCache).values([
        {
          rootMalId: 1,
          timelineData: '{"test": "data"}',
          cacheVersion: 1
        }
      ]);

      const stats = await statisticsService.getDatabaseStatistics();

      expect(stats).toEqual({
        animeInfo: 2,
        userWatchlist: 2,
        animeRelationships: 1,
        timelineCache: 1,
        total: 6,
        lastUpdated: expect.any(String)
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock a database error by using an invalid table name
      const originalGetTableCount = (statisticsService as any).getTableCount;
      (statisticsService as any).getTableCount = async (tableName: string) => {
        if (tableName === 'anime_info') {
          throw new Error('Database connection failed');
        }
        return originalGetTableCount.call(statisticsService, tableName);
      };

      await expect(statisticsService.getDatabaseStatistics()).rejects.toThrow(
        'Failed to retrieve database statistics'
      );
    });
  });

  describe('getDetailedStatistics', () => {
    it('should return detailed statistics with breakdowns', async () => {
      // Insert test data with various statuses and relationship types
      const animeInfoRecords = await db.insert(animeInfo).values([
        { malId: 1, title: 'Anime 1', animeType: 'TV' },
        { malId: 2, title: 'Anime 2', animeType: 'Movie' },
        { malId: 3, title: 'Anime 3', animeType: 'OVA' }
      ]).returning();

      await db.insert(userWatchlist).values([
        {
          animeInfoId: animeInfoRecords[0].id,
          priority: 1,
          watchStatus: 'watching'
        },
        {
          animeInfoId: animeInfoRecords[1].id,
          priority: 2,
          watchStatus: 'completed'
        },
        {
          animeInfoId: animeInfoRecords[2].id,
          priority: 3,
          watchStatus: 'watching'
        }
      ]);

      await db.insert(animeRelationships).values([
        {
          sourceMalId: 1,
          targetMalId: 2,
          relationshipType: 'sequel'
        },
        {
          sourceMalId: 2,
          targetMalId: 3,
          relationshipType: 'prequel'
        },
        {
          sourceMalId: 1,
          targetMalId: 3,
          relationshipType: 'sequel'
        }
      ]);

      const detailedStats = await statisticsService.getDetailedStatistics();

      expect(detailedStats.animeInfo).toBe(3);
      expect(detailedStats.userWatchlist).toBe(3);
      expect(detailedStats.animeRelationships).toBe(3);
      expect(detailedStats.total).toBe(9);

      expect(detailedStats.breakdown.watchlistByStatus).toEqual({
        watching: 2,
        completed: 1
      });

      expect(detailedStats.breakdown.relationshipsByType).toEqual({
        sequel: 2,
        prequel: 1
      });
    });

    it('should handle empty breakdowns correctly', async () => {
      const detailedStats = await statisticsService.getDetailedStatistics();

      expect(detailedStats.breakdown.watchlistByStatus).toEqual({});
      expect(detailedStats.breakdown.relationshipsByType).toEqual({});
    });
  });

  describe('validateStatisticsAccuracy', () => {
    it('should validate accurate statistics', async () => {
      // Insert test data
      await db.insert(animeInfo).values([
        { malId: 1, title: 'Test Anime', animeType: 'TV' }
      ]);

      const validation = await statisticsService.validateStatisticsAccuracy();

      expect(validation.isAccurate).toBe(true);
      expect(validation.discrepancies).toEqual([]);
    });

    it('should detect discrepancies if they exist', async () => {
      // Insert test data
      const animeInfoRecords = await db.insert(animeInfo).values([
        { malId: 1, title: 'Test Anime', animeType: 'TV' }
      ]).returning();

      await db.insert(userWatchlist).values([
        {
          animeInfoId: animeInfoRecords[0].id,
          priority: 1,
          watchStatus: 'watching'
        }
      ]);

      // Mock the raw SQL count to return incorrect values
      const originalGetTableCount = (statisticsService as any).getTableCount;
      (statisticsService as any).getTableCount = async (tableName: string) => {
        if (tableName === 'user_watchlist') {
          return 999; // Incorrect count
        }
        return originalGetTableCount.call(statisticsService, tableName);
      };

      const validation = await statisticsService.validateStatisticsAccuracy();

      expect(validation.isAccurate).toBe(false);
      expect(validation.discrepancies).toContain('user_watchlist: raw=999, drizzle=1');
    });

    it('should handle validation errors gracefully', async () => {
      // Mock database error during validation
      const originalGetTableCount = (statisticsService as any).getTableCount;
      (statisticsService as any).getTableCount = async () => {
        throw new Error('Database error during validation');
      };

      await expect(statisticsService.validateStatisticsAccuracy()).rejects.toThrow(
        'Failed to validate statistics accuracy'
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle large numbers correctly', async () => {
      // Insert a reasonable number of records to test counting
      const animeRecords = [];
      for (let i = 1; i <= 100; i++) {
        animeRecords.push({
          malId: i,
          title: `Test Anime ${i}`,
          animeType: 'TV'
        });
      }

      await db.insert(animeInfo).values(animeRecords);

      const stats = await statisticsService.getDatabaseStatistics();
      expect(stats.animeInfo).toBe(100);
      expect(stats.total).toBe(100);
    });

    it('should maintain consistency across multiple calls', async () => {
      // Insert test data
      await db.insert(animeInfo).values([
        { malId: 1, title: 'Test Anime', animeType: 'TV' }
      ]);

      const stats1 = await statisticsService.getDatabaseStatistics();
      const stats2 = await statisticsService.getDatabaseStatistics();

      // Should have same counts (excluding timestamp)
      expect(stats1.animeInfo).toBe(stats2.animeInfo);
      expect(stats1.userWatchlist).toBe(stats2.userWatchlist);
      expect(stats1.animeRelationships).toBe(stats2.animeRelationships);
      expect(stats1.timelineCache).toBe(stats2.timelineCache);
      expect(stats1.total).toBe(stats2.total);
    });

    it('should handle concurrent access correctly', async () => {
      // Insert test data
      await db.insert(animeInfo).values([
        { malId: 1, title: 'Test Anime 1', animeType: 'TV' },
        { malId: 2, title: 'Test Anime 2', animeType: 'Movie' }
      ]);

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        statisticsService.getDatabaseStatistics()
      );

      const results = await Promise.all(promises);

      // All results should be identical (excluding timestamps)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].animeInfo).toBe(results[0].animeInfo);
        expect(results[i].userWatchlist).toBe(results[0].userWatchlist);
        expect(results[i].animeRelationships).toBe(results[0].animeRelationships);
        expect(results[i].timelineCache).toBe(results[0].timelineCache);
        expect(results[i].total).toBe(results[0].total);
      }
    });
  });
});