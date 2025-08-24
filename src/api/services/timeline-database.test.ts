/**
 * Integration tests for TimelineDatabase
 * 
 * Tests the database layer for timeline operations including:
 * - Anime info storage and retrieval
 * - Relationship storage and retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TimelineDatabase } from './timeline-database.js';
import { setupTestDatabase } from '../../test-utils/database-setup.js';
import type { AnimeInfo, AnimeRelationship } from '../../types/timeline.js';
import Database from 'better-sqlite3';

describe('TimelineDatabase Integration Tests', () => {
  let database: TimelineDatabase;
  let db: Database.Database;

  beforeEach(async () => {
    // Create in-memory database with proper schema
    db = setupTestDatabase();
    database = new TimelineDatabase(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Anime Info Operations', () => {
    const mockAnimeInfo: Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'> = {
      malId: 1,
      title: 'Test Anime',
      titleEnglish: 'Test Anime English',
      titleJapanese: 'テストアニメ',
      imageUrl: 'https://example.com/image.jpg',
      rating: 8.5,
      premiereDate: new Date('2020-01-01'),
      numEpisodes: 12,
      episodeDuration: 24,
      animeType: 'tv',
      status: 'finished_airing',
      source: 'manga',
      studios: ['Studio Test'],
      genres: ['Action', 'Drama']
    };

    it('should store and retrieve anime info', async () => {
      const stored = await database.storeAnimeInfo(mockAnimeInfo);
      
      expect(stored.malId).toBe(mockAnimeInfo.malId);
      expect(stored.title).toBe(mockAnimeInfo.title);
      expect(stored.titleEnglish).toBe(mockAnimeInfo.titleEnglish);
      expect(stored.animeType).toBe(mockAnimeInfo.animeType);
      expect(stored.studios).toEqual(mockAnimeInfo.studios);
      expect(stored.genres).toEqual(mockAnimeInfo.genres);
      expect(stored.id).toBeGreaterThan(0);
      expect(stored.createdAt).toBeInstanceOf(Date);
      expect(stored.updatedAt).toBeInstanceOf(Date);
    });

    it('should retrieve anime info by MAL ID', async () => {
      await database.storeAnimeInfo(mockAnimeInfo);
      
      const retrieved = await database.getAnimeInfo(1);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.malId).toBe(1);
      expect(retrieved!.title).toBe('Test Anime');
    });

    it('should return null for non-existent anime', async () => {
      const retrieved = await database.getAnimeInfo(999);
      
      expect(retrieved).toBeNull();
    });

    it('should update existing anime info', async () => {
      await database.storeAnimeInfo(mockAnimeInfo);
      
      const updatedInfo = {
        ...mockAnimeInfo,
        title: 'Updated Test Anime',
        rating: 9.0
      };
      
      const updated = await database.storeAnimeInfo(updatedInfo);
      
      expect(updated.title).toBe('Updated Test Anime');
      expect(updated.rating).toBe(9.0);
      expect(updated.malId).toBe(1); // Same MAL ID
    });
  });

  describe('Relationship Operations', () => {
    const mockRelationship: Omit<AnimeRelationship, 'id' | 'createdAt'> = {
      sourceMalId: 1,
      targetMalId: 2,
      relationshipType: 'sequel'
    };

    beforeEach(async () => {
      // Store some anime info first
      await database.storeAnimeInfo({
        malId: 1, title: 'Anime 1', titleEnglish: null, titleJapanese: null,
        imageUrl: null, rating: null, premiereDate: null, numEpisodes: null,
        episodeDuration: null, animeType: 'tv', status: null, source: null,
        studios: [], genres: []
      });
      
      await database.storeAnimeInfo({
        malId: 2, title: 'Anime 2', titleEnglish: null, titleJapanese: null,
        imageUrl: null, rating: null, premiereDate: null, numEpisodes: null,
        episodeDuration: null, animeType: 'tv', status: null, source: null,
        studios: [], genres: []
      });
    });

    it('should store relationships', async () => {
      await database.storeRelationship(mockRelationship);
      
      const relationships = await database.getRelationships(1);
      
      expect(relationships).toHaveLength(1);
      expect(relationships[0].sourceMalId).toBe(1);
      expect(relationships[0].targetMalId).toBe(2);
      expect(relationships[0].relationshipType).toBe('sequel');
    });

    it('should retrieve relationships for both source and target', async () => {
      await database.storeRelationship(mockRelationship);
      
      const sourceRelationships = await database.getRelationships(1);
      const targetRelationships = await database.getRelationships(2);
      
      expect(sourceRelationships).toHaveLength(1);
      expect(targetRelationships).toHaveLength(1);
      expect(sourceRelationships[0].id).toBe(targetRelationships[0].id);
    });

    it('should handle duplicate relationships gracefully', async () => {
      await database.storeRelationship(mockRelationship);
      await database.storeRelationship(mockRelationship); // Duplicate
      
      const relationships = await database.getRelationships(1);
      
      expect(relationships).toHaveLength(1); // Should not duplicate
    });

    it('should return empty array for anime with no relationships', async () => {
      const relationships = await database.getRelationships(999);
      
      expect(relationships).toHaveLength(0);
    });
  });



  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      database.close(); // Close database to simulate error
      
      const result = await database.getAnimeInfo(1);
      expect(result).toBeNull();
    });
  });
});