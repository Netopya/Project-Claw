import type { MyAnimeListResponse, SeriesInfo } from '../../types/anime.js';

/**
 * MyAnimeList API integration service
 */
export class MyAnimeListService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 1000; // 1 second between requests

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.MAL_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.MAL_CLIENT_SECRET || '';
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('MyAnimeList API credentials not configured. Some features may not work.');
    }
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('MyAnimeList API credentials not configured');
    }

    try {
      const response = await fetch('https://myanimelist.net/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get MyAnimeList access token:', error);
      throw new Error('Failed to authenticate with MyAnimeList API');
    }
  }

  /**
   * Make rate-limited API request
   */
  private async makeRequest<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Ensure minimum delay between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.REQUEST_DELAY) {
            await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest));
          }

          const token = await this.getAccessToken();
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          this.lastRequestTime = Date.now();

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error('Rate limit exceeded. Please try again later.');
            }
            if (response.status === 404) {
              throw new Error('Anime not found');
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Request failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Fetch anime data from MyAnimeList API
   */
  async fetchAnimeData(malId: number): Promise<MyAnimeListResponse> {
    try {
      const fields = [
        'title',
        'alternative_titles',
        'main_picture',
        'mean',
        'start_date',
        'num_episodes',
        'related_anime'
      ].join(',');

      const url = `https://api.myanimelist.net/v2/anime/${malId}?fields=${fields}`;
      const data = await this.makeRequest<MyAnimeListResponse>(url);

      return data;
    } catch (error) {
      console.error(`Failed to fetch anime data for ID ${malId}:`, error);
      throw error;
    }
  }

  /**
   * Process series relationship data to determine series information
   */
  async processSeriesRelationships(animeData: MyAnimeListResponse): Promise<SeriesInfo | null> {
    if (!animeData.related_anime || animeData.related_anime.length === 0) {
      return null;
    }

    try {
      const relatedAnime = animeData.related_anime;
      const sequels = relatedAnime.filter(r => r.relation_type === 'sequel');
      const prequels = relatedAnime.filter(r => r.relation_type === 'prequel');
      const relatedTitles = relatedAnime.map(r => r.node.title);

      // For now, we'll do a simple calculation
      // In a more sophisticated implementation, we might fetch related anime data
      const hasSequels = sequels.length > 0;
      const hasPrequels = prequels.length > 0;
      
      // Estimate series position (this is a simplified approach)
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
   * Get complete anime information including series data
   */
  async getAnimeInfo(malId: number): Promise<{
    animeData: MyAnimeListResponse;
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
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      console.error('MyAnimeList API connection test failed:', error);
      return false;
    }
  }
}