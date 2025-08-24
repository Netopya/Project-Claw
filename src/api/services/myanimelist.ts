import type { MyAnimeListResponse, SeriesInfo } from '../../types/anime.js';
import type { 
  AnimeInfo, 
  AnimeRelationship, 
  AnimeType, 
  AnimeStatus, 
  RelationshipType 
} from '../../types/timeline.js';

// Enhanced API response interfaces
export interface EnhancedMyAnimeListResponse extends MyAnimeListResponse {
  broadcast?: {
    day_of_the_week?: string;
    start_time?: string;
  };
  rating?: string;
  synopsis?: string;
}

export interface BatchRequestResult<T> {
  success: T[];
  errors: Array<{
    malId: number;
    error: Error;
  }>;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * Enhanced MyAnimeList API integration service with comprehensive data fetching
 */
export class MyAnimeListService {
  private clientId: string;
  private clientSecret: string;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1 second between requests
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 10; // Process requests in batches
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId !== undefined ? clientId : (process.env.MAL_CLIENT_ID || '');
    this.clientSecret = clientSecret !== undefined ? clientSecret : (process.env.MAL_CLIENT_SECRET || '');
    
    if (!this.clientId) {
      console.warn('MyAnimeList API credentials not configured. Some features may not work.');
    }
  }

  /**
   * Validate client ID is configured
   */
  private validateClientId(): void {
    if (!this.clientId) {
      throw new Error('MyAnimeList API credentials not configured');
    }
  }

