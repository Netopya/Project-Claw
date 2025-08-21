import { MyAnimeListService } from './myanimelist.js';
import { parseMyAnimeListUrl } from '../utils/url-parser.js';
import { transformMyAnimeListData } from '../utils/data-transformer.js';
import { 
  handleMyAnimeListError, 
  ValidationError, 
  logError, 
  retryWithBackoff 
} from '../utils/error-handler.js';
import { getAnimeByMalId, addAnime } from '../../db/queries.js';
import type { Anime } from '../../types/anime.js';

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
  async addAnimeFromUrl(url: string): Promise<Anime> {
    try {
      // Parse and validate URL
      const parsedUrl = parseMyAnimeListUrl(url);
      if (!parsedUrl.isValid) {
        throw new ValidationError(parsedUrl.error || 'Invalid MyAnimeList URL');
      }

      const malId = parsedUrl.malId;

      // Check if anime already exists
      const existingAnime = await getAnimeByMalId(malId);
      if (existingAnime) {
        throw new ValidationError('This anime is already in your watchlist');
      }

      // Fetch anime data from MyAnimeList with retry logic
      const { animeData, seriesInfo } = await retryWithBackoff(
        () => this.malService.getAnimeInfo(malId),
        3,
        'AnimeService.addAnimeFromUrl'
      );

      // Transform data to our format
      const transformedData = transformMyAnimeListData(animeData, seriesInfo);

      // Add to database
      const newAnime = await addAnime(transformedData);

      console.log(`Successfully added anime: ${newAnime.title} (MAL ID: ${malId})`);
      return newAnime;

    } catch (error) {
      const handledError = handleMyAnimeListError(error);
      logError(handledError, 'AnimeService.addAnimeFromUrl');
      throw handledError;
    }
  }

  /**
   * Refresh anime data from MyAnimeList
   */
  async refreshAnimeData(malId: number): Promise<Anime | null> {
    try {
      const existingAnime = await getAnimeByMalId(malId);
      if (!existingAnime) {
        throw new ValidationError('Anime not found in watchlist');
      }

      // Fetch updated data from MyAnimeList
      const { animeData, seriesInfo } = await retryWithBackoff(
        () => this.malService.getAnimeInfo(malId),
        3,
        'AnimeService.refreshAnimeData'
      );

      // Transform data
      const transformedData = transformMyAnimeListData(animeData, seriesInfo);

      // Update in database (this would require an update function in queries.ts)
      // For now, we'll return the transformed data
      console.log(`Refreshed data for anime: ${transformedData.title} (MAL ID: ${malId})`);
      
      return {
        ...existingAnime,
        ...transformedData,
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

      // Check if already exists
      const existingAnime = await getAnimeByMalId(malId);
      if (existingAnime) {
        return {
          isValid: false,
          malId,
          title: existingAnime.title,
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