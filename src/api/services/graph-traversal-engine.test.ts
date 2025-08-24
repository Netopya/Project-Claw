/**
 * Unit tests for GraphTraversalEngine
 * 
 * Tests cover:
 * - Graph traversal with cycle detection
 * - Chronological sorting algorithms
 * - Relationship type processing and filtering
 * - Edge cases and circular reference handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphTraversalEngine } from './graph-traversal-engine.js';
import type { 
  AnimeInfo, 
  AnimeRelationship, 
  RelationshipType,
  AnimeType,
  GraphTraversalResult 
} from '../../types/timeline.js';

describe('GraphTraversalEngine', () => {
  let engine: GraphTraversalEngine;

  beforeEach(() => {
    engine = new GraphTraversalEngine();
  });

  describe('Relationship Type Priorities', () => {
    it('should prioritize prequels over sequels', () => {
      const prequelPriority = engine.getRelationshipTypePriorityValue('prequel');
      const sequelPriority = engine.getRelationshipTypePriorityValue('sequel');
      
      expect(prequelPriority).toBeLessThan(sequelPriority);
    });

    it('should prioritize main story over side stories', () => {
      const parentPriority = engine.getRelationshipTypePriorityValue('parent_story');
      const sideStoryPriority = engine.getRelationshipTypePriorityValue('side_story');
      
      expect(parentPriority).toBeLessThan(sideStoryPriority);
    });

    it('should handle unknown relationship types', () => {
      const unknownPriority = engine.getRelationshipTypePriorityValue('other');
      
      expect(unknownPriority).toBeGreaterThan(0);
    });
  });

  describe('Relationship Filtering', () => {
    const mockRelationships: AnimeRelationship[] = [
      {
        id: 1,
        sourceMalId: 100,
        targetMalId: 101,
        relationshipType: 'sequel',
        createdAt: new Date()
      },
      {
        id: 2,
        sourceMalId: 100,
        targetMalId: 102,
        relationshipType: 'side_story',
        createdAt: new Date()
      },
      {
        id: 3,
        sourceMalId: 100,
        targetMalId: 103,
        relationshipType: 'prequel',
        createdAt: new Date()
      }
    ];

    it('should filter relationships by single type', () => {
      const filtered = engine.filterRelationshipsByType(mockRelationships, ['sequel']);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].relationshipType).toBe('sequel');
    });

    it('should filter relationships by multiple types', () => {
      const filtered = engine.filterRelationshipsByType(mockRelationships, ['sequel', 'prequel']);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(r => r.relationshipType)).toEqual(
        expect.arrayContaining(['sequel', 'prequel'])
      );
    });

    it('should return empty array when no matches found', () => {
      const filtered = engine.filterRelationshipsByType(mockRelationships, ['adaptation']);
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Chronological Sorting', () => {
    const createMockAnime = (
      malId: number, 
      title: string, 
      premiereDate: Date | null = null,
      animeType: AnimeType = 'tv',
      numEpisodes: number | null = null
    ): AnimeInfo => ({
      id: malId,
      malId,
      title,
      titleEnglish: null,
      titleJapanese: null,
      imageUrl: null,
      rating: null,
      premiereDate,
      numEpisodes,
      episodeDuration: null,
      animeType,
      status: 'finished_airing',
      source: null,
      studios: [],
      genres: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    it('should sort by premiere date (earliest first)', async () => {
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'Later Anime', new Date('2020-01-01')),
        createMockAnime(2, 'Earlier Anime', new Date('2019-01-01')),
        createMockAnime(3, 'Middle Anime', new Date('2019-06-01'))
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted[0].title).toBe('Earlier Anime');
      expect(sorted[1].title).toBe('Middle Anime');
      expect(sorted[2].title).toBe('Later Anime');
    });

    it('should handle anime with missing premiere dates', async () => {
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'No Date Anime', null),
        createMockAnime(2, 'Dated Anime', new Date('2020-01-01'))
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      // Anime with known dates should come first
      expect(sorted[0].title).toBe('Dated Anime');
      expect(sorted[1].title).toBe('No Date Anime');
    });

    it('should prioritize TV series over other types when dates are equal', async () => {
      const sameDate = new Date('2020-01-01');
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'Movie', sameDate, 'movie'),
        createMockAnime(2, 'TV Series', sameDate, 'tv'),
        createMockAnime(3, 'OVA', sameDate, 'ova')
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted[0].title).toBe('TV Series');
      expect(sorted[1].title).toBe('Movie');
      expect(sorted[2].title).toBe('OVA');
    });

    it('should prioritize longer series when all other criteria are equal', async () => {
      const sameDate = new Date('2020-01-01');
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'Short Series', sameDate, 'tv', 12),
        createMockAnime(2, 'Long Series', sameDate, 'tv', 24),
        createMockAnime(3, 'Medium Series', sameDate, 'tv', 18)
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted[0].title).toBe('Long Series');
      expect(sorted[1].title).toBe('Medium Series');
      expect(sorted[2].title).toBe('Short Series');
    });

    it('should assign correct chronological order numbers', async () => {
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'First', new Date('2019-01-01')),
        createMockAnime(2, 'Second', new Date('2020-01-01')),
        createMockAnime(3, 'Third', new Date('2021-01-01'))
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted[0].chronologicalOrder).toBe(1);
      expect(sorted[1].chronologicalOrder).toBe(2);
      expect(sorted[2].chronologicalOrder).toBe(3);
    });

    it('should identify main timeline entries correctly', async () => {
      const animeList: AnimeInfo[] = [
        createMockAnime(1, 'TV Series', new Date('2020-01-01'), 'tv'),
        createMockAnime(2, 'Movie', new Date('2020-01-01'), 'movie'),
        createMockAnime(3, 'OVA', new Date('2020-01-01'), 'ova'),
        createMockAnime(4, 'Special', new Date('2020-01-01'), 'special')
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted.find(s => s.title === 'TV Series')?.isMainEntry).toBe(true);
      expect(sorted.find(s => s.title === 'Movie')?.isMainEntry).toBe(true);
      expect(sorted.find(s => s.title === 'OVA')?.isMainEntry).toBe(false);
      expect(sorted.find(s => s.title === 'Special')?.isMainEntry).toBe(false);
    });
  });

  describe('Graph Traversal with Mocked Data', () => {
    beforeEach(() => {
      // Mock the private methods for testing
      const mockAnimeData = new Map<number, AnimeInfo>([
        [1, {
          id: 1, malId: 1, title: 'Root Anime', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2020-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }],
        [2, {
          id: 2, malId: 2, title: 'Sequel Anime', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2021-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }],
        [3, {
          id: 3, malId: 3, title: 'Prequel Anime', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2019-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }]
      ]);

      const mockRelationships = new Map<number, AnimeRelationship[]>([
        [1, [
          { id: 1, sourceMalId: 1, targetMalId: 2, relationshipType: 'sequel', createdAt: new Date() },
          { id: 2, sourceMalId: 1, targetMalId: 3, relationshipType: 'prequel', createdAt: new Date() }
        ]],
        [2, []],
        [3, []]
      ]);

      // Mock the private methods
      vi.spyOn(engine as any, 'getAnimeInfo').mockImplementation(async (malId: number) => {
        return mockAnimeData.get(malId) || null;
      });

      vi.spyOn(engine as any, 'getRelationships').mockImplementation(async (malId: number) => {
        return mockRelationships.get(malId) || [];
      });
    });

    it('should find all related anime through graph traversal', async () => {
      const related = await engine.findAllRelated(1);

      expect(related).toHaveLength(3);
      expect(related.map(a => a.malId).sort()).toEqual([1, 2, 3]);
    });

    it('should generate complete timeline', async () => {
      const timeline = await engine.generateTimeline(1);

      expect(timeline.rootMalId).toBe(1);
      expect(timeline.entries).toHaveLength(3);
      expect(timeline.totalEntries).toBe(3);
      expect(timeline.mainTimelineCount).toBe(3); // All are TV series
      expect(timeline.lastUpdated).toBeInstanceOf(Date);
    });

    it('should sort timeline entries chronologically', async () => {
      const timeline = await engine.generateTimeline(1);

      // Should be sorted by premiere date: Prequel (2019) -> Root (2020) -> Sequel (2021)
      expect(timeline.entries[0].title).toBe('Prequel Anime');
      expect(timeline.entries[1].title).toBe('Root Anime');
      expect(timeline.entries[2].title).toBe('Sequel Anime');
    });
  });

  describe('Cycle Detection', () => {
    beforeEach(() => {
      // Mock data with circular relationships: 1 -> 2 -> 3 -> 1
      const mockAnimeData = new Map<number, AnimeInfo>([
        [1, {
          id: 1, malId: 1, title: 'Anime 1', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2020-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }],
        [2, {
          id: 2, malId: 2, title: 'Anime 2', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2021-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }],
        [3, {
          id: 3, malId: 3, title: 'Anime 3', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: new Date('2022-01-01'),
          numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }]
      ]);

      const mockRelationships = new Map<number, AnimeRelationship[]>([
        [1, [{ id: 1, sourceMalId: 1, targetMalId: 2, relationshipType: 'sequel', createdAt: new Date() }]],
        [2, [{ id: 2, sourceMalId: 2, targetMalId: 3, relationshipType: 'sequel', createdAt: new Date() }]],
        [3, [{ id: 3, sourceMalId: 3, targetMalId: 1, relationshipType: 'sequel', createdAt: new Date() }]]
      ]);

      vi.spyOn(engine as any, 'getAnimeInfo').mockImplementation(async (malId: number) => {
        return mockAnimeData.get(malId) || null;
      });

      vi.spyOn(engine as any, 'getRelationships').mockImplementation(async (malId: number) => {
        return mockRelationships.get(malId) || [];
      });
    });

    it('should detect circular references without infinite loops', async () => {
      const traversalResult = await engine.performGraphTraversal(1);

      expect(traversalResult.nodes.size).toBe(3);
      expect(traversalResult.visitedOrder).toEqual([1, 2, 3]);
      expect(traversalResult.cyclesDetected.length).toBeGreaterThan(0);
    });

    it('should still find all anime despite cycles', async () => {
      const related = await engine.findAllRelated(1);

      expect(related).toHaveLength(3);
      expect(related.map(a => a.malId).sort()).toEqual([1, 2, 3]);
    });

    it('should detect cycles correctly', async () => {
      const traversalResult = await engine.performGraphTraversal(1);
      const cycles = engine.detectCycles(traversalResult);

      expect(cycles.length).toBeGreaterThan(0);
      // Should detect the cycle 1 -> 2 -> 3 -> 1
      expect(cycles[0]).toContain(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle anime with no relationships', async () => {
      vi.spyOn(engine as any, 'getAnimeInfo').mockImplementation(async (malId: number) => {
        if (malId === 1) {
          return {
            id: 1, malId: 1, title: 'Standalone Anime', titleEnglish: null, titleJapanese: null,
            imageUrl: null, rating: null, premiereDate: new Date('2020-01-01'),
            numEpisodes: 12, episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
            source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
          };
        }
        return null;
      });

      vi.spyOn(engine as any, 'getRelationships').mockImplementation(async () => []);

      const related = await engine.findAllRelated(1);

      expect(related).toHaveLength(1);
      expect(related[0].title).toBe('Standalone Anime');
    });

    it('should handle missing anime data gracefully', async () => {
      vi.spyOn(engine as any, 'getAnimeInfo').mockImplementation(async () => null);
      vi.spyOn(engine as any, 'getRelationships').mockImplementation(async () => []);

      const related = await engine.findAllRelated(999);

      expect(related).toHaveLength(0);
    });

    it('should handle empty anime list in chronological sort', async () => {
      const sorted = await engine.chronologicalSort([], 1);

      expect(sorted).toHaveLength(0);
    });

    it('should handle anime with same premiere date and type', async () => {
      const sameDate = new Date('2020-01-01');
      const animeList: AnimeInfo[] = [
        {
          id: 1, malId: 1, title: 'Anime A', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: sameDate, numEpisodes: 12,
          episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        },
        {
          id: 2, malId: 2, title: 'Anime B', titleEnglish: null, titleJapanese: null,
          imageUrl: null, rating: null, premiereDate: sameDate, numEpisodes: 12,
          episodeDuration: 24, animeType: 'tv', status: 'finished_airing',
          source: null, studios: [], genres: [], createdAt: new Date(), updatedAt: new Date()
        }
      ];

      const sorted = await engine.chronologicalSort(animeList, 1);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].chronologicalOrder).toBe(1);
      expect(sorted[1].chronologicalOrder).toBe(2);
    });
  });
});