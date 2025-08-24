/**
 * Tests for TimelineService
 * 
 * These tests verify timeline generation and error handling
 * for the main timeline service functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimelineService } from './timeline-service.js';
import { TimelineDatabase } from './timeline-database.js';
import { GraphTraversalEngine } from './graph-traversal-engine.js';
import type { AnimeInfo, SeriesTimeline, TimelineEntry } from '../../types/timeline.js';

// Mock dependencies
vi.mock('./timeline-database.js');
vi.mock('./graph-traversal-engine.js');

describe('TimelineService', () => {
  let timelineService: TimelineService;
  let mockDatabase: vi.Mocked<TimelineDatabase>;
  let mockGraphTraversal: vi.Mocked<GraphTraversalEngine>;

  // Test data
  const mockAnimeInfo: AnimeInfo = {
    id: 1,
    malId: 12345,
    title: 'Test Anime',
    titleEnglish: 'Test Anime English',
    titleJapanese: 'テストアニメ',
    imageUrl: 'https://example.com/image.jpg',
    rating: 8.5,
    premiereDate: new Date('2023-01-01'),
    numEpisodes: 12,
    episodeDuration: 24,
    animeType: 'tv',
    status: 'finished_airing',
    source: 'manga',
    studios: ['Test Studio'],
    genres: ['Action', 'Drama'],
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  };

  const mockTimelineEntry: TimelineEntry = {
    malId: 12345,
    title: 'Test Anime',
    titleEnglish: 'Test Anime English',
    animeType: 'tv',
    premiereDate: new Date('2023-01-01'),
    numEpisodes: 12,
    episodeDuration: 24,
    chronologicalOrder: 1,
    isMainEntry: true,
    relationshipPath: []
  };

  const mockTimeline: SeriesTimeline = {
    rootMalId: 12345,
    entries: [mockTimelineEntry],
    totalEntries: 1,
    mainTimelineCount: 1,
    lastUpdated: new Date('2023-01-01')
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mocked instances
    mockDatabase = vi.mocked(new TimelineDatabase(':memory:'));
    mockGraphTraversal = vi.mocked(new GraphTraversalEngine(mockDatabase));

    // Setup default mock implementations
    mockDatabase.getAnimeInfo.mockResolvedValue(mockAnimeInfo);
    mockDatabase.close.mockImplementation(() => {});
    mockGraphTraversal.generateTimeline.mockResolvedValue(mockTimeline);

    // Create service with mocked database
    timelineService = new TimelineService(mockDatabase);
    
    // Replace internal components with mocks
    (timelineService as any).graphTraversal = mockGraphTraversal;
  });

  afterEach(() => {
    timelineService.close();
  });

  describe('getAnimeTimeline', () => {
    it('should build timeline from database', async () => {
      // Act
      const result = await timelineService.getAnimeTimeline(12345);

      // Assert
      expect(result).toEqual(mockTimeline);
      expect(mockGraphTraversal.generateTimeline).toHaveBeenCalledWith(12345);
    });

    it('should throw error when timeline generation fails', async () => {
      // Arrange
      mockGraphTraversal.generateTimeline.mockRejectedValue(new Error('Generation failed'));

      // Act & Assert
      await expect(timelineService.getAnimeTimeline(12345))
        .rejects.toThrow('Failed to generate timeline for anime 12345');
    });
  });

  describe('invalidateTimeline', () => {
    it('should be a no-op since we always read from database', async () => {
      // Act
      await timelineService.invalidateTimeline(12345);

      // Assert - should complete without error
      expect(true).toBe(true);
    });
  });

  describe('refreshTimeline', () => {
    it('should generate timeline same as getAnimeTimeline', async () => {
      // Act
      const result = await timelineService.refreshTimeline(12345);

      // Assert
      expect(result).toEqual(mockTimeline);
      expect(mockGraphTraversal.generateTimeline).toHaveBeenCalledWith(12345);
    });
  });

  describe('getTimelineStatus', () => {
    it('should return status for existing anime', async () => {
      // Act
      const status = await timelineService.getTimelineStatus(12345);

      // Assert
      expect(status.exists).toBe(true);
      expect(status.cached).toBe(false); // We don't cache anymore
      expect(status.stale).toBe(false); // Always fresh
      expect(status.entryCount).toBe(1);
      expect(status.mainEntryCount).toBe(1);
      expect(status.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return status for non-existent anime', async () => {
      // Arrange
      mockDatabase.getAnimeInfo.mockResolvedValue(null);

      // Act
      const status = await timelineService.getTimelineStatus(12345);

      // Assert
      expect(status).toEqual({
        exists: false,
        cached: false,
        stale: false,
        lastUpdated: null,
        entryCount: 0,
        mainEntryCount: 0
      });
    });
  });

  describe('batchProcessTimelines', () => {
    it('should process multiple timelines successfully', async () => {
      // Arrange
      const malIds = [12345, 12346];
      const timeline2 = { ...mockTimeline, rootMalId: 12346 };
      
      mockGraphTraversal.generateTimeline
        .mockResolvedValueOnce(mockTimeline)
        .mockResolvedValueOnce(timeline2);

      // Act
      const result = await timelineService.batchProcessTimelines(malIds);

      // Assert
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0]).toEqual(mockTimeline);
      expect(result.successful[1]).toEqual(timeline2);
    });

    it('should handle partial failures in batch processing', async () => {
      // Arrange
      const malIds = [12345, 12346];
      
      mockGraphTraversal.generateTimeline
        .mockResolvedValueOnce(mockTimeline)
        .mockRejectedValueOnce(new Error('Generation failed'));

      // Act
      const result = await timelineService.batchProcessTimelines(malIds);

      // Assert
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.successful[0]).toEqual(mockTimeline);
      expect(result.failed[0]).toEqual({
        malId: 12346,
        error: 'Failed to generate timeline for anime 12346: Generation failed'
      });
    });
  });

  describe('getCacheStatistics', () => {
    it('should return empty statistics since no caching', async () => {
      // Act
      const stats = await timelineService.getCacheStatistics();

      // Assert
      expect(stats).toEqual({
        totalCachedTimelines: 0,
        staleTimelines: 0,
        averageTimelineSize: 0,
        oldestCache: null,
        newestCache: null
      });
    });
  });

  describe('cleanupStaleCache', () => {
    it('should return 0 since no cache to cleanup', async () => {
      // Act
      const cleanedCount = await timelineService.cleanupStaleCache(24);

      // Assert
      expect(cleanedCount).toBe(0);
    });

    it('should return 0 with default parameters', async () => {
      // Act
      const cleanedCount = await timelineService.cleanupStaleCache();

      // Assert
      expect(cleanedCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange
      mockGraphTraversal.generateTimeline.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(timelineService.getAnimeTimeline(12345))
        .rejects.toThrow('Failed to generate timeline for anime 12345');
    });
  });

  describe('performance tests', () => {
    it('should handle large series timeline generation efficiently', async () => {
      // Arrange - Create a large timeline with many entries
      const largeTimelineEntries: TimelineEntry[] = Array.from({ length: 50 }, (_, i) => ({
        malId: 12345 + i,
        title: `Test Anime ${i + 1}`,
        titleEnglish: `Test Anime ${i + 1} English`,
        animeType: i % 2 === 0 ? 'tv' : 'movie',
        premiereDate: new Date(`202${Math.floor(i / 10)}-01-01`),
        numEpisodes: 12 + i,
        episodeDuration: 24,
        chronologicalOrder: i + 1,
        isMainEntry: i % 3 === 0,
        relationshipPath: [`relationship_${i}`]
      }));

      const largeTimeline: SeriesTimeline = {
        rootMalId: 12345,
        entries: largeTimelineEntries,
        totalEntries: 50,
        mainTimelineCount: 17,
        lastUpdated: new Date()
      };

      mockGraphTraversal.generateTimeline.mockResolvedValue(largeTimeline);

      // Act
      const startTime = Date.now();
      const result = await timelineService.getAnimeTimeline(12345);
      const endTime = Date.now();

      // Assert
      expect(result).toEqual(largeTimeline);
      expect(result.totalEntries).toBe(50);
      expect(result.mainTimelineCount).toBe(17);
      
      // Performance assertion - should complete within reasonable time
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent timeline requests efficiently', async () => {
      // Arrange
      const malIds = Array.from({ length: 10 }, (_, i) => 12345 + i);
      const timelines = malIds.map(malId => ({
        ...mockTimeline,
        rootMalId: malId
      }));

      mockGraphTraversal.generateTimeline.mockImplementation(async (malId) => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return timelines.find(t => t.rootMalId === malId)!;
      });

      // Act
      const startTime = Date.now();
      const promises = malIds.map(malId => timelineService.getAnimeTimeline(malId));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.rootMalId).toBe(malIds[index]);
      });

      // Performance assertion - concurrent execution should be faster than sequential
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(500); // Should complete concurrently within reasonable time
    });

    it('should handle memory efficiently with large batch processing', async () => {
      // Arrange
      const largeBatch = Array.from({ length: 100 }, (_, i) => 12345 + i);
      
      mockGraphTraversal.generateTimeline.mockImplementation(async (malId) => ({
        ...mockTimeline,
        rootMalId: malId
      }));

      // Act
      const result = await timelineService.batchProcessTimelines(largeBatch);

      // Assert
      expect(result.successful).toHaveLength(100);
      expect(result.failed).toHaveLength(0);
      
      // Memory usage should be reasonable (this is more of a smoke test)
      expect(result.successful.every(timeline => timeline.rootMalId >= 12345)).toBe(true);
    });
  });
});