import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportService } from './export-service.js';
import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { ExportData } from '../../types/export-import.js';

// Mock the database connection
vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn()
    }))
  }
}));

// Mock crypto module
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-checksum-hash')
    }))
  };
});

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(() => JSON.stringify({ version: '1.0.0' }))
  };
});

describe('ExportService', () => {
  let exportService: ExportService;
  let mockDbSelect: any;

  const mockAnimeData = [
    {
      id: 1,
      malId: 1001,
      title: 'Test Anime 1',
      titleEnglish: 'Test Anime 1 EN',
      titleJapanese: 'テストアニメ1',
      imageUrl: 'https://example.com/image1.jpg',
      rating: 8.5,
      premiereDate: '2023-01-01',
      numEpisodes: 12,
      episodeDuration: 24,
      animeType: 'TV',
      status: 'finished_airing',
      source: 'manga',
      studios: '["Studio A"]',
      genres: '["Action", "Drama"]',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    },
    {
      id: 2,
      malId: 1002,
      title: 'Test Anime 2',
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
      studios: null,
      genres: null,
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z'
    }
  ];

  const mockWatchlistData = [
    {
      id: 1,
      animeInfoId: 1,
      priority: 1,
      watchStatus: 'completed',
      userRating: 9.0,
      notes: 'Great anime!',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    },
    {
      id: 2,
      animeInfoId: 2,
      priority: 2,
      watchStatus: 'plan_to_watch',
      userRating: null,
      notes: null,
      createdAt: '2023-01-02T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z'
    }
  ];

  const mockRelationshipsData = [
    {
      id: 1,
      sourceMalId: 1001,
      targetMalId: 1002,
      relationshipType: 'sequel',
      createdAt: '2023-01-01T00:00:00Z'
    }
  ];

  const mockTimelineCacheData = [
    {
      id: 1,
      rootMalId: 1001,
      timelineData: '{"nodes": [], "edges": []}',
      cacheVersion: 1,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    exportService = new ExportService();
    mockDbSelect = vi.mocked(db.select);
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock behavior
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([])
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractAllData', () => {
    it('should extract all data from database tables', async () => {
      // Mock database responses
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce(mockAnimeData)
        .mockResolvedValueOnce(mockWatchlistData)
        .mockResolvedValueOnce(mockRelationshipsData)
        .mockResolvedValueOnce(mockTimelineCacheData);

      const result = await exportService.extractAllData();

      expect(result).toEqual({
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: mockTimelineCacheData
      });

      // Verify database calls
      expect(db.select).toHaveBeenCalledTimes(4);
      expect(mockFrom).toHaveBeenCalledTimes(4);
    });

    it('should handle database errors gracefully', async () => {
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(exportService.extractAllData()).rejects.toThrow(
        'Failed to extract database data: Database connection failed'
      );
    });

    it('should handle empty database tables', async () => {
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await exportService.extractAllData();

      expect(result).toEqual({
        animeInfo: [],
        userWatchlist: [],
        animeRelationships: [],
        timelineCache: []
      });
    });
  });

  describe('validateDataIntegrity', () => {
    it('should validate data with no integrity issues', async () => {
      const testData = {
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: mockTimelineCacheData
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect orphaned watchlist entries', async () => {
      const testData = {
        animeInfo: mockAnimeData,
        userWatchlist: [
          ...mockWatchlistData,
          {
            id: 3,
            animeInfoId: 999, // Non-existent anime
            priority: 3,
            watchStatus: 'watching',
            userRating: null,
            notes: null,
            createdAt: '2023-01-03T00:00:00Z',
            updatedAt: '2023-01-03T00:00:00Z'
          }
        ],
        animeRelationships: mockRelationshipsData,
        timelineCache: mockTimelineCacheData
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Watchlist entry 3 references non-existent anime_info_id 999');
    });

    it('should detect invalid relationship references', async () => {
      const testData = {
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: [
          {
            id: 1,
            sourceMalId: 9999, // Non-existent MAL ID
            targetMalId: 1002,
            relationshipType: 'sequel',
            createdAt: '2023-01-01T00:00:00Z'
          }
        ],
        timelineCache: mockTimelineCacheData
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Relationship 1 references non-existent source MAL ID 9999');
    });

    it('should detect duplicate MAL IDs', async () => {
      const testData = {
        animeInfo: [
          ...mockAnimeData,
          {
            ...mockAnimeData[0],
            id: 3,
            malId: 1001 // Duplicate MAL ID
          }
        ],
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: mockTimelineCacheData
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate MAL ID 1001 found 2 times in anime_info');
    });

    it('should detect invalid JSON in timeline cache', async () => {
      const testData = {
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: [
          {
            id: 1,
            rootMalId: 1001,
            timelineData: 'invalid json{', // Invalid JSON
            cacheVersion: 1,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        ]
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timeline cache 1 contains invalid JSON data');
    });

    it('should generate warnings for timeline cache with missing MAL IDs', async () => {
      const testData = {
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: [
          {
            id: 1,
            rootMalId: 9999, // MAL ID not in current dataset
            timelineData: '{"nodes": [], "edges": []}',
            cacheVersion: 1,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        ]
      };

      const result = await exportService.validateDataIntegrity(testData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Timeline cache 1 references MAL ID 9999 that may not exist in current dataset');
    });
  });

  describe('exportAllData', () => {
    beforeEach(() => {
      // Mock successful data extraction
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce(mockAnimeData)
        .mockResolvedValueOnce(mockWatchlistData)
        .mockResolvedValueOnce(mockRelationshipsData)
        .mockResolvedValueOnce(mockTimelineCacheData);
    });

    it('should generate complete export data with metadata', async () => {
      const result = await exportService.exportAllData();

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('data');

      // Check metadata structure
      expect(result.metadata).toHaveProperty('version', '1.0.0');
      expect(result.metadata).toHaveProperty('exportDate');
      expect(result.metadata).toHaveProperty('totalRecords', 6); // 2 + 2 + 1 + 1
      expect(result.metadata).toHaveProperty('checksum');
      expect(result.metadata).toHaveProperty('application');
      expect(result.metadata.application).toHaveProperty('name', 'Project Claw');
      expect(result.metadata.application).toHaveProperty('version');

      // Check data structure
      expect(result.data).toEqual({
        animeInfo: mockAnimeData,
        userWatchlist: mockWatchlistData,
        animeRelationships: mockRelationshipsData,
        timelineCache: mockTimelineCacheData
      });
    });

    it('should fail if data integrity validation fails', async () => {
      // Mock data with integrity issues
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce(mockAnimeData)
        .mockResolvedValueOnce([
          {
            id: 1,
            animeInfoId: 999, // Non-existent anime
            priority: 1,
            watchStatus: 'completed',
            userRating: 9.0,
            notes: 'Great anime!',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        ])
        .mockResolvedValueOnce(mockRelationshipsData)
        .mockResolvedValueOnce(mockTimelineCacheData);

      await expect(exportService.exportAllData()).rejects.toThrow(
        'Data integrity validation failed'
      );
    });
  });

  describe('generateExportFile', () => {
    beforeEach(() => {
      // Mock successful data extraction
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce(mockAnimeData)
        .mockResolvedValueOnce(mockWatchlistData)
        .mockResolvedValueOnce(mockRelationshipsData)
        .mockResolvedValueOnce(mockTimelineCacheData);
    });

    it('should generate export file as Buffer', async () => {
      const result = await exportService.generateExportFile();

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify the buffer contains valid JSON
      const jsonString = result.toString('utf-8');
      const parsedData = JSON.parse(jsonString);
      
      expect(parsedData).toHaveProperty('metadata');
      expect(parsedData).toHaveProperty('data');
    });

    it('should handle export errors gracefully', async () => {
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockRejectedValueOnce(new Error('Database error'));

      await expect(exportService.generateExportFile()).rejects.toThrow(
        'Failed to generate export file'
      );
    });
  });

  describe('getExportMetadata', () => {
    beforeEach(() => {
      // Mock successful data extraction
      const mockFrom = vi.fn();
      mockDbSelect.mockReturnValue({ from: mockFrom } as any);
      
      mockFrom
        .mockResolvedValueOnce(mockAnimeData)
        .mockResolvedValueOnce(mockWatchlistData)
        .mockResolvedValueOnce(mockRelationshipsData)
        .mockResolvedValueOnce(mockTimelineCacheData);
    });

    it('should return export metadata without generating full file', async () => {
      const result = await exportService.getExportMetadata();

      expect(result).toHaveProperty('estimatedSize');
      expect(result).toHaveProperty('recordCounts');
      expect(result).toHaveProperty('schemaVersion', '1.0.0');

      expect(result.recordCounts).toEqual({
        animeInfo: 2,
        userWatchlist: 2,
        animeRelationships: 1,
        timelineCache: 1,
        total: 6
      });

      expect(result.estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('verifyExportData', () => {
    it('should verify valid export data', async () => {
      const validExportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00.000Z',
          totalRecords: 6,
          checksum: '6233d876a77d633b41fecfa7b18691444dba726548dd386a4daa23b674ca87ee', // Use actual checksum
          application: {
            name: 'Project Claw',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: mockAnimeData,
          userWatchlist: mockWatchlistData,
          animeRelationships: mockRelationshipsData,
          timelineCache: mockTimelineCacheData
        }
      };

      const result = await exportService.verifyExportData(validExportData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.checksumValid).toBe(true);
    });

    it('should detect checksum mismatch', async () => {
      const invalidExportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2023-01-01T00:00:00.000Z',
          totalRecords: 6,
          checksum: 'wrong-checksum',
          application: {
            name: 'Project Claw',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: mockAnimeData,
          userWatchlist: mockWatchlistData,
          animeRelationships: mockRelationshipsData,
          timelineCache: mockTimelineCacheData
        }
      };

      const result = await exportService.verifyExportData(invalidExportData);

      expect(result.isValid).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errors).toContain('Checksum mismatch: expected wrong-checksum, got 6233d876a77d633b41fecfa7b18691444dba726548dd386a4daa23b674ca87ee');
    });
  });
});