  /**
   * Wait for rate limit delay
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest));
    }
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    if (!response || !response.headers) {
      return;
    }

    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const retryAfter = response.headers.get('Retry-After');

    if (remaining && reset) {
      this.rateLimitInfo = {
        remaining: parseInt(remaining, 10),
        resetTime: new Date(parseInt(reset, 10) * 1000),
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
      };
    }
  }

  /**
   * Make rate-limited API request with comprehensive error handling
   */
  private async makeRequest<T>(url: string, retryCount = 0): Promise<T> {
    try {
      // Check rate limit before making request
      if (this.rateLimitInfo && this.rateLimitInfo.remaining <= 0) {
        const waitTime = this.rateLimitInfo.resetTime.getTime() - Date.now();
        if (waitTime > 0) {
          console.log(`Rate limit exceeded. Waiting ${waitTime}ms before retry.`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Ensure minimum delay between requests
      await this.waitForRateLimit();

      this.validateClientId();
      const response = await fetch(url, {
        headers: {
          'X-MAL-CLIENT-ID': this.clientId,
          'Content-Type': 'application/json',
        },
      });

      this.lastRequestTime = Date.now();

      // Validate response object
      if (!response) {
        throw new Error('No response received from API');
      }

      // Update rate limit info from response headers
      this.updateRateLimitInfo(response);

      if (!response.ok) {
        return this.handleApiError(response, url, retryCount);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return this.handleRequestError(error as Error, url, retryCount);
    }
  }

  /**
   * Handle API errors with retry logic
   */
  private async handleApiError<T>(response: Response, url: string, retryCount: number): Promise<T> {
    if (response.status === 429) {
      // Rate limit exceeded
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.REQUEST_DELAY * Math.pow(2, retryCount);
      
      if (retryCount < this.MAX_RETRIES) {
        console.log(`Rate limit exceeded. Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.makeRequest<T>(url, retryCount + 1);
      } else {
        throw new Error(`Rate limit exceeded. Max retries (${this.MAX_RETRIES}) reached.`);
      }
    }

    if (response.status === 404) {
      throw new Error('Anime not found');
    }

    if (response.status >= 500 && retryCount < this.MAX_RETRIES) {
      // Server error - retry with exponential backoff
      const waitTime = this.REQUEST_DELAY * Math.pow(2, retryCount);
      console.log(`Server error (${response.status}). Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.makeRequest<T>(url, retryCount + 1);
    }

    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  /**
   * Handle request errors (network issues, etc.)
   */
  private async handleRequestError<T>(error: Error, url: string, retryCount: number): Promise<T> {
    if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
      const waitTime = this.REQUEST_DELAY * Math.pow(2, retryCount);
      console.log(`Request error: ${error.message}. Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.makeRequest<T>(url, retryCount + 1);
    }

    throw error;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'fetch failed'
    ];
    
    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  /**
   * Fetch comprehensive anime data from MyAnimeList API
   */
  async fetchAnimeData(malId: number): Promise<EnhancedMyAnimeListResponse> {
    try {
      const fields = [
        'title',
        'alternative_titles',
        'main_picture',
        'mean',
        'start_date',
        'end_date',
        'num_episodes',
        'average_episode_duration',
        'media_type',
        'status',
        'source',
        'studios',
        'genres',
        'related_anime',
        'broadcast',
        'rating',
        'synopsis'
      ].join(',');

      const url = `https://api.myanimelist.net/v2/anime/${malId}?fields=${fields}`;
      const data = await this.makeRequest<EnhancedMyAnimeListResponse>(url);

      return data;
    } catch (error) {
      console.error(`Failed to fetch anime data for ID ${malId}:`, error);
      throw error;
    }
  }

  /**
   * Batch fetch multiple anime data with error handling
   */
  async batchFetchAnimeData(malIds: number[]): Promise<BatchRequestResult<EnhancedMyAnimeListResponse>> {
    const results: BatchRequestResult<EnhancedMyAnimeListResponse> = {
      success: [],
      errors: []
    };

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < malIds.length; i += this.BATCH_SIZE) {
      const batch = malIds.slice(i, i + this.BATCH_SIZE);
      const batchPromises = batch.map(async (malId) => {
        try {
          const data = await this.fetchAnimeData(malId);
          return { success: true, data, malId };
        } catch (error) {
          return { success: false, error: error as Error, malId };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.success.push(result.value.data);
          } else {
            results.errors.push({
              malId: result.value.malId,
              error: result.value.error
            });
          }
        } else {
          // This shouldn't happen with our error handling, but just in case
          console.error('Unexpected batch result rejection:', result.reason);
        }
      }

      // Add delay between batches to respect rate limits
      if (i + this.BATCH_SIZE < malIds.length) {
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
      }
    }

    return results;
  }

  /**
   * Process comprehensive relationship data from MyAnimeList API responses
   */
  async processAnimeRelationships(animeData: EnhancedMyAnimeListResponse): Promise<AnimeRelationship[]> {
    if (!animeData.related_anime || animeData.related_anime.length === 0) {
      return [];
    }

    const relationships: AnimeRelationship[] = [];
    
    try {
      for (const relatedAnime of animeData.related_anime) {
        const relationshipType = this.mapRelationshipType(relatedAnime.relation_type);
        
        relationships.push({
          id: 0, // Will be set by database
          sourceMalId: animeData.id,
          targetMalId: relatedAnime.node.id,
          relationshipType,
          createdAt: new Date()
        });
      }

      return relationships;
    } catch (error) {
      console.error('Failed to process anime relationships:', error);
      return [];
    }
  }

  /**
   * Map MyAnimeList relationship types to our internal types
   */
  private mapRelationshipType(malRelationType: string): RelationshipType {
    const relationshipMap: Record<string, RelationshipType> = {
      'sequel': 'sequel',
      'prequel': 'prequel',
      'side_story': 'side_story',
      'alternative_version': 'alternative_version',
      'alternative_setting': 'alternative_setting',
      'parent_story': 'parent_story',
      'spin_off': 'spin_off',
      'adaptation': 'adaptation',
      'character': 'character',
      'summary': 'summary',
      'full_story': 'full_story',
      'other': 'other'
    };

    return relationshipMap[malRelationType.toLowerCase()] || 'other';
  }

  /**
   * Transform MyAnimeList API response to AnimeInfo structure
   */
  transformToAnimeInfo(apiData: EnhancedMyAnimeListResponse): Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      malId: apiData.id,
      title: apiData.title,
      titleEnglish: apiData.alternative_titles?.en || null,
      titleJapanese: apiData.alternative_titles?.ja || null,
      imageUrl: apiData.main_picture?.large || apiData.main_picture?.medium || null,
      rating: apiData.mean || null,
      premiereDate: apiData.start_date ? new Date(apiData.start_date) : null,
      numEpisodes: apiData.num_episodes || null,
      episodeDuration: apiData.average_episode_duration ? Math.round(apiData.average_episode_duration / 60) : null, // Convert seconds to minutes
      animeType: this.mapAnimeType(apiData.media_type),
      status: this.mapAnimeStatus(apiData.status),
      source: apiData.source || null,
      studios: apiData.studios?.map(studio => studio.name) || [],
      genres: apiData.genres?.map(genre => genre.name) || []
    };
  }

  /**
   * Map MyAnimeList media type to our AnimeType
   */
  private mapAnimeType(malMediaType?: string): AnimeType {
    if (!malMediaType) return 'unknown';
    
    const typeMap: Record<string, AnimeType> = {
      'tv': 'tv',
      'movie': 'movie',
      'ova': 'ova',
      'special': 'special',
      'ona': 'ona',
      'music': 'music'
    };

    return typeMap[malMediaType.toLowerCase()] || 'unknown';
  }

  /**
   * Map MyAnimeList status to our AnimeStatus
   */
  private mapAnimeStatus(malStatus?: string): AnimeStatus | null {
    if (!malStatus) return null;
    
    const statusMap: Record<string, AnimeStatus> = {
      'finished_airing': 'finished_airing',
      'currently_airing': 'currently_airing',
      'not_yet_aired': 'not_yet_aired'
    };

    return statusMap[malStatus.toLowerCase()] || null;
  }

  /**
   * Batch transform multiple API responses to AnimeInfo structures
   */
  batchTransformToAnimeInfo(apiDataList: EnhancedMyAnimeListResponse[]): Array<Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'>> {
    return apiDataList.map(apiData => this.transformToAnimeInfo(apiData));
  }

  /**
   * Get comprehensive anime information including relationships
   */
  async getComprehensiveAnimeInfo(malId: number): Promise<{
    animeInfo: Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'>;
    relationships: AnimeRelationship[];
    seriesInfo: SeriesInfo | null;
  }> {
    try {
      const apiData = await this.fetchAnimeData(malId);
      const animeInfo = this.transformToAnimeInfo(apiData);
      const relationships = await this.processAnimeRelationships(apiData);
      const seriesInfo = await this.processSeriesRelationships(apiData);

      return {
        animeInfo,
        relationships,
        seriesInfo,
      };
    } catch (error) {
      console.error(`Failed to get comprehensive anime info for ID ${malId}:`, error);
      throw error;
    }
  }

  /**
   * Batch get comprehensive anime information
   */
  async batchGetComprehensiveAnimeInfo(malIds: number[]): Promise<{
    success: Array<{
      animeInfo: Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'>;
      relationships: AnimeRelationship[];
      seriesInfo: SeriesInfo | null;
    }>;
    errors: Array<{
      malId: number;
      error: Error;
    }>;
  }> {
    const batchResult = await this.batchFetchAnimeData(malIds);
    
    const success = batchResult.success.map(apiData => ({
      animeInfo: this.transformToAnimeInfo(apiData),
      relationships: this.processAnimeRelationships(apiData),
      seriesInfo: this.processSeriesRelationships(apiData)
    }));

    // Process relationships asynchronously
    const processedSuccess = await Promise.all(
      success.map(async (item) => ({
        animeInfo: item.animeInfo,
        relationships: await item.relationships,
        seriesInfo: await item.seriesInfo
      }))
    );

    return {
      success: processedSuccess,
      errors: batchResult.errors
    };
  }

  /**
   * Process series relationship data to determine series information (legacy support)
   */
  async processSeriesRelationships(animeData: EnhancedMyAnimeListResponse): Promise<SeriesInfo | null> {
    if (!animeData.related_anime || animeData.related_anime.length === 0) {
      return null;
    }

    try {
      const relatedAnime = animeData.related_anime;
      const sequels = relatedAnime.filter(r => r.relation_type === 'sequel');
      const prequels = relatedAnime.filter(r => r.relation_type === 'prequel');
      const relatedTitles = relatedAnime.map(r => r.node.title);

      const hasSequels = sequels.length > 0;
      const hasPrequels = prequels.length > 0;
      
      // Estimate series position (simplified approach)
      let currentPosition = 1;
      let totalSeries = 1;

      if (hasPrequels) {
        currentPosition += prequels.length;
        totalSeries += prequels.length;
      }

      if (hasSequels) {
        totalSeries += sequels.length;
      }

      return {
        totalSeries,
        currentPosition,
        hasSequels,
        hasPrequels,
        relatedTitles,
      };
    } catch (error) {
      console.error('Failed to process series relationships:', error);
      return null;
    }
  }

  /**
   * Get complete anime information including series data (legacy support)
   */
  async getAnimeInfo(malId: number): Promise<{
    animeData: EnhancedMyAnimeListResponse;
    seriesInfo: SeriesInfo | null;
  }> {
    try {
      const animeData = await this.fetchAnimeData(malId);
      const seriesInfo = await this.processSeriesRelationships(animeData);

      return {
        animeData,
        seriesInfo,
      };
    } catch (error) {
      console.error(`Failed to get anime info for ID ${malId}:`, error);
      throw error;
    }
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  /**
   * Check if we're currently rate limited
   */
  isRateLimited(): boolean {
    if (!this.rateLimitInfo) return false;
    
    return this.rateLimitInfo.remaining <= 0 && 
           this.rateLimitInfo.resetTime.getTime() > Date.now();
  }

  /**
   * Get estimated wait time until rate limit resets
   */
  getRateLimitWaitTime(): number {
    if (!this.rateLimitInfo || !this.isRateLimited()) return 0;
    
    return Math.max(0, this.rateLimitInfo.resetTime.getTime() - Date.now());
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.clientId && this.clientId.trim().length > 0;
  }

  /**
   * Test the API connection with comprehensive error reporting
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    rateLimitInfo?: RateLimitInfo;
  }> {
    try {
      this.validateClientId();
      // Test with a simple anime request (Cowboy Bebop - ID 1)
      await this.fetchAnimeData(1);
      
      return {
        success: true,
        rateLimitInfo: this.rateLimitInfo || undefined
      };
    } catch (error) {
      console.error('MyAnimeList API connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        rateLimitInfo: this.rateLimitInfo || undefined
      };
    }
  }

  /**
   * Get queue status information (simplified for new implementation)
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    lastRequestTime: Date | null;
  } {
    return {
      queueLength: 0, // No queue in simplified implementation
      isProcessing: false,
      lastRequestTime: this.lastRequestTime > 0 ? new Date(this.lastRequestTime) : null
    };
  }

  /**
   * Clear the request queue (no-op in simplified implementation)
   */
  clearQueue(): void {
    // No queue to clear in simplified implementation
  }

  /**
   * Validate that required anime data is present
   */
  validateAnimeData(apiData: EnhancedMyAnimeListResponse): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const missingFields: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!apiData.id) missingFields.push('id');
    if (!apiData.title) missingFields.push('title');

    // Important but not critical fields
    if (!apiData.main_picture) warnings.push('main_picture');
    if (!apiData.start_date) warnings.push('start_date');
    if (!apiData.num_episodes) warnings.push('num_episodes');
    if (!apiData.media_type) warnings.push('media_type');

    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings
    };
  }
}