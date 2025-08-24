import { MyAnimeListService } from './myanimelist.js';
import { parseMyAnimeListUrl } from '../utils/url-parser.js';
import { transformMyAnimeListData } from '../utils/data-transformer.js';
import {
  handleMyAnimeListError,
  ValidationError,
  logError,
  retryWithBackoff
} from '../utils/error-handler.js';
import { getWatchlistEntryByMalId, addAnimeToWatchlist } from '../../db/queries.js';

/**
 * Main anime service that orchestrates MyAnimeList API integration
 * and database operations
 */
export class AnimeService {
  private malService: MyAnimeListService;

  constructor() {
    this.malService = new MyAnimeListService();
  }

  /**
   * Add anime from MyAnimeList URL with comprehensive relationship processing
   */
  async addAnimeFromUrl(url: string) {
    try {
      // Parse and validate URL
      const parsedUrl = parseMyAnimeListUrl(url);
      if (!parsedUrl.isValid) {
        throw new ValidationError(parsedUrl.error || 'Invalid MyAnimeList URL');
      }

      const malId = parsedUrl.malId;

      // Check if anime already exists in watchlist
      const existingEntry = await getWatchlistEntryByMalId(malId);
      if (existingEntry) {
        throw new ValidationError('This anime is already in your watchlist');
      }

      console.log(`🔄 Fetching comprehensive anime data for MAL ID: ${malId}`);

      // Fetch comprehensive anime data including relationships
      const { animeInfo, relationships } = await retryWithBackoff(
        () => this.malService.getComprehensiveAnimeInfo(malId),
        3,
        'AnimeService.addAnimeFromUrl'
      );

      console.log(`📊 Found ${relationships.length} relationships for anime: ${animeInfo.title}`);

      // Transform data to our watchlist format
      const watchlistData = {
        malId: animeInfo.malId,
        title: animeInfo.title,
        titleEnglish: animeInfo.titleEnglish,
        titleJapanese: animeInfo.titleJapanese,
        imageUrl: animeInfo.imageUrl,
        rating: animeInfo.rating,
        premiereDate: animeInfo.premiereDate,
        numEpisodes: animeInfo.numEpisodes,
        episodeDuration: animeInfo.episodeDuration,
        animeType: animeInfo.animeType,
        status: animeInfo.status,
        source: animeInfo.source,
        studios: animeInfo.studios,
        genres: animeInfo.genres,
        watchStatus: 'plan_to_watch',
      };

      // Add to watchlist (this will also upsert the anime info)
      const newEntry = await addAnimeToWatchlist(watchlistData);

      // Process related anime FIRST to ensure they exist in the database
      await this.processRelatedAnime(relationships);

      // Store relationship data AFTER related anime are in the database
      if (relationships.length > 0) {
        console.log(`💾 Storing ${relationships.length} relationships`);
        const { batchInsertAnimeRelationships } = await import('../../db/queries.js');
        await batchInsertAnimeRelationships(relationships);
      }

      console.log(`✅ Successfully added anime with relationships: ${newEntry.animeInfo.title} (MAL ID: ${malId})`);

      // Return in legacy format for backward compatibility
      return {
        id: newEntry.id,
        malId: newEntry.animeInfo.malId,
        title: newEntry.animeInfo.title,
        titleEnglish: newEntry.animeInfo.titleEnglish,
        titleJapanese: newEntry.animeInfo.titleJapanese,
        imageUrl: newEntry.animeInfo.imageUrl,
        rating: newEntry.animeInfo.rating,
        premiereDate: newEntry.animeInfo.premiereDate ? new Date(newEntry.animeInfo.premiereDate) : null,
        numEpisodes: newEntry.animeInfo.numEpisodes,
        episodeDuration: newEntry.animeInfo.episodeDuration,
        animeType: newEntry.animeInfo.animeType,
        status: newEntry.animeInfo.status,
        source: newEntry.animeInfo.source,
        studios: newEntry.animeInfo.studios ? JSON.parse(newEntry.animeInfo.studios) : null,
        genres: newEntry.animeInfo.genres ? JSON.parse(newEntry.animeInfo.genres) : null,
        priority: newEntry.priority,
        watchStatus: newEntry.watchStatus,
        userRating: newEntry.userRating,
        notes: newEntry.notes,
        createdAt: new Date(newEntry.createdAt),
        updatedAt: new Date(newEntry.updatedAt),
      };

    } catch (error) {
      const handledError = handleMyAnimeListError(error);
      logError(handledError, 'AnimeService.addAnimeFromUrl');
      throw handledError;
    }
  }

