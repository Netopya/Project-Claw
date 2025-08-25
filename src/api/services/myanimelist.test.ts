import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MyAnimeListService } from './myanimelist.js';
import type { EnhancedMyAnimeListResponse } from './myanimelist.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock headers
const createMockHeaders = (headerMap: Map<string, string> = new Map()) => ({
  get: (key: string) => headerMap.get(key) || null
});

describe('MyAnimeListService', () => {
  let service: MyAnimeListService;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    service = new MyAnimeListService('test-client-id', 'test-client-secret');
    mockFetch.mockClear();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('Configuration', () => {
    it('should be configured with valid credentials', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should not be configured without credentials', () => {
      // Create service with empty credentials
      const unconfiguredService = new MyAnimeListService('', '');
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('fetchAnimeData', () => {
    const mockAnimeResponse: EnhancedMyAnimeListResponse = {
      id: 1,
      title: 'Cowboy Bebop',
      alternative_titles: {
        en: 'Cowboy Bebop',
        ja: 'カウボーイビバップ'
      },
      main_picture: {
        medium: 'https://example.com/medium.jpg',
        large: 'https://example.com/large.jpg'
      },
      mean: 8.78,
      start_date: '1998-04-03',
      end_date: '1999-04-24',
      num_episodes: 26,
      average_episode_duration: 1440, // 24 minutes in seconds
      media_type: 'tv',
      status: 'finished_airing',
      source: 'original',
      studios: [
        { id: 14, name: 'Sunrise' }
      ],
      genres: [
        { id: 1, name: 'Action' },
        { id: 8, name: 'Drama' }
      ],
      related_anime: [
        {
          node: {
            id: 5,
            title: 'Cowboy Bebop: Tengoku no Tobira'
          },
          relation_type: 'side_story',
          relation_type_formatted: 'Side story'
        }
      ]
    };

    it('should fetch anime data successfully', async () => {
      const mockHeaders = new Map([
        ['X-RateLimit-Remaining', '100'],
        ['X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 3600)]
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnimeResponse,
        headers: createMockHeaders(mockHeaders)
      });

      const resultPromise = service.fetchAnimeData(1);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      
      expect(result).toEqual(mockAnimeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.myanimelist.net/v2/anime/1'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-MAL-CLIENT-ID': 'test-client-id'
          })
        })
      );
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: createMockHeaders()
      });

      await expect(service.fetchAnimeData(999999)).rejects.toThrow('Anime not found');
    });

    it('should handle rate limiting with retry', async () => {
      // First request fails with rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: createMockHeaders(new Map([['Retry-After', '2']]))
      });

      // Second request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnimeResponse,
        headers: createMockHeaders()
      });

      const resultPromise = service.fetchAnimeData(1);
      
      // Fast-forward time to trigger retry
      await vi.advanceTimersByTimeAsync(3000);
      
      const result = await resultPromise;
      expect(result).toEqual(mockAnimeResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchFetchAnimeData', () => {
    it('should batch fetch multiple anime successfully', async () => {
      const mockResponses = [
        { id: 1, title: 'Anime 1' },
        { id: 2, title: 'Anime 2' },
        { id: 3, title: 'Anime 3' }
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses[0],
          headers: createMockHeaders()
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses[1],
          headers: createMockHeaders()
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponses[2],
          headers: createMockHeaders()
        });

      const resultPromise = service.batchFetchAnimeData([1, 2, 3]);
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;
      
      expect(result.success).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.success.map(r => r.id)).toEqual([1, 2, 3]);
    });

    it('should handle partial failures in batch requests', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, title: 'Anime 1' }),
          headers: createMockHeaders()
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: createMockHeaders()
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 3, title: 'Anime 3' }),
          headers: createMockHeaders()
        });

      const resultPromise = service.batchFetchAnimeData([1, 2, 3]);
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;
      
      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].malId).toBe(2);
    });
  });

  describe('transformToAnimeInfo', () => {
    it('should transform API response to AnimeInfo structure', () => {
      const apiData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Cowboy Bebop',
        alternative_titles: {
          en: 'Cowboy Bebop',
          ja: 'カウボーイビバップ'
        },
        main_picture: {
          medium: 'https://example.com/medium.jpg',
          large: 'https://example.com/large.jpg'
        },
        mean: 8.78,
        start_date: '1998-04-03',
        num_episodes: 26,
        average_episode_duration: 1440, // 24 minutes in seconds
        media_type: 'tv',
        status: 'finished_airing',
        source: 'original',
        studios: [
          { id: 14, name: 'Sunrise' }
        ],
        genres: [
          { id: 1, name: 'Action' },
          { id: 8, name: 'Drama' }
        ]
      };

      const result = service.transformToAnimeInfo(apiData);

      expect(result).toEqual({
        malId: 1,
        title: 'Cowboy Bebop',
        titleEnglish: 'Cowboy Bebop',
        titleJapanese: 'カウボーイビバップ',
        imageUrl: 'https://example.com/large.jpg',
        rating: 8.78,
        premiereDate: new Date('1998-04-03'),
        numEpisodes: 26,
        episodeDuration: 24, // Converted from seconds to minutes
        animeType: 'tv',
        status: 'finished_airing',
        source: 'original',
        studios: ['Sunrise'],
        genres: ['Action', 'Drama']
      });
    });

    it('should handle missing optional fields', () => {
      const minimalApiData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Test Anime'
      };

      const result = service.transformToAnimeInfo(minimalApiData);

      expect(result).toEqual({
        malId: 1,
        title: 'Test Anime',
        titleEnglish: null,
        titleJapanese: null,
        imageUrl: null,
        rating: null,
        premiereDate: null,
        numEpisodes: null,
        episodeDuration: null,
        animeType: 'unknown',
        status: null,
        source: null,
        studios: [],
        genres: []
      });
    });
  });

  describe('processAnimeRelationships', () => {
    it('should process relationships correctly', async () => {
      const apiData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Test Anime',
        related_anime: [
          {
            node: { id: 2, title: 'Sequel' },
            relation_type: 'sequel',
            relation_type_formatted: 'Sequel'
          },
          {
            node: { id: 3, title: 'Prequel' },
            relation_type: 'prequel',
            relation_type_formatted: 'Prequel'
          }
        ]
      };

      const relationships = await service.processAnimeRelationships(apiData);

      expect(relationships).toHaveLength(2);
      expect(relationships[0]).toEqual({
        sourceMalId: 1,
        targetMalId: 2,
        relationshipType: 'sequel',
        createdAt: expect.any(String)
      });
      expect(relationships[1]).toEqual({
        sourceMalId: 1,
        targetMalId: 3,
        relationshipType: 'prequel',
        createdAt: expect.any(String)
      });
    });

    it('should return empty array for no relationships', async () => {
      const apiData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Test Anime'
      };

      const relationships = await service.processAnimeRelationships(apiData);
      expect(relationships).toEqual([]);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit information', async () => {
      const mockHeaders = new Map([
        ['X-RateLimit-Remaining', '50'],
        ['X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 3600)]
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, title: 'Test' }),
        headers: createMockHeaders(mockHeaders)
      });

      const resultPromise = service.fetchAnimeData(1);
      await vi.advanceTimersByTimeAsync(1000);
      await resultPromise;
      
      const rateLimitInfo = service.getRateLimitInfo();
      expect(rateLimitInfo).toBeTruthy();
      expect(rateLimitInfo?.remaining).toBe(50);
    });

    it('should detect when rate limited', async () => {
      const mockHeaders = new Map([
        ['X-RateLimit-Remaining', '0'],
        ['X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 3600)]
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, title: 'Test' }),
        headers: createMockHeaders(mockHeaders)
      });

      const resultPromise = service.fetchAnimeData(1);
      await vi.advanceTimersByTimeAsync(1000);
      await resultPromise;
      
      expect(service.isRateLimited()).toBe(true);
      expect(service.getRateLimitWaitTime()).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate complete anime data', () => {
      const completeData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Complete Anime',
        main_picture: { medium: 'test.jpg', large: 'test.jpg' },
        start_date: '2023-01-01',
        num_episodes: 12,
        media_type: 'tv'
      };

      const validation = service.validateAnimeData(completeData);
      
      expect(validation.isValid).toBe(true);
      expect(validation.missingFields).toEqual([]);
      expect(validation.warnings).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const incompleteData = {} as EnhancedMyAnimeListResponse;

      const validation = service.validateAnimeData(incompleteData);
      
      expect(validation.isValid).toBe(false);
      expect(validation.missingFields).toContain('id');
      expect(validation.missingFields).toContain('title');
    });

    it('should warn about missing optional fields', () => {
      const minimalData: EnhancedMyAnimeListResponse = {
        id: 1,
        title: 'Minimal Anime'
      };

      const validation = service.validateAnimeData(minimalData);
      
      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toContain('main_picture');
      expect(validation.warnings).toContain('start_date');
      expect(validation.warnings).toContain('num_episodes');
      expect(validation.warnings).toContain('media_type');
    });
  });

  describe('Service Management', () => {
    it('should provide service status information', () => {
      expect(service.isConfigured()).toBe(true);
      expect(service.getRateLimitInfo()).toBeNull();
    });

    it('should handle service configuration properly', () => {
      const unconfiguredService = new MyAnimeListService('', '');
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });
});