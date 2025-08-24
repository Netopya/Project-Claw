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
   * Add anime from MyAnimeList URL
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

      // Fetch anime data from MyAnimeList with retry logic
      const { animeData, seriesInfo } = await retryWithBackoff(
        () => this.malService.getAnimeInfo(malId),
        3,
        'AnimeService.addAnimeFromUrl'
      );

      // Transform data to our new format
      const watchlistData = {
        malId: animeData.id,
        title: animeData.title,
        titleEnglish: animeData.alternative_titles?.en || null,
        titleJapanese: animeData.alternative_titles?.ja || null,
        imageUrl: animeData.main_picture?.large || animeData.main_picture?.medium || null,
        rating: animeData.mean || null,
        premiereDate: animeData.start_date ? new Date(animeData.start_date) : null,
        numEpisodes: animeData.num_episodes || null,
        episodeDuration: animeData.average_episode_duration ? Math.round(animeData.average_episode_duration / 60) : null,
        animeType: animeData.media_type || 'unknown',
        status: animeData.status || null,
        source: animeData.source || null,
        studios: animeData.studios?.map(studio => studio.name) || [],
        genres: animeData.genres?.map(genre => genre.name) || [],
        watchStatus: 'plan_to_watch',
      };

      // Add to watchlist
      const newEntry = await addAnimeToWatchlist(watchlistData);

      console.log(`Successfully added anime to watchlist: ${newEntry.animeInfo.title} (MAL ID: ${malId})`);
      
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