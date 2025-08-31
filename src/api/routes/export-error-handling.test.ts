import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { exportRoutes } from './export';
import { StatisticsService } from '../services/statistics-service';
import { ExportService } from '../services/export-service';
import { ERROR_CODES } from '../../utils/export-import-error-handler';

// Mock the services
vi.mock('../services/statistics-service');
vi.mock('../services/export-service');

describe('Export Routes Error Handling', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/export', exportRoutes);
    vi.clearAllMocks();
  });

  describe('GET /api/export/stats', () => {
    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      vi.mocked(StatisticsService).mockImplementation(() => ({
        getDatabaseStatistics: vi.fn().mockRejectedValue(mockError)
      } as any));

      const res = await app.request('/api/export/stats');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(data.error.message).toBe('Failed to retrieve database statistics');
    });

    it('should return successful response when service succeeds', async () => {
      const mockStats = {
        animeInfo: 100,
        userWatchlist: 50,
        animeRelationships: 25,
        timelineCache: 10,
        total: 185,
        lastUpdated: new Date().toISOString()
      };

      vi.mocked(StatisticsService).mockImplementation(() => ({
        getDatabaseStatistics: vi.fn().mockResolvedValue(mockStats)
      } as any));

      const res = await app.request('/api/export/stats');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockStats);
    });
  });

  describe('GET /api/export/stats/detailed', () => {
    it('should handle service errors with proper error codes', async () => {
      const mockError = new Error('Service unavailable');
      vi.mocked(StatisticsService).mockImplementation(() => ({
        getDetailedStatistics: vi.fn().mockRejectedValue(mockError)
      } as any));

      const res = await app.request('/api/export/stats/detailed');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(data.error.timestamp).toBeDefined();
    });
  });

  describe('GET /api/export/stats/validate', () => {
    it('should handle validation errors with appropriate error codes', async () => {
      const mockError = new Error('Validation failed');
      vi.mocked(StatisticsService).mockImplementation(() => ({
        validateStatisticsAccuracy: vi.fn().mockRejectedValue(mockError)
      } as any));

      const res = await app.request('/api/export/stats/validate');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_VALIDATION_FAILED);
    });
  });

  describe('POST /api/export/generate', () => {
    it('should handle storage errors with specific error codes', async () => {
      const mockError = new Error('ENOSPC: no space left on device');
      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockRejectedValue(mockError),
        getExportMetadata: vi.fn()
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });
      const data = await res.json();

      expect(res.status).toBe(507);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_INSUFFICIENT_STORAGE);
      expect(data.error.message).toBe('Insufficient storage space to create export file');
    });

    it('should handle permission errors with specific error codes', async () => {
      const mockError = new Error('EACCES: permission denied');
      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockRejectedValue(mockError),
        getExportMetadata: vi.fn()
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
      expect(data.error.message).toBe('Permission denied while creating export file');
    });

    it('should handle validation errors during export', async () => {
      const mockError = new Error('Data integrity validation failed');
      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockRejectedValue(mockError),
        getExportMetadata: vi.fn()
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_VALIDATION_FAILED);
      expect(data.error.message).toBe('Data validation failed during export');
    });

    it('should handle database errors during export', async () => {
      const mockError = new Error('Database connection failed');
      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockRejectedValue(mockError),
        getExportMetadata: vi.fn()
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(data.error.message).toBe('Database error occurred during export');
    });

    it('should handle generic export errors', async () => {
      const mockError = new Error('Unknown export error');
      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockRejectedValue(mockError),
        getExportMetadata: vi.fn()
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_FILE_GENERATION_FAILED);
      expect(data.error.message).toBe('Failed to generate export file');
    });

    it('should successfully generate export file', async () => {
      const mockBuffer = Buffer.from('{"test": "data"}');
      const mockMetadata = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalRecords: 100
      };

      vi.mocked(ExportService).mockImplementation(() => ({
        generateExportFile: vi.fn().mockResolvedValue(mockBuffer),
        getExportMetadata: vi.fn().mockResolvedValue(mockMetadata)
      } as any));

      const res = await app.request('/api/export/generate', { method: 'POST' });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      expect(res.headers.get('Content-Disposition')).toContain('attachment');
      expect(res.headers.get('Content-Length')).toBe(mockBuffer.length.toString());
    });
  });

  describe('GET /api/export/metadata', () => {
    it('should handle metadata retrieval errors', async () => {
      const mockError = new Error('Failed to get metadata');
      vi.mocked(ExportService).mockImplementation(() => ({
        getExportMetadata: vi.fn().mockRejectedValue(mockError)
      } as any));

      const res = await app.request('/api/export/metadata');
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(data.error.message).toBe('Failed to get export metadata');
    });

    it('should successfully return metadata', async () => {
      const mockMetadata = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalRecords: 100
      };

      vi.mocked(ExportService).mockImplementation(() => ({
        getExportMetadata: vi.fn().mockResolvedValue(mockMetadata)
      } as any));

      const res = await app.request('/api/export/metadata');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockMetadata);
    });
  });
});