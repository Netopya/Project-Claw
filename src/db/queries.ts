import { db } from './connection.js';
import { anime } from './schema.js';
import { eq, desc, asc } from 'drizzle-orm';
import type { Anime, SeriesInfo } from '../types/anime.js';

// Get all anime ordered by priority
export async function getAllAnime(): Promise<Anime[]> {
  try {
    const results = await db
      .select()
      .from(anime)
      .orderBy(asc(anime.priority));

    return results.map(transformAnimeFromDb);
  } catch (error) {
    console.error('Error fetching anime:', error);
    throw new Error('Failed to fetch anime list');
  }
}

// Get anime by MAL ID
export async function getAnimeByMalId(malId: number): Promise<Anime | null> {
  try {
    const result = await db
      .select()
      .from(anime)
      .where(eq(anime.malId, malId))
      .limit(1);

    return result.length > 0 ? transformAnimeFromDb(result[0]) : null;
  } catch (error) {
    console.error('Error fetching anime by MAL ID:', error);
    throw new Error('Failed to fetch anime');
  }
}

// Add new anime
export async function addAnime(animeData: {
  malId: number;
  title: string;
  titleEnglish?: string;
  titleJapanese?: string;
  imageUrl?: string;
  rating?: number;
  premiereDate?: Date;
  numEpisodes?: number;
  seriesInfo?: SeriesInfo;
}): Promise<Anime> {
  try {
    // Get the next priority (highest + 1)
    const maxPriorityResult = await db
      .select({ maxPriority: anime.priority })
      .from(anime)
      .orderBy(desc(anime.priority))
      .limit(1);

    const nextPriority = maxPriorityResult.length > 0
      ? (maxPriorityResult[0].maxPriority || 0) + 1
      : 1;

    const newAnime = {
      malId: animeData.malId,
      title: animeData.title,
      titleEnglish: animeData.titleEnglish || null,
      titleJapanese: animeData.titleJapanese || null,
      imageUrl: animeData.imageUrl || null,
      rating: animeData.rating || null,
      premiereDate: animeData.premiereDate?.toISOString() || null,
      numEpisodes: animeData.numEpisodes || null,
      seriesInfo: animeData.seriesInfo ? JSON.stringify(animeData.seriesInfo) : null,
      priority: nextPriority,
    };

    const result = await db.insert(anime).values(newAnime).returning();
    return transformAnimeFromDb(result[0]);
  } catch (error) {
    console.error('Error adding anime:', error);
    throw new Error('Failed to add anime');
  }
}

// Update anime priorities for reordering
export async function updateAnimePriorities(animeIds: number[]): Promise<void> {
  console.log('🔄 Updating anime priorities:', animeIds);

  if (!animeIds || animeIds.length === 0) {
    throw new Error('No anime IDs provided');
  }

  try {
    // First, let's verify the anime exist
    const existingAnime = await db
      .select({ id: anime.id, priority: anime.priority })
      .from(anime)
      .where(eq(anime.id, animeIds[0])); // Check first one as a test

    console.log('🔍 Sample existing anime:', existingAnime);

    // Update priorities sequentially (better-sqlite3 doesn't support async transactions)
    for (let i = 0; i < animeIds.length; i++) {
      const animeId = animeIds[i];
      const newPriority = i + 1;

      console.log(`📝 Setting anime ${animeId} to priority ${newPriority}`);

      try {
        const result = await db
          .update(anime)
          .set({
            priority: newPriority,
            updatedAt: new Date().toISOString()
          })
          .where(eq(anime.id, animeId));

        console.log(`✅ Updated anime ${animeId}:`, result);
      } catch (updateError) {
        console.error(`❌ Failed to update anime ${animeId}:`, updateError);
        throw updateError;
      }
    }

    console.log('🎉 Successfully updated all anime priorities');
  } catch (error) {
    console.error('❌ Error updating anime priorities:', error);
    console.error('📊 Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      animeIds,
      animeIdsType: typeof animeIds,
      firstIdType: typeof animeIds[0]
    });
    throw new Error(`Failed to update anime order: ${error?.message}`);
  }
}

// Delete anime
export async function deleteAnime(id: number): Promise<void> {
  try {
    // Get the anime to be deleted first
    const animeToDelete = await db
      .select({ priority: anime.priority })
      .from(anime)
      .where(eq(anime.id, id))
      .limit(1);

    if (animeToDelete.length === 0) {
      throw new Error('Anime not found');
    }

    const deletedPriority = animeToDelete[0].priority;

    // Delete the anime
    await db.delete(anime).where(eq(anime.id, id));

    // Get all anime with priority higher than the deleted one
    const animeToUpdate = await db
      .select({ id: anime.id, priority: anime.priority })
      .from(anime)
      .where(anime.priority > deletedPriority);

    // Update each anime's priority individually
    for (const animeItem of animeToUpdate) {
      await db
        .update(anime)
        .set({
          priority: animeItem.priority - 1,
          updatedAt: new Date().toISOString()
        })
        .where(eq(anime.id, animeItem.id));
    }
  } catch (error) {
    console.error('Error deleting anime:', error);
    throw new Error('Failed to delete anime');
  }
}

// Transform database result to Anime type
function transformAnimeFromDb(dbAnime: any): Anime {
  return {
    id: dbAnime.id,
    malId: dbAnime.malId,
    title: dbAnime.title,
    titleEnglish: dbAnime.titleEnglish,
    titleJapanese: dbAnime.titleJapanese,
    imageUrl: dbAnime.imageUrl,
    rating: dbAnime.rating,
    premiereDate: dbAnime.premiereDate ? new Date(dbAnime.premiereDate) : null,
    numEpisodes: dbAnime.numEpisodes,
    seriesInfo: dbAnime.seriesInfo ? JSON.parse(dbAnime.seriesInfo) : null,
    priority: dbAnime.priority,
    createdAt: new Date(dbAnime.createdAt),
    updatedAt: new Date(dbAnime.updatedAt),
  };
}