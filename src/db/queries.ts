import { db } from './connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from './schema.js';
import { eq, desc, asc, and, or, inArray, gt } from 'drizzle-orm';
import type { 
  AnimeInfo, 
  NewAnimeInfo, 
  UserWatchlistEntry, 
  NewUserWatchlistEntry,
  AnimeRelationship,
  NewAnimeRelationship,
  TimelineCache,
  NewTimelineCache
} from './schema.js';

// ===== ANIME INFO QUERIES =====

/**
 * Get anime info by MAL ID
 */
export async function getAnimeInfoByMalId(malId: number): Promise<AnimeInfo | null> {
  try {
    const result = await db
      .select()
      .from(animeInfo)
      .where(eq(animeInfo.malId, malId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error fetching anime info by MAL ID:', error);
    throw new Error('Failed to fetch anime info');
  }
}

/**
 * Get multiple anime info by MAL IDs
 */
export async function getAnimeInfoByMalIds(malIds: number[]): Promise<AnimeInfo[]> {
  try {
    if (malIds.length === 0) return [];
    
    const results = await db
      .select()
      .from(animeInfo)
      .where(inArray(animeInfo.malId, malIds));

    return results;
  } catch (error) {
    console.error('Error fetching anime info by MAL IDs:', error);
    throw new Error('Failed to fetch anime info');
  }
}

/**
 * Create or update anime info
 */
export async function upsertAnimeInfo(animeData: NewAnimeInfo): Promise<AnimeInfo> {
  try {
    // Check if anime already exists
    const existing = await getAnimeInfoByMalId(animeData.malId);
    
    if (existing) {
      // Update existing anime info
      const updated = await db
        .update(animeInfo)
        .set({
          ...animeData,
          updatedAt: new Date().toISOString()
        })
        .where(eq(animeInfo.malId, animeData.malId))
        .returning();
      
      return updated[0];
    } else {
      // Insert new anime info
      const inserted = await db
        .insert(animeInfo)
        .values(animeData)
        .returning();
      
      return inserted[0];
    }
  } catch (error) {
    console.error('Error upserting anime info:', error);
    throw new Error('Failed to save anime info');
  }
}

// ===== USER WATCHLIST QUERIES =====

/**
 * Get all anime in user's watchlist with anime info joined
 */
export async function getAllWatchlistEntries(): Promise<(UserWatchlistEntry & { animeInfo: AnimeInfo })[]> {
  try {
    const results = await db
      .select()
      .from(userWatchlist)
      .innerJoin(animeInfo, eq(userWatchlist.animeInfoId, animeInfo.id))
      .orderBy(asc(userWatchlist.priority));

    return results.map(result => ({
      ...result.user_watchlist,
      animeInfo: result.anime_info
    }));
  } catch (error) {
    console.error('Error fetching watchlist entries:', error);
    throw new Error('Failed to fetch watchlist');
  }
}

/**
 * Get watchlist entry by MAL ID
 */
export async function getWatchlistEntryByMalId(malId: number): Promise<(UserWatchlistEntry & { animeInfo: AnimeInfo }) | null> {
  try {
    const results = await db
      .select()
      .from(userWatchlist)
      .innerJoin(animeInfo, eq(userWatchlist.animeInfoId, animeInfo.id))
      .where(eq(animeInfo.malId, malId))
      .limit(1);

    if (results.length === 0) return null;

    const result = results[0];
    return {
      ...result.user_watchlist,
      animeInfo: result.anime_info
    };
  } catch (error) {
    console.error('Error fetching watchlist entry by MAL ID:', error);
    throw new Error('Failed to fetch watchlist entry');
  }
}

/**
 * Get watchlist entry by database ID
 */
export async function getWatchlistEntryById(id: number): Promise<(UserWatchlistEntry & { animeInfo: AnimeInfo }) | null> {
  try {
    const results = await db
      .select()
      .from(userWatchlist)
      .innerJoin(animeInfo, eq(userWatchlist.animeInfoId, animeInfo.id))
      .where(eq(userWatchlist.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const result = results[0];
    return {
      ...result.user_watchlist,
      animeInfo: result.anime_info
    };
  } catch (error) {
    console.error('Error fetching watchlist entry by ID:', error);
    throw new Error('Failed to fetch watchlist entry');
  }
}

/**
 * Add anime to user's watchlist (creates anime info if needed)
 */
export async function addAnimeToWatchlist(animeData: {
  malId: number;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  imageUrl?: string;
  rating?: number;
  premiereDate?: Date;
  numEpisodes?: number;
  episodeDuration?: number;
  animeType?: string;
  status?: string;
  source?: string;
  studios?: string[];
  genres?: string[];
  watchStatus?: string;
  userRating?: number;
  notes?: string;
}): Promise<UserWatchlistEntry & { animeInfo: AnimeInfo }> {
  try {
    // First, ensure anime info exists
    const animeInfoData: NewAnimeInfo = {
      malId: animeData.malId,
      title: animeData.title,
      titleEnglish: animeData.titleEnglish || null,
      titleJapanese: animeData.titleJapanese || null,
      imageUrl: animeData.imageUrl || null,
      rating: animeData.rating || null,
      premiereDate: animeData.premiereDate?.toISOString() || null,
      numEpisodes: animeData.numEpisodes || null,
      episodeDuration: animeData.episodeDuration || null,
      animeType: animeData.animeType || 'unknown',
      status: animeData.status || null,
      source: animeData.source || null,
      studios: animeData.studios ? JSON.stringify(animeData.studios) : null,
      genres: animeData.genres ? JSON.stringify(animeData.genres) : null,
    };

    const savedAnimeInfo = await upsertAnimeInfo(animeInfoData);

    // Check if already in watchlist
    const existingEntry = await getWatchlistEntryByMalId(animeData.malId);
    if (existingEntry) {
      throw new Error('Anime is already in watchlist');
    }

    // Get the next priority (highest + 1)
    const maxPriorityResult = await db
      .select({ maxPriority: userWatchlist.priority })
      .from(userWatchlist)
      .orderBy(desc(userWatchlist.priority))
      .limit(1);

    const nextPriority = maxPriorityResult.length > 0
      ? (maxPriorityResult[0].maxPriority || 0) + 1
      : 1;

    // Add to watchlist
    const watchlistData: NewUserWatchlistEntry = {
      animeInfoId: savedAnimeInfo.id,
      priority: nextPriority,
      watchStatus: animeData.watchStatus || 'plan_to_watch',
      userRating: animeData.userRating || null,
      notes: animeData.notes || null,
    };

    const watchlistResult = await db
      .insert(userWatchlist)
      .values(watchlistData)
      .returning();

    return {
      ...watchlistResult[0],
      animeInfo: savedAnimeInfo
    };
  } catch (error) {
    console.error('Error adding anime to watchlist:', error);
    // Re-throw the original error if it's already a meaningful error message
    if (error instanceof Error && error.message === 'Anime is already in watchlist') {
      throw error;
    }
    throw new Error('Failed to add anime to watchlist');
  }
}

/**
 * Update watchlist priorities for reordering
 */
export async function updateWatchlistPriorities(watchlistIds: number[]): Promise<void> {
  console.log('🔄 Updating watchlist priorities:', watchlistIds);

  if (!watchlistIds || watchlistIds.length === 0) {
    throw new Error('No watchlist IDs provided');
  }

  try {
    // Verify all watchlist entries exist
    const existingEntries = await db
      .select({ id: userWatchlist.id })
      .from(userWatchlist)
      .where(inArray(userWatchlist.id, watchlistIds));

    if (existingEntries.length !== watchlistIds.length) {
      throw new Error('Some watchlist entries not found');
    }

    // Update priorities sequentially
    for (let i = 0; i < watchlistIds.length; i++) {
      const watchlistId = watchlistIds[i];
      const newPriority = i + 1;

      console.log(`📝 Setting watchlist entry ${watchlistId} to priority ${newPriority}`);

      await db
        .update(userWatchlist)
        .set({
          priority: newPriority,
          updatedAt: new Date().toISOString()
        })
        .where(eq(userWatchlist.id, watchlistId));
    }

    console.log('🎉 Successfully updated all watchlist priorities');
  } catch (error) {
    console.error('❌ Error updating watchlist priorities:', error);
    throw new Error(`Failed to update watchlist order: ${(error as Error)?.message}`);
  }
}

/**
 * Remove anime from user's watchlist (keeps anime info for timeline relationships)
 */
export async function removeFromWatchlist(watchlistId: number): Promise<void> {
  try {
    // Get the watchlist entry to be deleted
    const entryToDelete = await db
      .select({ priority: userWatchlist.priority })
      .from(userWatchlist)
      .where(eq(userWatchlist.id, watchlistId))
      .limit(1);

    if (entryToDelete.length === 0) {
      throw new Error('Watchlist entry not found');
    }

    const deletedPriority = entryToDelete[0].priority;

    // Delete the watchlist entry (anime_info remains for timeline relationships)
    await db.delete(userWatchlist).where(eq(userWatchlist.id, watchlistId));

    // Get all watchlist entries with priority higher than the deleted one
    const entriesToUpdate = await db
      .select({ id: userWatchlist.id, priority: userWatchlist.priority })
      .from(userWatchlist)
      .where(gt(userWatchlist.priority, deletedPriority));

    // Update each entry's priority individually
    for (const entry of entriesToUpdate) {
      await db
        .update(userWatchlist)
        .set({
          priority: entry.priority - 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(userWatchlist.id, entry.id));
    }
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    // Re-throw the original error if it's already a meaningful error message
    if (error instanceof Error && error.message === 'Watchlist entry not found') {
      throw error;
    }
    throw new Error('Failed to remove from watchlist');
  }
}

/**
 * Remove anime from watchlist by MAL ID
 */
export async function removeFromWatchlistByMalId(malId: number): Promise<void> {
  try {
    const entry = await getWatchlistEntryByMalId(malId);
    if (!entry) {
      throw new Error('Anime not found in watchlist');
    }
    
    await removeFromWatchlist(entry.id);
  } catch (error) {
    console.error('Error removing from watchlist by MAL ID:', error);
    // Re-throw the original error if it's already a meaningful error message
    if (error instanceof Error && error.message === 'Anime not found in watchlist') {
      throw error;
    }
    throw new Error('Failed to remove from watchlist');
  }
}

// ===== ANIME RELATIONSHIPS QUERIES =====

/**
 * Get all relationships for an anime (both as source and target)
 */
export async function getAnimeRelationships(malId: number): Promise<AnimeRelationship[]> {
  try {
    const results = await db
      .select()
      .from(animeRelationships)
      .where(or(
        eq(animeRelationships.sourceMalId, malId),
        eq(animeRelationships.targetMalId, malId)
      ));

    return results;
  } catch (error) {
    console.error('Error fetching anime relationships:', error);
    throw new Error('Failed to fetch anime relationships');
  }
}

/**
 * Get relationships where anime is the source
 */
export async function getAnimeRelationshipsAsSource(malId: number): Promise<AnimeRelationship[]> {
  try {
    const results = await db
      .select()
      .from(animeRelationships)
      .where(eq(animeRelationships.sourceMalId, malId));

    return results;
  } catch (error) {
    console.error('Error fetching anime relationships as source:', error);
    throw new Error('Failed to fetch anime relationships');
  }
}

/**
 * Get relationships where anime is the target
 */
export async function getAnimeRelationshipsAsTarget(malId: number): Promise<AnimeRelationship[]> {
  try {
    const results = await db
      .select()
      .from(animeRelationships)
      .where(eq(animeRelationships.targetMalId, malId));

    return results;
  } catch (error) {
    console.error('Error fetching anime relationships as target:', error);
    throw new Error('Failed to fetch anime relationships');
  }
}

/**
 * Add or update anime relationship
 */
export async function upsertAnimeRelationship(relationshipData: NewAnimeRelationship): Promise<AnimeRelationship> {
  try {
    // Check if relationship already exists
    const existing = await db
      .select()
      .from(animeRelationships)
      .where(and(
        eq(animeRelationships.sourceMalId, relationshipData.sourceMalId),
        eq(animeRelationships.targetMalId, relationshipData.targetMalId),
        eq(animeRelationships.relationshipType, relationshipData.relationshipType)
      ))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Insert new relationship
    const inserted = await db
      .insert(animeRelationships)
      .values(relationshipData)
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error upserting anime relationship:', error);
    throw new Error('Failed to save anime relationship');
  }
}

/**
 * Batch insert anime relationships
 */
export async function batchInsertAnimeRelationships(relationships: NewAnimeRelationship[]): Promise<void> {
  try {
    if (relationships.length === 0) return;

    // Insert relationships one by one to handle duplicates and foreign key constraints gracefully
    let successCount = 0;
    let skipCount = 0;
    
    for (const relationship of relationships) {
      try {
        await upsertAnimeRelationship(relationship);
        successCount++;
      } catch (error: any) {
        if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          console.warn(`⚠️ Skipping relationship ${relationship.sourceMalId}→${relationship.targetMalId}: Referenced anime not in database`);
          skipCount++;
        } else {
          console.warn('Failed to insert relationship:', relationship, error);
          skipCount++;
        }
        // Continue with other relationships
      }
    }
    
    console.log(`📊 Relationship batch complete: ${successCount} inserted, ${skipCount} skipped`);
  } catch (error) {
    console.error('Error batch inserting anime relationships:', error);
    throw new Error('Failed to save anime relationships');
  }
}

// ===== TIMELINE CACHE QUERIES =====

/**
 * Get cached timeline for an anime
 */
export async function getCachedTimeline(rootMalId: number): Promise<TimelineCache | null> {
  try {
    const result = await db
      .select()
      .from(timelineCache)
      .where(eq(timelineCache.rootMalId, rootMalId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Error fetching cached timeline:', error);
    throw new Error('Failed to fetch cached timeline');
  }
}

/**
 * Save or update timeline cache
 */
export async function upsertTimelineCache(cacheData: NewTimelineCache): Promise<TimelineCache> {
  try {
    // Check if cache already exists
    const existing = await getCachedTimeline(cacheData.rootMalId);
    
    if (existing) {
      // Update existing cache
      const updated = await db
        .update(timelineCache)
        .set({
          timelineData: cacheData.timelineData,
          cacheVersion: (existing.cacheVersion || 1) + 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(timelineCache.rootMalId, cacheData.rootMalId))
        .returning();
      
      return updated[0];
    } else {
      // Insert new cache
      const inserted = await db
        .insert(timelineCache)
        .values(cacheData)
        .returning();
      
      return inserted[0];
    }
  } catch (error) {
    console.error('Error upserting timeline cache:', error);
    throw new Error('Failed to save timeline cache');
  }
}

/**
 * Invalidate timeline cache for an anime
 */
export async function invalidateTimelineCache(rootMalId: number): Promise<void> {
  try {
    await db
      .delete(timelineCache)
      .where(eq(timelineCache.rootMalId, rootMalId));
  } catch (error) {
    console.error('Error invalidating timeline cache:', error);
    throw new Error('Failed to invalidate timeline cache');
  }
}

/**
 * Invalidate multiple timeline caches
 */
export async function invalidateMultipleTimelineCaches(rootMalIds: number[]): Promise<void> {
  try {
    if (rootMalIds.length === 0) return;
    
    await db
      .delete(timelineCache)
      .where(inArray(timelineCache.rootMalId, rootMalIds));
  } catch (error) {
    console.error('Error invalidating multiple timeline caches:', error);
    throw new Error('Failed to invalidate timeline caches');
  }
}

// ===== LEGACY COMPATIBILITY FUNCTIONS =====

/**
 * Legacy function for backward compatibility - maps to new watchlist queries
 * @deprecated Use getAllWatchlistEntries instead
 */
export async function getAllAnime() {
  return getAllWatchlistEntries();
}

/**
 * Legacy function for backward compatibility - maps to new watchlist queries
 * @deprecated Use getWatchlistEntryByMalId instead
 */
export async function getAnimeByMalId(malId: number) {
  return getWatchlistEntryByMalId(malId);
}

/**
 * Legacy function for backward compatibility - maps to new watchlist queries
 * @deprecated Use addAnimeToWatchlist instead
 */
export async function addAnime(animeData: any) {
  return addAnimeToWatchlist(animeData);
}

/**
 * Legacy function for backward compatibility - maps to new watchlist queries
 * @deprecated Use updateWatchlistPriorities instead
 */
export async function updateAnimePriorities(animeIds: number[]) {
  return updateWatchlistPriorities(animeIds);
}

/**
 * Legacy function for backward compatibility - maps to new watchlist queries
 * @deprecated Use removeFromWatchlist instead
 */
export async function deleteAnime(id: number) {
  return removeFromWatchlist(id);
}