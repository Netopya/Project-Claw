import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExportError,
  ImportError,
  ValidationError,
  SchemaError,
  ERROR_CODES,
  getErrorDetails,
  toApiError,
  isRetryableError,
  getRetryDelay,
  retryOperation
} from './export-import-error-handler';

describe('Export/Import Error Handler', () => {
  describe('Error Classes', () => {
    it('should create ExportError with correct properties', () => {
      const error = new ExportError(
        'Export failed',
        ERROR_CODES.EXPORT_DATABASE_ERROR,
        500,
        true
      );

      expect(error.name).toBe('ExportError');
      expect(error.message).toBe('Export failed');
      expect(error.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.recoverable).toBe(true);
    });

    it('should create ImportError with correct properties', () => {
      const error = new ImportError(
        'Import failed',
        ERROR_CODES.IMPORT_EXECUTION_FAILED,
        422,
        false
      );

      expect(error.name).toBe('ImportError');
      expect(error.message).toBe('Import failed');
      expect(error.code).toBe(ERROR_CODES.IMPORT_EXECUTION_FAILED);
      expect(error.statusCode).toBe(422);
      expect(error.recoverable).toBe(false);
    });

    it('should create ValidationError with correct properties', () => {
      const details = ['Invalid JSON', 'Missing metadata'];
      const error = new ValidationError(
        'Validation failed',
        details,
        ERROR_CODES.VALIDATION_INVALID_JSON
      );

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_INVALID_JSON);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });

    it('should create SchemaError with correct properties', () => {
      const error = new SchemaError(
        'Schema mismatch',
        '1.0.0',
        '2.0.0',
        ERROR_CODES.SCHEMA_VERSION_TOO_NEW
      );

      expect(error.name).toBe('SchemaError');
      expect(error.message).toBe('Schema mismatch');
      expect(error.code).toBe(ERROR_CODES.SCHEMA_VERSION_TOO_NEW);
      expect(error.statusCode).toBe(400);
      expect(error.currentVersion).toBe('1.0.0');
      expect(error.fileVersion).toBe('2.0.0');
    });
  });

  describe('getErrorDetails', () => {
    it('should return export error details for database errors', () => {
      const error = new ExportError(
        'Database connection failed',
        ERROR_CODES.EXPORT_DATABASE_ERROR
      );

      const details = getErrorDetails(error);

      expect(details.title).toBe('Database Export Error');
      expect(details.message).toContain('Failed to read data from the database');
      expect(details.suggestions).toContain('Try the export again in a few moments');
      expect(details.recoverable).toBe(true);
      expect(details.retryable).toBe(true);
    });

    it('should return import error details for invalid format', () => {
      const error = new ImportError(
        'Invalid file format',
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );

      const details = getErrorDetails(error);

      expect(details.title).toBe('Invalid File Format');
      expect(details.message).toContain('not a valid export file');
      expect(details.suggestions).toContain('Ensure you\'re using a file exported from this application');
      expect(details.recoverable).toBe(false);
      expect(details.retryable).toBe(false);
    });

    it('should return validation error details for file too large', () => {
      const error = new ValidationError(
        'File too large',
        ['File size: 100MB', 'Maximum allowed: 50MB'],
        ERROR_CODES.VALIDATION_FILE_TOO_LARGE
      );

      const details = getErrorDetails(error);

      expect(details.title).toBe('File Too Large');
      expect(details.message).toContain('exceeds the maximum allowed size');
      expect(details.suggestions).toContain('Use a smaller export file');
      expect(details.recoverable).toBe(false);
      expect(details.retryable).toBe(false);
    });

    it('should return schema error details for version too new', () => {
      const error = new SchemaError(
        'Version too new',
        '1.0.0',
        '2.0.0',
        ERROR_CODES.SCHEMA_VERSION_TOO_NEW
      );

      const details = getErrorDetails(error);

      expect(details.title).toBe('Incompatible File Version');
      expect(details.message).toContain('newer version (2.0.0)');
      expect(details.message).toContain('supports (1.0.0)');
      expect(details.suggestions).toContain('Update the application to the latest version');
      expect(details.recoverable).toBe(false);
      expect(details.retryable).toBe(false);
    });

    it('should return generic error details for unknown errors', () => {
      const error = new Error('Unknown error occurred');

      const details = getErrorDetails(error);

      expect(details.title).toBe('Unexpected Error');
      expect(details.message).toBe('Unknown error occurred');
      expect(details.suggestions).toContain('Try the operation again');
      expect(details.recoverable).toBe(true);
      expect(details.retryable).toBe(true);
    });
  });

  describe('toApiError', () => {
    it('should convert ExportError to API error format', () => {
      const error = new ExportError(
        'Export failed',
        ERROR_CODES.EXPORT_DATABASE_ERROR
      );

      const apiError = toApiError(error);

      expect(apiError.code).toBe(ERROR_CODES.EXPORT_DATABASE_ERROR);
      expect(apiError.message).toBe('Export failed');
      expect(apiError.timestamp).toBeDefined();
      expect(apiError.details).toBe('Export failed');
    });

    it('should convert ValidationError to API error format', () => {
      const error = new ValidationError(
        'Validation failed',
        ['Detail 1', 'Detail 2']
      );

      const apiError = toApiError(error);

      expect(apiError.code).toBe('VALIDATION_ERROR');
      expect(apiError.message).toBe('Validation failed');
      expect(apiError.details).toBe('Detail 1; Detail 2');
    });

    it('should convert SchemaError to API error format', () => {
      const error = new SchemaError(
        'Schema mismatch',
        '1.0.0',
        '2.0.0'
      );

      const apiError = toApiError(error);

      expect(apiError.code).toBe('SCHEMA_ERROR');
      expect(apiError.message).toBe('Schema mismatch');
      expect(apiError.details).toBe('Current version: 1.0.0, File version: 2.0.0');
    });

    it('should convert generic Error to API error format', () => {
      const error = new Error('Generic error');

      const apiError = toApiError(error);

      expect(apiError.code).toBe('UNKNOWN_ERROR');
      expect(apiError.message).toBe('Generic error');
      expect(apiError.timestamp).toBeDefined();
    });
  });

  describe('isRetryableError', () => {
    it('should return true for recoverable ExportError', () => {
      const error = new ExportError(
        'Database error',
        ERROR_CODES.EXPORT_DATABASE_ERROR,
        500,
        true
      );

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-recoverable ImportError', () => {
      const error = new ImportError(
        'Invalid format',
        ERROR_CODES.IMPORT_INVALID_FORMAT,
        400,
        false
      );

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for ValidationError', () => {
      const error = new ValidationError('Validation failed');

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for SchemaError', () => {
      const error = new SchemaError('Schema error', '1.0.0', '2.0.0');

      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = new Error('Network connection failed');

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for fetch errors', () => {
      const error = new Error('Failed to fetch data');

      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Some other error');

      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return shorter delays for network errors', () => {
      const error = new Error('Network error');
      
      expect(getRetryDelay(error, 0)).toBe(1000);
      expect(getRetryDelay(error, 1)).toBe(1500);
      expect(getRetryDelay(error, 2)).toBe(2250);
      expect(getRetryDelay(error, 10)).toBe(10000); // Max 10 seconds
    });

    it('should return longer delays for database errors', () => {
      const error = new Error('Database connection failed');
      
      expect(getRetryDelay(error, 0)).toBe(2000);
      expect(getRetryDelay(error, 1)).toBe(4000);
      expect(getRetryDelay(error, 2)).toBe(8000);
      expect(getRetryDelay(error, 10)).toBe(30000); // Max 30 seconds
    });

    it('should return default exponential backoff for other errors', () => {
      const error = new Error('Some other error');
      
      expect(getRetryDelay(error, 0)).toBe(1000);
      expect(getRetryDelay(error, 1)).toBe(2000);
      expect(getRetryDelay(error, 2)).toBe(4000);
      expect(getRetryDelay(error, 10)).toBe(15000); // Max 15 seconds
    });
  });

  describe('retryOperation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryOperation(operation, 3, 'test');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = retryOperation(operation, 3, 'test');
      
      // Fast-forward through delays
      await vi.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        new ValidationError('Invalid format')
      );

      await expect(retryOperation(operation, 3, 'test')).rejects.toThrow('Invalid format');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = retryOperation(operation, 2, 'test');
      
      // Fast-forward through delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should respect max retries limit', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = retryOperation(operation, 1, 'test');
      
      // Fast-forward through delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should handle operations that throw synchronously', async () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new ValidationError('Sync error');
      });

      await expect(retryOperation(operation, 3, 'test')).rejects.toThrow('Sync error');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});