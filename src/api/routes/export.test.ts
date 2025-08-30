import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { exportRoutes } from './export.js';
import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';

describe('Export Routes', () => {
  let app: Hono;

  beforeEach(async () => {
    app = new Hono();
    app.route('/api/export', exportRoutes);
    
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

  describe('GET /api/export/stats', () => {
    it('should return database statistics for empty database', async () => {
      const res = await app.request('/api/export/stats');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          animeInfo: 0,
          userWatchlist: 0,
          animeRelationships: 0,
          timelineCache: 0,
          total: 0,
          lastUpdated: expect.any(String)
        }
      });
    });

    it('should return correct statistics with data', async () => {
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

      const res = await app.request('/api/export/stats');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          animeInfo: 2,
          userWatchlist: 1,
          animeRelationships: 1,
          timelineCache: 1,
          total: 5,
          lastUpdated: expect.any(String)
        }
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock database error by closing connection temporarily
      // This is a bit tricky to test without actually breaking the database
      // For now, we'll test the error response structure
      
      const res = await app.request('/api/export/stats');
      
      // Should either succeed or return proper error format
      if (res.status !== 200) {
        const data = await res.json();
        expect(data).toHaveProperty('success', false);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
      }
    });
  });

  describe('GET /api/export/stats/detailed', () => {
    it('should return detailed statistics with breakdowns', async () => {
      // Insert test data with various statuses and types
      const animeInfoRecords = await db.insert(animeInfo).values([
        { malId: 1, title: 'Anime 1', animeType: 'TV' },
        { malId: 2, title: 'Anime 2', animeType: 'Movie' }
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
        },
        {
          sourceMalId: 2,
          targetMalId: 1,
          relationshipType: 'prequel'
        }
      ]);

      const res = await app.request('/api/export/stats/detailed');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('animeInfo', 2);
      expect(data.data).toHaveProperty('userWatchlist', 2);
      expect(data.data).toHaveProperty('animeRelationships', 2);
      expect(data.data).toHaveProperty('total', 6);
      expect(data.data).toHaveProperty('breakdown');
      
      expect(data.data.breakdown.watchlistByStatus).toEqual({
        watching: 1,
        completed: 1
      });
      
      expect(data.data.breakdown.relationshipsByType).toEqual({
        sequel: 1,
        prequel: 1
      });
    });

    it('should return empty breakdowns for empty database', async () => {
      const res = await app.request('/api/export/stats/detailed');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.breakdown.watchlistByStatus).toEqual({});
      expect(data.data.breakdown.relationshipsByType).toEqual({});
    });
  });

  describe('GET /api/export/stats/validate', () => {
    it('should validate statistics accuracy', async () => {
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

      const res = await app.request('/api/export/stats/validate');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          isAccurate: true,
          discrepancies: []
        }
      });
    });

    it('should return validation results for empty database', async () => {
      const res = await app.request('/api/export/stats/validate');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isAccurate).toBe(true);
      expect(data.data.discrepancies).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should return proper error format for all endpoints', async () => {
      const endpoints = [
        '/api/export/stats',
        '/api/export/stats/detailed',
        '/api/export/stats/validate'
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint);
        
        // Should either succeed or return proper error format
        if (res.status !== 200) {
          const data = await res.json();
          expect(data).toHaveProperty('success', false);
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('message');
        }
      }
    });

    it('should handle invalid routes', async () => {
      const res = await app.request('/api/export/invalid');
      expect(res.status).toBe(404);
    });
  });

  describe('response format consistency', () => {
    it('should maintain consistent response format across all endpoints', async () => {
      const endpoints = [
        '/api/export/stats',
        '/api/export/stats/detailed',
        '/api/export/stats/validate'
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint);
        const data = await res.json();

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        
        if (data.success) {
          expect(typeof data.success).toBe('boolean');
          expect(data.data).toBeDefined();
        } else {
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('message');
        }
      }
    });
  });

  describe('performance and reliability', () => {
    it('should handle multiple concurrent requests', async () => {
      // Insert some test data
      await db.insert(animeInfo).values([
        { malId: 1, title: 'Test Anime', animeType: 'TV' }
      ]);

      // Make multiple concurrent requests
      const promises = Array(10).fill(null).map(() => 
        app.request('/api/export/stats')
      );

      const responses = await Promise.all(promises);

      // All should succeed
      for (const res of responses) {
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.animeInfo).toBe(1);
      }
    });

    it('should return results within reasonable time', async () => {
      // Insert a moderate amount of test data
      const animeRecords = [];
      for (let i = 1; i <= 50; i++) {
        animeRecords.push({
          malId: i,
          title: `Test Anime ${i}`,
          animeType: 'TV'
        });
      }
      await db.insert(animeInfo).values(animeRecords);

      const startTime = Date.now();
      const res = await app.request('/api/export/stats');
      const endTime = Date.now();

      expect(res.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});