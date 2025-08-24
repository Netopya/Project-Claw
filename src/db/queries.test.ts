import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  // Anime Info queries
  getAnimeInfoByMalId,
  getAnimeInfoByMalIds,
  upsertAnimeInfo,
  
  // Watchlist queries
  getAllWatchlistEntries,
  getWatchlistEntryByMalId,
  getWatchlistEntryById,
  addAnimeToWatchlist,
  updateWatchlistPriorities,
  removeFromWatchlist,
  removeFromWatchlistByMalId,
  
  // Relationship queries
  getAnimeRelationships,
  getAnimeRelationshipsAsSource,
  getAnimeRelationshipsAsTarget,
  upsertAnimeRelationship,
  batchInsertAnimeRelationships,
  
  // Timeline cache queries
  getCachedTimeline,
  upsertTimelineCache,
  invalidateTimelineCache,
  invalidateMultipleTimelineCaches
} from './queries.js';
import { initializeFreshDatabase } from './init-schema.js';
import type { NewAnimeInfo, NewAnimeRelationship, NewTimelineCache } from './schema.js';

describe('Database Queries Integration Tests', () => {
  beforeEach(async () => {
    // Initialize fresh database for each test
    await initializeFreshDatabase();
  });

  describe('Anime Info Queries', () => {
    const sampleAnimeInfo: NewAnimeInfo = {
      malId: 1,
      title: 'Cowboy Bebop',
      titleEnglish: 'Cowboy Bebop',
      titleJapanese: 'カウボーイビバップ',
      imageUrl: 'https://example.com/image.jpg',
      rating: 8.78,
      premiereDate: '1998-04-03',
      numEpisodes: 26,
      episodeDuration: 24,
      animeType: 'tv',
      status: 'finished_airing',
      source: 'original',
      studios: JSON.stringify(['Sunrise']),
      genres: JSON.stringify(['Action', 'Drama', 'Sci-Fi'])
    };

    it('should create and retrieve anime info by MAL ID', async () => {
      // Create anime info
      const created = await upsertAnimeInfo(sampleAnimeInfo);
      expect(created.malId).toBe(1);
      expect(created.title).toBe('Cowboy Bebop');
      expect(created.id).toBeTypeOf('number');

      // Retrieve by MAL ID
      const retrieved = await getAnimeInfoByMalId(1);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.malId).toBe(1);
      expect(retrieved!.title).toBe('Cowboy Bebop');
      expect(retrieved!.titleEnglish).toBe('Cowboy Bebop');
    });

    it('should return null for non-existent anime info', async () => {
      const result = await getAnimeInfoByMalId(999);
      expect(result).toBeNull();
    });

    it('should update existing anime info on upsert', async () => {
      // Create initial anime info
      await upsertAnimeInfo(sampleAnimeInfo);

      // Update with new data
      const updatedData = {
        ...sampleAnimeInfo,
        rating: 9.0,
        titleEnglish: 'Cowboy Bebop Updated'
      };
      
      const updated = await upsertAnimeInfo(updatedData);
      expect(updated.rating).toBe(9.0);
      expect(updated.titleEnglish).toBe('Cowboy Bebop Updated');

      // Verify only one record exists
      const retrieved = await getAnimeInfoByMalId(1);
      expect(retrieved!.rating).toBe(9.0);
    });

    it('should retrieve multiple anime info by MAL IDs', async () => {
      // Create multiple anime
      const anime1 = { ...sampleAnimeInfo, malId: 1, title: 'Anime 1' };
      const anime2 = { ...sampleAnimeInfo, malId: 2, title: 'Anime 2' };
      const anime3 = { ...sampleAnimeInfo, malId: 3, title: 'Anime 3' };

      await upsertAnimeInfo(anime1);
      await upsertAnimeInfo(anime2);
      await upsertAnimeInfo(anime3);

      // Retrieve multiple
      const results = await getAnimeInfoByMalIds([1, 3, 999]);
      expect(results).toHaveLength(2);
      expect(results.map(a => a.malId).sort()).toEqual([1, 3]);
    });

    it('should handle empty MAL IDs array', async () => {
      const results = await getAnimeInfoByMalIds([]);
      expect(results).toEqual([]);
    });
  });

  describe('Watchlist Queries', () => {
    const sampleWatchlistData = {
      malId: 1,
      title: 'Attack on Titan',
      titleEnglish: 'Attack on Titan',
      imageUrl: 'https://example.com/aot.jpg',
      rating: 9.0,
      numEpisodes: 25,
      animeType: 'tv',
      watchStatus: 'watching',
      userRating: 8.5
    };

    it('should add anime to watchlist and retrieve all entries', async () => {
      // Add anime to watchlist
      const added = await addAnimeToWatchlist(sampleWatchlistData);
      expect(added.animeInfo.malId).toBe(1);
      expect(added.animeInfo.title).toBe('Attack on Titan');
      expect(added.watchStatus).toBe('watching');
      expect(added.priority).toBe(1);

      // Retrieve all watchlist entries
      const allEntries = await getAllWatchlistEntries();
      expect(allEntries).toHaveLength(1);
      expect(allEntries[0].animeInfo.malId).toBe(1);
      expect(allEntries[0].watchStatus).toBe('watching');
    });

    it('should prevent duplicate entries in watchlist', async () => {
      // Add anime first time
      await addAnimeToWatchlist(sampleWatchlistData);

      // Try to add same anime again
      await expect(addAnimeToWatchlist(sampleWatchlistData))
        .rejects.toThrow('Anime is already in watchlist');
    });

    it('should retrieve watchlist entry by MAL ID', async () => {
      await addAnimeToWatchlist(sampleWatchlistData);

      const entry = await getWatchlistEntryByMalId(1);
      expect(entry).not.toBeNull();
      expect(entry!.animeInfo.malId).toBe(1);
      expect(entry!.watchStatus).toBe('watching');
    });

    it('should retrieve watchlist entry by database ID', async () => {
      const added = await addAnimeToWatchlist(sampleWatchlistData);

      const entry = await getWatchlistEntryById(added.id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(added.id);
      expect(entry!.animeInfo.malId).toBe(1);
    });

    it('should update watchlist priorities correctly', async () => {
      // Add multiple anime
      const anime1 = { ...sampleWatchlistData, malId: 1, title: 'Anime 1' };
      const anime2 = { ...sampleWatchlistData, malId: 2, title: 'Anime 2' };
      const anime3 = { ...sampleWatchlistData, malId: 3, title: 'Anime 3' };

      const added1 = await addAnimeToWatchlist(anime1);
      const added2 = await addAnimeToWatchlist(anime2);
      const added3 = await addAnimeToWatchlist(anime3);

      // Reorder: 3, 1, 2
      await updateWatchlistPriorities([added3.id, added1.id, added2.id]);

      // Verify new order
      const entries = await getAllWatchlistEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].animeInfo.malId).toBe(3); // Priority 1
      expect(entries[1].animeInfo.malId).toBe(1); // Priority 2
      expect(entries[2].animeInfo.malId).toBe(2); // Priority 3
    });

    it('should remove from watchlist and adjust priorities', async () => {
      // Add multiple anime
      const anime1 = { ...sampleWatchlistData, malId: 1, title: 'Anime 1' };
      const anime2 = { ...sampleWatchlistData, malId: 2, title: 'Anime 2' };
      const anime3 = { ...sampleWatchlistData, malId: 3, title: 'Anime 3' };

      const added1 = await addAnimeToWatchlist(anime1);
      const added2 = await addAnimeToWatchlist(anime2);
      const added3 = await addAnimeToWatchlist(anime3);

      // Remove middle entry
      await removeFromWatchlist(added2.id);

      // Verify remaining entries and priorities
      const entries = await getAllWatchlistEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].animeInfo.malId).toBe(1); // Priority 1
      expect(entries[0].priority).toBe(1);
      expect(entries[1].animeInfo.malId).toBe(3); // Priority 2 (adjusted from 3)
      expect(entries[1].priority).toBe(2);

      // Verify anime info still exists (not deleted)
      const animeInfo = await getAnimeInfoByMalId(2);
      expect(animeInfo).not.toBeNull();
    });

    it('should remove from watchlist by MAL ID', async () => {
      await addAnimeToWatchlist(sampleWatchlistData);

      await removeFromWatchlistByMalId(1);

      const entries = await getAllWatchlistEntries();
      expect(entries).toHaveLength(0);

      // Verify anime info still exists
      const animeInfo = await getAnimeInfoByMalId(1);
      expect(animeInfo).not.toBeNull();
    });
  });

  describe('Relationship Queries', () => {
    beforeEach(async () => {
      // Create some anime info for relationships
      await upsertAnimeInfo({
        malId: 1,
        title: 'Attack on Titan Season 1',
        animeType: 'tv'
      });
      await upsertAnimeInfo({
        malId: 2,
        title: 'Attack on Titan Season 2',
        animeType: 'tv'
      });
      await upsertAnimeInfo({
        malId: 3,
        title: 'Attack on Titan Season 3',
        animeType: 'tv'
      });
    });

    it('should create and retrieve anime relationships', async () => {
      const relationship: NewAnimeRelationship = {
        sourceMalId: 1,
        targetMalId: 2,
        relationshipType: 'sequel'
      };

      const created = await upsertAnimeRelationship(relationship);
      expect(created.sourceMalId).toBe(1);
      expect(created.targetMalId).toBe(2);
      expect(created.relationshipType).toBe('sequel');

      // Retrieve relationships
      const relationships = await getAnimeRelationships(1);
      expect(relationships).toHaveLength(1);
      expect(relationships[0].targetMalId).toBe(2);
    });

    it('should prevent duplicate relationships', async () => {
      const relationship: NewAnimeRelationship = {
        sourceMalId: 1,
        targetMalId: 2,
        relationshipType: 'sequel'
      };

      // Create relationship twice
      const first = await upsertAnimeRelationship(relationship);
      const second = await upsertAnimeRelationship(relationship);

      // Should return the same relationship
      expect(first.id).toBe(second.id);

      // Verify only one relationship exists
      const relationships = await getAnimeRelationships(1);
      expect(relationships).toHaveLength(1);
    });

    it('should retrieve relationships as source and target', async () => {
      await upsertAnimeRelationship({
        sourceMalId: 1,
        targetMalId: 2,
        relationshipType: 'sequel'
      });
      await upsertAnimeRelationship({
        sourceMalId: 3,
        targetMalId: 1,
        relationshipType: 'prequel'
      });

      // As source
      const asSource = await getAnimeRelationshipsAsSource(1);
      expect(asSource).toHaveLength(1);
      expect(asSource[0].targetMalId).toBe(2);

      // As target
      const asTarget = await getAnimeRelationshipsAsTarget(1);
      expect(asTarget).toHaveLength(1);
      expect(asTarget[0].sourceMalId).toBe(3);

      // All relationships
      const all = await getAnimeRelationships(1);
      expect(all).toHaveLength(2);
    });

    it('should batch insert relationships', async () => {
      const relationships: NewAnimeRelationship[] = [
        { sourceMalId: 1, targetMalId: 2, relationshipType: 'sequel' },
        { sourceMalId: 2, targetMalId: 3, relationshipType: 'sequel' },
        { sourceMalId: 1, targetMalId: 3, relationshipType: 'parent_story' }
      ];

      await batchInsertAnimeRelationships(relationships);

      const anime1Relationships = await getAnimeRelationships(1);
      expect(anime1Relationships).toHaveLength(2);

      const anime2Relationships = await getAnimeRelationships(2);
      expect(anime2Relationships).toHaveLength(2);
    });
  });

  describe('Timeline Cache Queries', () => {
    const sampleTimelineData = {
      rootMalId: 1,
      entries: [
        { malId: 1, title: 'Season 1', chronologicalOrder: 1 },
        { malId: 2, title: 'Season 2', chronologicalOrder: 2 }
      ]
    };

    it('should create and retrieve timeline cache', async () => {
      const cacheData: NewTimelineCache = {
        rootMalId: 1,
        timelineData: JSON.stringify(sampleTimelineData)
      };

      const created = await upsertTimelineCache(cacheData);
      expect(created.rootMalId).toBe(1);
      expect(created.cacheVersion).toBe(1);

      const retrieved = await getCachedTimeline(1);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.rootMalId).toBe(1);
      expect(JSON.parse(retrieved!.timelineData)).toEqual(sampleTimelineData);
    });

    it('should update existing timeline cache', async () => {
      const initialData: NewTimelineCache = {
        rootMalId: 1,
        timelineData: JSON.stringify(sampleTimelineData)
      };

      // Create initial cache
      await upsertTimelineCache(initialData);

      // Update with new data
      const updatedTimelineData = {
        ...sampleTimelineData,
        entries: [...sampleTimelineData.entries, { malId: 3, title: 'Season 3', chronologicalOrder: 3 }]
      };

      const updatedData: NewTimelineCache = {
        rootMalId: 1,
        timelineData: JSON.stringify(updatedTimelineData)
      };

      const updated = await upsertTimelineCache(updatedData);
      expect(updated.cacheVersion).toBe(2);

      const retrieved = await getCachedTimeline(1);
      expect(JSON.parse(retrieved!.timelineData).entries).toHaveLength(3);
    });

    it('should invalidate timeline cache', async () => {
      const cacheData: NewTimelineCache = {
        rootMalId: 1,
        timelineData: JSON.stringify(sampleTimelineData)
      };

      await upsertTimelineCache(cacheData);
      
      // Verify cache exists
      let cached = await getCachedTimeline(1);
      expect(cached).not.toBeNull();

      // Invalidate cache
      await invalidateTimelineCache(1);

      // Verify cache is gone
      cached = await getCachedTimeline(1);
      expect(cached).toBeNull();
    });

    it('should invalidate multiple timeline caches', async () => {
      // Create multiple caches
      await upsertTimelineCache({
        rootMalId: 1,
        timelineData: JSON.stringify({ ...sampleTimelineData, rootMalId: 1 })
      });
      await upsertTimelineCache({
        rootMalId: 2,
        timelineData: JSON.stringify({ ...sampleTimelineData, rootMalId: 2 })
      });
      await upsertTimelineCache({
        rootMalId: 3,
        timelineData: JSON.stringify({ ...sampleTimelineData, rootMalId: 3 })
      });

      // Invalidate multiple
      await invalidateMultipleTimelineCaches([1, 3]);

      // Verify correct caches are invalidated
      expect(await getCachedTimeline(1)).toBeNull();
      expect(await getCachedTimeline(2)).not.toBeNull();
      expect(await getCachedTimeline(3)).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent watchlist entry removal', async () => {
      await expect(removeFromWatchlist(999))
        .rejects.toThrow('Watchlist entry not found');
    });

    it('should handle non-existent MAL ID removal', async () => {
      await expect(removeFromWatchlistByMalId(999))
        .rejects.toThrow('Anime not found in watchlist');
    });

    it('should handle invalid watchlist priority updates', async () => {
      await expect(updateWatchlistPriorities([999]))
        .rejects.toThrow('Some watchlist entries not found');
    });

    it('should handle empty priority updates', async () => {
      await expect(updateWatchlistPriorities([]))
        .rejects.toThrow('No watchlist IDs provided');
    });
  });
});