import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { importRoutes } from './import';
import { ImportValidationService } from '../services/import-validation-service';
import { ImportExecutionService } from '../services/import-execution-service';
import { ERROR_CODES } from '../../utils/export-import-error-handler';

// Mock the services
vi.mock('../services/import-validation-service');
vi.mock('../services/import-execution-service');

describe('Import Routes Error Handling', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/import', importRoutes);
    vi.clearAllMocks();
  });

  describe('POST /api/import/validate', () => {
    it('should handle missing file with appropriate error', async () => {
      const formData = new FormData();
      // No file added

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_INVALID_FORMAT);
      expect(data.error.message).toBe('No file provided for validation');
    });

    it('should handle file too large error', async () => {
      // Create a mock file that's too large (over 50MB)
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('file', largeFile);

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.VALIDATION_FILE_TOO_LARGE);
      expect(data.error.message).toContain('exceeds the maximum allowed size');
    });

    it('should handle invalid file format', async () => {
      const mockFile = new File(['test content'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateFileFormat: vi.fn().mockReturnValue({
          isValid: false,
          errors: ['Invalid file extension', 'Unsupported MIME type']
        }),
        validateImportFile: vi.fn()
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_INVALID_FORMAT);
      expect(data.error.message).toBe('Invalid file format');
      expect(data.error.details).toContain('Invalid file extension');
    });

    it('should handle JSON parsing errors', async () => {
      const mockFile = new File(['invalid json content'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateFileFormat: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        validateImportFile: vi.fn().mockRejectedValue(new Error('JSON parse error'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.VALIDATION_INVALID_JSON);
      expect(data.error.message).toBe('Invalid JSON format in import file');
    });

    it('should handle timeout errors', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateFileFormat: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        validateImportFile: vi.fn().mockRejectedValue(new Error('Operation timeout'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(408);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.OPERATION_TIMEOUT);
      expect(data.error.message).toBe('File validation timed out');
    });

    it('should successfully validate file', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      const mockValidationService = {
        validateFileFormat: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        validateImportFile: vi.fn().mockResolvedValue(mockValidationResult)
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockValidationResult);
    });
  });

  describe('POST /api/import/preview', () => {
    it('should handle missing file error', async () => {
      const formData = new FormData();

      const res = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_INVALID_FORMAT);
    });

    it('should handle validation failure', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid schema' }, { message: 'Missing metadata' }]
      };

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue(mockValidationResult),
        createImportPreview: vi.fn()
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_INVALID_FORMAT);
      expect(data.error.details).toContain('Invalid schema');
    });

    it('should handle schema version mismatch', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
        createImportPreview: vi.fn().mockRejectedValue(new Error('Schema version mismatch detected'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_SCHEMA_MISMATCH);
    });

    it('should handle checksum mismatch', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
        createImportPreview: vi.fn().mockRejectedValue(new Error('Checksum validation failed'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.VALIDATION_CHECKSUM_MISMATCH);
    });

    it('should successfully create preview', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockPreview = {
        metadata: { version: '1.0.0', exportDate: new Date().toISOString() },
        summary: { animeInfo: 10, userWatchlist: 5 },
        conflicts: { duplicateAnime: [], duplicateWatchlistEntries: [] }
      };

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] }),
        createImportPreview: vi.fn().mockResolvedValue(mockPreview)
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockPreview);
    });
  });

  describe('POST /api/import/execute', () => {
    it('should handle missing file error', async () => {
      const formData = new FormData();

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_INVALID_FORMAT);
    });

    it('should handle invalid import options', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const formData = new FormData();
      formData.append('file', mockFile);
      formData.append('options', 'invalid json');

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.VALIDATION_INVALID_JSON);
      expect(data.error.message).toBe('Invalid import options format');
    });

    it('should handle rollback failure', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockRejectedValue(new Error('Import failed and rollback unsuccessful'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_ROLLBACK_FAILED);
    });

    it('should handle database errors', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.IMPORT_EXECUTION_FAILED);
      expect(data.error.message).toBe('Database error occurred during import execution');
    });

    it('should handle storage errors', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockRejectedValue(new Error('ENOSPC: no space left on device'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(507);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.INSUFFICIENT_STORAGE);
    });

    it('should handle permission errors', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockRejectedValue(new Error('EACCES: permission denied'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    it('should handle timeout errors', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockRejectedValue(new Error('Operation timeout exceeded'))
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(408);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ERROR_CODES.OPERATION_TIMEOUT);
    });

    it('should successfully execute import', async () => {
      const mockFile = new File(['{"test": "data"}'], 'test.json', {
        type: 'application/json'
      });

      const mockValidationService = {
        validateImportFile: vi.fn().mockResolvedValue({ isValid: true, errors: [] })
      };

      const mockImportResult = {
        recordsProcessed: { animeInfo: 10, userWatchlist: 5 },
        errors: [],
        warnings: []
      };

      const mockExecutionService = {
        executeImport: vi.fn().mockResolvedValue(mockImportResult)
      };

      vi.mocked(ImportValidationService).mockImplementation(() => mockValidationService as any);
      vi.mocked(ImportExecutionService).mockImplementation(() => mockExecutionService as any);

      const formData = new FormData();
      formData.append('file', mockFile);

      const res = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockImportResult);
    });
  });
});