  /**
   * Refresh anime data from MyAnimeList
   */
  async refreshAnimeData(malId: number) {
    try {
      const existingEntry = await getWatchlistEntryByMalId(malId);
      if (!existingEntry) {
        throw new ValidationError('Anime not found in watchlist');
      }

      // Fetch updated data from MyAnimeList
      const { animeData, seriesInfo } = await retryWithBackoff(
        () => this.malService.getAnimeInfo(malId),
        3,
        'AnimeService.refreshAnimeData'
      );

      // For now, we'll return the transformed data
      // TODO: Implement anime info update function in queries.ts
      console.log(`Refreshed data for anime: ${animeData.title} (MAL ID: ${malId})`);

      return {
        id: existingEntry.id,
        malId: existingEntry.animeInfo.malId,
        title: animeData.title,
        titleEnglish: animeData.alternative_titles?.en || existingEntry.animeInfo.titleEnglish,
        titleJapanese: animeData.alternative_titles?.ja || existingEntry.animeInfo.titleJapanese,
        imageUrl: animeData.main_picture?.large || animeData.main_picture?.medium || existingEntry.animeInfo.imageUrl,
        rating: animeData.mean || existingEntry.animeInfo.rating,
        premiereDate: animeData.start_date ? new Date(animeData.start_date) : (existingEntry.animeInfo.premiereDate ? new Date(existingEntry.animeInfo.premiereDate) : null),
        numEpisodes: animeData.num_episodes || existingEntry.animeInfo.numEpisodes,
        episodeDuration: animeData.average_episode_duration ? Math.round(animeData.average_episode_duration / 60) : existingEntry.animeInfo.episodeDuration,
        animeType: animeData.media_type || existingEntry.animeInfo.animeType,
        status: animeData.status || existingEntry.animeInfo.status,
        source: animeData.source || existingEntry.animeInfo.source,
        studios: animeData.studios?.map(studio => studio.name) || (existingEntry.animeInfo.studios ? JSON.parse(existingEntry.animeInfo.studios) : null),
        genres: animeData.genres?.map(genre => genre.name) || (existingEntry.animeInfo.genres ? JSON.parse(existingEntry.animeInfo.genres) : null),
        priority: existingEntry.priority,
        watchStatus: existingEntry.watchStatus,
        userRating: existingEntry.userRating,
        notes: existingEntry.notes,
        createdAt: new Date(existingEntry.createdAt),
        updatedAt: new Date(),
      };

    } catch (error) {
      const handledError = handleMyAnimeListError(error);
      logError(handledError, 'AnimeService.refreshAnimeData');
      throw handledError;
    }
  }

  /**
   * Validate MyAnimeList URL without adding to database
   */
  async validateAnimeUrl(url: string): Promise<{
    isValid: boolean;
    malId?: number;
    title?: string;
    error?: string;
  }> {
    try {
      // Parse URL
      const parsedUrl = parseMyAnimeListUrl(url);
      if (!parsedUrl.isValid) {
        return {
          isValid: false,
          error: parsedUrl.error,
        };
      }

      const malId = parsedUrl.malId;

      // Check if already exists in watchlist
      const existingEntry = await getWatchlistEntryByMalId(malId);
      if (existingEntry) {
        return {
          isValid: false,
          malId,
          title: existingEntry.animeInfo.title,
          error: 'This anime is already in your watchlist',
        };
      }

      // Validate by fetching basic data from MyAnimeList
      const { animeData } = await retryWithBackoff(
        () => this.malService.getAnimeInfo(malId),
        2,
        'AnimeService.validateAnimeUrl'
      );

      return {
        isValid: true,
        malId,
        title: animeData.title,
      };

    } catch (error) {
      const handledError = handleMyAnimeListError(error);
      logError(handledError, 'AnimeService.validateAnimeUrl');

      return {
        isValid: false,
        error: handledError.message,
      };
    }
  }

