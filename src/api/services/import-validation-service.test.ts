import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ImportValidationService } from './import-validation-service.js';
import type { ExportData } from '../../types/export-import.js';

// Mock the database connection
vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  }
}));

// Mock the database schema
vi.mock('../../db/schema.js', () => ({
  animeInfo: {
    malId: 'malId',
    title: 'title',
    id: 'id'
  },
  userWatchlist: {
    animeInfoId: 'animeInfoId'
  }
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn()
}));

describe('ImportValidationService', () => {
  let service: ImportValidationService;

  beforeEach(() => {
    service = new ImportValidationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateImportFile', () => {
    it('should reject empty files', async () => {
      const emptyBuffer = Buffer.from('');
      
      const result = await service.validateImportFile(emptyBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_FILE');
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
      
      const result = await service.validateImportFile(largeBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
    });

    it('should reject invalid JSON', async () => {
      const invalidJsonBuffer = Buffer.from('{ invalid json }');
      
      const result = await service.validateImportFile(invalidJsonBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_JSON');
    });

    it('should reject non-object JSON', async () => {
      const arrayBuffer = Buffer.from('["not", "an", "object"]');
      
      const result = await service.validateImportFile(arrayBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // The array will be rejected because it's missing metadata and data sections
      expect(result.errors.some(e => e.code === 'MISSING_METADATA' || e.code === 'MISSING_DATA')).toBe(true);
    });

    it('should reject JSON missing metadata', async () => {
      const missingMetadataBuffer = Buffer.from(JSON.stringify({
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      }));
      
      const result = await service.validateImportFile(missingMetadataBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_METADATA')).toBe(true);
    });

    it('should reject JSON missing data section', async () => {
      const missingDataBuffer = Buffer.from(JSON.stringify({
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        }
      }));
      
      const result = await service.validateImportFile(missingDataBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_DATA')).toBe(true);
    });

    it('should reject unsupported newer schema version', async () => {
      const newerVersionData = {
        metadata: {
          version: '2.0.0', // Newer than supported
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      };
      
      const buffer = Buffer.from(JSON.stringify(newerVersionData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNSUPPORTED_NEWER_VERSION')).toBe(true);
    });

    it('should reject older schema version (migration not implemented)', async () => {
      const olderVersionData = {
        metadata: {
          version: '0.9.0', // Older than supported
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      };
      
      const buffer = Buffer.from(JSON.stringify(olderVersionData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MIGRATION_NOT_IMPLEMENTED')).toBe(true);
      expect(result.warnings.some(w => w.code === 'OLDER_SCHEMA_VERSION')).toBe(true);
    });

    it('should validate checksum correctly', async () => {
      const data = { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] };
      
      // Calculate checksum the same way the service does
      const dataString = JSON.stringify(data, Object.keys(data).sort());
      const checksum = require('crypto').createHash('sha256').update(dataString).digest('hex');
      
      const validData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum,
          application: { name: 'Test', version: '1.0.0' }
        },
        data
      };
      
      const buffer = Buffer.from(JSON.stringify(validData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect checksum mismatch', async () => {
      const validData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'invalid_checksum',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      };
      
      const buffer = Buffer.from(JSON.stringify(validData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CHECKSUM_MISMATCH')).toBe(true);
    });

    it('should detect duplicate MAL IDs in anime data', async () => {
      const data = {
        animeInfo: [
          { id: 1, malId: 123, title: 'Anime 1', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null },
          { id: 2, malId: 123, title: 'Anime 2', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null }
        ],
        userWatchlist: [],
        animeRelationships: [],
        timelineCache: []
      };
      
      const checksum = require('crypto').createHash('sha256').update(JSON.stringify(data, Object.keys(data).sort())).digest('hex');
      
      const exportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum,
          application: { name: 'Test', version: '1.0.0' }
        },
        data
      };
      
      const buffer = Buffer.from(JSON.stringify(exportData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_RECORD')).toBe(true);
    });

    it('should detect invalid foreign key references', async () => {
      const data = {
        animeInfo: [
          { id: 1, malId: 123, title: 'Anime 1', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null }
        ],
        userWatchlist: [
          { id: 1, animeInfoId: 999, priority: 1, watchStatus: 'plan_to_watch', userRating: null, notes: null, createdAt: null, updatedAt: null } // References non-existent anime
        ],
        animeRelationships: [],
        timelineCache: []
      };
      
      const checksum = require('crypto').createHash('sha256').update(JSON.stringify(data, Object.keys(data).sort())).digest('hex');
      
      const exportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum,
          application: { name: 'Test', version: '1.0.0' }
        },
        data
      };
      
      const buffer = Buffer.from(JSON.stringify(exportData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_FOREIGN_KEY' && e.table === 'userWatchlist')).toBe(true);
    });

    it('should detect invalid JSON in timeline cache', async () => {
      const data = {
        animeInfo: [
          { id: 1, malId: 123, title: 'Anime 1', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null }
        ],
        userWatchlist: [],
        animeRelationships: [],
        timelineCache: [
          { id: 1, rootMalId: 123, timelineData: '{ invalid json }', cacheVersion: 1, createdAt: null, updatedAt: null }
        ]
      };
      
      const checksum = require('crypto').createHash('sha256').update(JSON.stringify(data, Object.keys(data).sort())).digest('hex');
      
      const exportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 2,
          checksum,
          application: { name: 'Test', version: '1.0.0' }
        },
        data
      };
      
      const buffer = Buffer.from(JSON.stringify(exportData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_JSON_DATA' && e.table === 'timelineCache')).toBe(true);
    });
  });

  describe('validateFileFormat', () => {
    it('should accept .json files', () => {
      const result = service.validateFileFormat('export.json', 'application/json');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-json file extensions', () => {
      const result = service.validateFileFormat('export.txt');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_FILE_EXTENSION');
    });

    it('should reject invalid MIME types', () => {
      const result = service.validateFileFormat('export.json', 'application/pdf');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_MIME_TYPE');
    });

    it('should accept valid MIME types', () => {
      const validMimeTypes = ['application/json', 'text/json', 'text/plain'];
      
      for (const mimeType of validMimeTypes) {
        const result = service.validateFileFormat('export.json', mimeType);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('createImportPreview', () => {
    it('should create preview with summary and conflicts', async () => {
      // Mock database queries to return empty results (no conflicts)
      const mockDb = await import('../../db/connection.js');
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn().mockReturnThis()
      };
      vi.mocked(mockDb.db.select).mockReturnValue(mockQuery as any);

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 3,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            { id: 1, malId: 123, title: 'Anime 1', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null }
          ],
          userWatchlist: [
            { id: 1, animeInfoId: 1, priority: 1, watchStatus: 'plan_to_watch', userRating: null, notes: null, createdAt: null, updatedAt: null }
          ],
          animeRelationships: [
            { id: 1, sourceMalId: 123, targetMalId: 456, relationshipType: 'sequel', createdAt: null }
          ],
          timelineCache: []
        }
      };

      const preview = await service.createImportPreview(exportData);

      expect(preview.metadata).toEqual(exportData.metadata);
      expect(preview.summary).toEqual({
        animeInfo: 1,
        userWatchlist: 1,
        animeRelationships: 1,
        timelineCache: 0
      });
      expect(preview.conflicts).toBeDefined();
      expect(preview.schemaMigrationRequired).toBe(false);
      expect(preview.estimatedProcessingTime).toBeGreaterThan(0);
    });

    it('should detect schema migration requirement', async () => {
      const mockDb = await import('../../db/connection.js');
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn().mockReturnThis()
      };
      vi.mocked(mockDb.db.select).mockReturnValue(mockQuery as any);

      const exportData: ExportData = {
        metadata: {
          version: '0.9.0', // Different from current version
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const preview = await service.createImportPreview(exportData);

      expect(preview.schemaMigrationRequired).toBe(true);
    });
  });

  describe('getSupportedVersions', () => {
    it('should return array of supported versions', () => {
      const versions = service.getSupportedVersions();
      
      expect(Array.isArray(versions)).toBe(true);
      expect(versions).toContain('1.0.0');
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current schema version', () => {
      const version = service.getCurrentVersion();
      
      expect(typeof version).toBe('string');
      expect(version).toBe('1.0.0');
    });
  });

  describe('version comparison', () => {
    it('should correctly identify newer versions', async () => {
      const newerVersionData = {
        metadata: {
          version: '1.1.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      };
      
      const buffer = Buffer.from(JSON.stringify(newerVersionData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.errors.some(e => e.code === 'UNSUPPORTED_NEWER_VERSION')).toBe(true);
    });

    it('should correctly identify older versions', async () => {
      const olderVersionData = {
        metadata: {
          version: '0.8.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 0,
          checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: { animeInfo: [], userWatchlist: [], animeRelationships: [], timelineCache: [] }
      };
      
      const buffer = Buffer.from(JSON.stringify(olderVersionData));
      const result = await service.validateImportFile(buffer);
      
      expect(result.warnings.some(w => w.code === 'OLDER_SCHEMA_VERSION')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully during conflict detection', async () => {
      const mockDb = await import('../../db/connection.js');
      vi.mocked(mockDb.db.select).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: '2024-01-01T00:00:00.000Z',
          totalRecords: 1,
          checksum: 'test',
          application: { name: 'Test', version: '1.0.0' }
        },
        data: {
          animeInfo: [
            { id: 1, malId: 123, title: 'Anime 1', titleEnglish: null, titleJapanese: null, imageUrl: null, rating: null, premiereDate: null, numEpisodes: null, episodeDuration: null, animeType: 'TV', status: null, source: null, studios: null, genres: null, createdAt: null, updatedAt: null }
          ],
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      // Should not throw, but return empty conflicts
      const preview = await service.createImportPreview(exportData);
      
      expect(preview.conflicts.duplicateAnime).toEqual([]);
      expect(preview.conflicts.duplicateWatchlistEntries).toEqual([]);
    });

    it('should handle validation errors gracefully', async () => {
      const corruptedBuffer = Buffer.from('not json at all');
      
      const result = await service.validateImportFile(corruptedBuffer);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});