  /**
   * Check if MyAnimeList API is configured and working
   */
  async checkApiStatus(): Promise<{
    isConfigured: boolean;
    isWorking: boolean;
    error?: string;
  }> {
    const isConfigured = this.malService.isConfigured();

    if (!isConfigured) {
      return {
        isConfigured: false,
        isWorking: false,
        error: 'MyAnimeList API credentials not configured',
      };
    }

    try {
      const isWorking = await this.malService.testConnection();
      return {
        isConfigured: true,
        isWorking,
      };
    } catch (error) {
      return {
        isConfigured: true,
        isWorking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process related anime to build comprehensive timeline data
   * Fetches and stores anime info for all related anime
   */
  private async processRelatedAnime(relationships: any[]): Promise<void> {
    if (relationships.length === 0) {
      return;
    }

    try {
      // Extract unique MAL IDs from relationships
      const relatedMalIds = new Set<number>();
      for (const rel of relationships) {
        relatedMalIds.add(rel.targetMalId);
      }

      console.log(`🔍 Processing ${relatedMalIds.size} related anime`);

      // Check which anime we already have in the database
      const { getAnimeInfoByMalIds } = await import('../../db/queries.js');
      const existingAnime = await getAnimeInfoByMalIds(Array.from(relatedMalIds));
      const existingMalIds = new Set(existingAnime.map(anime => anime.malId));

      // Filter to only anime we don't have yet
      const missingMalIds = Array.from(relatedMalIds).filter(malId => !existingMalIds.has(malId));

      if (missingMalIds.length === 0) {
        console.log(`✅ All related anime already exist in database`);
        return;
      }

      console.log(`📥 Fetching data for ${missingMalIds.length} missing related anime`);

      // Batch fetch comprehensive data for missing anime
      const batchResult = await this.malService.batchGetComprehensiveAnimeInfo(missingMalIds);

      if (batchResult.success.length > 0) {
        console.log(`💾 Storing ${batchResult.success.length} related anime`);

        // Store anime info and relationships for each successfully fetched anime
        const { upsertAnimeInfo, batchInsertAnimeRelationships } = await import('../../db/queries.js');

        // First pass: Store all anime info
        for (const result of batchResult.success) {
          await upsertAnimeInfo({
            malId: result.animeInfo.malId,
            title: result.animeInfo.title,
            titleEnglish: result.animeInfo.titleEnglish,
            titleJapanese: result.animeInfo.titleJapanese,
            imageUrl: result.animeInfo.imageUrl,
            rating: result.animeInfo.rating,
            premiereDate: result.animeInfo.premiereDate?.toISOString() || null,
            numEpisodes: result.animeInfo.numEpisodes,
            episodeDuration: result.animeInfo.episodeDuration,
            animeType: result.animeInfo.animeType,
            status: result.animeInfo.status,
            source: result.animeInfo.source,
            studios: result.animeInfo.studios.length > 0 ? JSON.stringify(result.animeInfo.studios) : null,
            genres: result.animeInfo.genres.length > 0 ? JSON.stringify(result.animeInfo.genres) : null,
          });
        }

        // Second pass: Store all relationships after all anime info is in database
        for (const result of batchResult.success) {
          if (result.relationships.length > 0) {
            await batchInsertAnimeRelationships(result.relationships);
          }
        }
      }

      if (batchResult.errors.length > 0) {
        console.warn(`⚠️ Failed to fetch ${batchResult.errors.length} related anime:`,
          batchResult.errors.map(e => `MAL ID ${e.malId}: ${e.error.message}`));
      }

      console.log(`✅ Completed processing related anime: ${batchResult.success.length} successful, ${batchResult.errors.length} failed`);

    } catch (error) {
      console.error('❌ Error processing related anime:', error);
      // Don't throw - this is a background process that shouldn't fail the main operation
    }
  }

  /**
   * Get service statistics
   */
  getServiceInfo(): {
    name: string;
    version: string;
    apiConfigured: boolean;
  } {
    return {
      name: 'Project Claw Anime Service',
      version: '1.0.0',
      apiConfigured: this.malService.isConfigured(),
    };
  }
}