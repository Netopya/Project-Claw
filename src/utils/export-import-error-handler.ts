import type { ApiError } from '../types/export-import.js';

/**
 * Custom error classes for export/import operations
 */
export class ExportError extends Error {
  public code: string;
  public statusCode: number;
  public recoverable: boolean;

  constructor(message: string, code: string, statusCode: number = 500, recoverable: boolean = true) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    this.statusCode = statusCode;
    this.recoverable = recoverable;
  }
}

export class ImportError extends Error {
  public code: string;
  public statusCode: number;
  public recoverable: boolean;

  constructor(message: string, code: string, statusCode: number = 500, recoverable: boolean = true) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.statusCode = statusCode;
    this.recoverable = recoverable;
  }
}

export class ValidationError extends Error {
  public code: string;
  public statusCode: number;
  public details: string[];

  constructor(message: string, details: string[] = [], code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = 400;
    this.details = details;
  }
}

export class SchemaError extends Error {
  public code: string;
  public statusCode: number;
  public currentVersion: string;
  public fileVersion: string;

  constructor(message: string, currentVersion: string, fileVersion: string, code: string = 'SCHEMA_ERROR') {
    super(message);
    this.name = 'SchemaError';
    this.code = code;
    this.statusCode = 400;
    this.currentVersion = currentVersion;
    this.fileVersion = fileVersion;
  }
}

/**
 * Error codes for export/import operations
 */
export const ERROR_CODES = {
  // Export errors
  EXPORT_DATABASE_ERROR: 'EXPORT_DATABASE_ERROR',
  EXPORT_VALIDATION_FAILED: 'EXPORT_VALIDATION_FAILED',
  EXPORT_FILE_GENERATION_FAILED: 'EXPORT_FILE_GENERATION_FAILED',
  EXPORT_INSUFFICIENT_STORAGE: 'EXPORT_INSUFFICIENT_STORAGE',
  
  // Import errors
  IMPORT_INVALID_FORMAT: 'IMPORT_INVALID_FORMAT',
  IMPORT_SCHEMA_MISMATCH: 'IMPORT_SCHEMA_MISMATCH',
  IMPORT_DATA_CORRUPTION: 'IMPORT_DATA_CORRUPTION',
  IMPORT_EXECUTION_FAILED: 'IMPORT_EXECUTION_FAILED',
  IMPORT_ROLLBACK_FAILED: 'IMPORT_ROLLBACK_FAILED',
  
  // Validation errors
  VALIDATION_FILE_TOO_LARGE: 'VALIDATION_FILE_TOO_LARGE',
  VALIDATION_INVALID_JSON: 'VALIDATION_INVALID_JSON',
  VALIDATION_MISSING_METADATA: 'VALIDATION_MISSING_METADATA',
  VALIDATION_CHECKSUM_MISMATCH: 'VALIDATION_CHECKSUM_MISMATCH',
  
  // Schema errors
  SCHEMA_VERSION_TOO_NEW: 'SCHEMA_VERSION_TOO_NEW',
  SCHEMA_VERSION_UNSUPPORTED: 'SCHEMA_VERSION_UNSUPPORTED',
  SCHEMA_MIGRATION_FAILED: 'SCHEMA_MIGRATION_FAILED',
  
  // Network/System errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_STORAGE: 'INSUFFICIENT_STORAGE',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT'
} as const;

/**
 * Get user-friendly error message with recovery suggestions
 */
export function getErrorDetails(error: Error): {
  title: string;
  message: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
} {
  if (error instanceof ExportError) {
    return getExportErrorDetails(error);
  }
  
  if (error instanceof ImportError) {
    return getImportErrorDetails(error);
  }
  
  if (error instanceof ValidationError) {
    return getValidationErrorDetails(error);
  }
  
  if (error instanceof SchemaError) {
    return getSchemaErrorDetails(error);
  }
  
  // Generic error handling
  return {
    title: 'Unexpected Error',
    message: error.message || 'An unexpected error occurred',
    suggestions: [
      'Try the operation again',
      'Refresh the page if the problem persists',
      'Contact support if the issue continues'
    ],
    recoverable: true,
    retryable: true
  };
}

function getExportErrorDetails(error: ExportError): {
  title: string;
  message: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
} {
  switch (error.code) {
    case ERROR_CODES.EXPORT_DATABASE_ERROR:
      return {
        title: 'Database Export Error',
        message: 'Failed to read data from the database. This might be a temporary issue.',
        suggestions: [
          'Try the export again in a few moments',
          'Check if other database operations are working',
          'Restart the application if the problem persists'
        ],
        recoverable: true,
        retryable: true
      };
    
    case ERROR_CODES.EXPORT_VALIDATION_FAILED:
      return {
        title: 'Data Validation Failed',
        message: 'The database contains invalid data that cannot be exported safely.',
        suggestions: [
          'Check your data for inconsistencies',
          'Try exporting a smaller subset of data',
          'Contact support for data repair assistance'
        ],
        recoverable: true,
        retryable: false
      };
    
    case ERROR_CODES.EXPORT_FILE_GENERATION_FAILED:
      return {
        title: 'File Generation Failed',
        message: 'Failed to create the export file. This might be due to insufficient storage or permissions.',
        suggestions: [
          'Check available disk space',
          'Ensure the application has write permissions',
          'Try exporting to a different location'
        ],
        recoverable: true,
        retryable: true
      };
    
    case ERROR_CODES.EXPORT_INSUFFICIENT_STORAGE:
      return {
        title: 'Insufficient Storage',
        message: 'Not enough disk space to create the export file.',
        suggestions: [
          'Free up disk space and try again',
          'Try exporting a smaller dataset',
          'Use an external storage device'
        ],
        recoverable: true,
        retryable: true
      };
    
    default:
      return {
        title: 'Export Failed',
        message: error.message,
        suggestions: [
          'Try the export operation again',
          'Check your system resources',
          'Contact support if the problem persists'
        ],
        recoverable: error.recoverable,
        retryable: true
      };
  }
}

function getImportErrorDetails(error: ImportError): {
  title: string;
  message: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
} {
  switch (error.code) {
    case ERROR_CODES.IMPORT_INVALID_FORMAT:
      return {
        title: 'Invalid File Format',
        message: 'The selected file is not a valid export file or has been corrupted.',
        suggestions: [
          'Ensure you\'re using a file exported from this application',
          'Check that the file hasn\'t been modified or corrupted',
          'Try re-downloading the export file if it came from another source'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.IMPORT_SCHEMA_MISMATCH:
      return {
        title: 'Schema Version Mismatch',
        message: 'The export file uses a different data format that cannot be imported.',
        suggestions: [
          'Use an export file from a compatible version',
          'Update the application to support this file format',
          'Contact support for migration assistance'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.IMPORT_DATA_CORRUPTION:
      return {
        title: 'Data Corruption Detected',
        message: 'The import file contains corrupted data that cannot be safely imported.',
        suggestions: [
          'Try using a different export file',
          'Re-export the data from the source if possible',
          'Contact support for data recovery assistance'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.IMPORT_EXECUTION_FAILED:
      return {
        title: 'Import Execution Failed',
        message: 'The import process failed while writing data to the database.',
        suggestions: [
          'Try the import operation again',
          'Check available disk space',
          'Ensure no other operations are running'
        ],
        recoverable: true,
        retryable: true
      };
    
    case ERROR_CODES.IMPORT_ROLLBACK_FAILED:
      return {
        title: 'Import Rollback Failed',
        message: 'The import failed and the rollback operation also failed. Your data may be in an inconsistent state.',
        suggestions: [
          'Do not perform any other operations',
          'Restart the application immediately',
          'Contact support for immediate assistance',
          'Restore from a backup if available'
        ],
        recoverable: false,
        retryable: false
      };
    
    default:
      return {
        title: 'Import Failed',
        message: error.message,
        suggestions: [
          'Try the import operation again',
          'Check the file format and integrity',
          'Contact support if the problem persists'
        ],
        recoverable: error.recoverable,
        retryable: true
      };
  }
}

function getValidationErrorDetails(error: ValidationError): {
  title: string;
  message: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
} {
  switch (error.code) {
    case ERROR_CODES.VALIDATION_FILE_TOO_LARGE:
      return {
        title: 'File Too Large',
        message: 'The selected file exceeds the maximum allowed size for import.',
        suggestions: [
          'Use a smaller export file',
          'Split the data into multiple smaller files',
          'Contact support to increase the file size limit'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.VALIDATION_INVALID_JSON:
      return {
        title: 'Invalid File Format',
        message: 'The file is not a valid JSON file or has been corrupted.',
        suggestions: [
          'Ensure the file is a valid JSON export',
          'Check that the file hasn\'t been modified',
          'Try re-exporting the data from the source'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.VALIDATION_MISSING_METADATA:
      return {
        title: 'Missing File Metadata',
        message: 'The export file is missing required metadata information.',
        suggestions: [
          'Use a complete export file',
          'Re-export the data to ensure all metadata is included',
          'Contact support if using a file from an older version'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.VALIDATION_CHECKSUM_MISMATCH:
      return {
        title: 'Data Integrity Check Failed',
        message: 'The file appears to be corrupted or has been modified.',
        suggestions: [
          'Re-download the export file if it came from another source',
          'Re-export the data to create a new file',
          'Check for file system errors or corruption'
        ],
        recoverable: false,
        retryable: false
      };
    
    default:
      return {
        title: 'Validation Failed',
        message: error.message,
        suggestions: error.details.length > 0 ? error.details : [
          'Check the file format and content',
          'Ensure you\'re using a valid export file',
          'Contact support for assistance'
        ],
        recoverable: false,
        retryable: false
      };
  }
}

function getSchemaErrorDetails(error: SchemaError): {
  title: string;
  message: string;
  suggestions: string[];
  recoverable: boolean;
  retryable: boolean;
} {
  switch (error.code) {
    case ERROR_CODES.SCHEMA_VERSION_TOO_NEW:
      return {
        title: 'Incompatible File Version',
        message: `This export file was created with a newer version (${error.fileVersion}) than what this application supports (${error.currentVersion}).`,
        suggestions: [
          'Update the application to the latest version',
          'Use an export file from a compatible version',
          'Contact support for migration assistance'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.SCHEMA_VERSION_UNSUPPORTED:
      return {
        title: 'Unsupported File Version',
        message: `The export file version (${error.fileVersion}) is no longer supported by this application.`,
        suggestions: [
          'Use a more recent export file',
          'Contact support for legacy file migration',
          'Check if there\'s a migration tool available'
        ],
        recoverable: false,
        retryable: false
      };
    
    case ERROR_CODES.SCHEMA_MIGRATION_FAILED:
      return {
        title: 'Schema Migration Failed',
        message: `Failed to migrate the file from version ${error.fileVersion} to ${error.currentVersion}.`,
        suggestions: [
          'Try the import operation again',
          'Contact support for migration assistance',
          'Use a different export file if available'
        ],
        recoverable: true,
        retryable: true
      };
    
    default:
      return {
        title: 'Schema Error',
        message: error.message,
        suggestions: [
          'Check the file version compatibility',
          'Try using a different export file',
          'Contact support for assistance'
        ],
        recoverable: false,
        retryable: false
      };
  }
}

/**
 * Convert error to API error format
 */
export function toApiError(error: Error): ApiError {
  if (error instanceof ExportError || error instanceof ImportError) {
    return {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      details: error.message
    };
  }
  
  if (error instanceof ValidationError) {
    return {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      details: error.details.join('; ')
    };
  }
  
  if (error instanceof SchemaError) {
    return {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      details: `Current version: ${error.currentVersion}, File version: ${error.fileVersion}`
    };
  }
  
  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    details: error.stack || 'No additional details available'
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof ExportError || error instanceof ImportError) {
    return error.recoverable;
  }
  
  if (error instanceof ValidationError || error instanceof SchemaError) {
    return false;
  }
  
  // Check for network errors
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Get retry delay based on error type and attempt number
 */
export function getRetryDelay(error: Error, attempt: number): number {
  // Network errors: shorter delays
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('fetch')) {
    return Math.min(1000 * Math.pow(1.5, attempt), 10000); // Max 10 seconds
  }
  
  // Database errors: longer delays
  if (message.includes('database') || message.includes('sql')) {
    return Math.min(2000 * Math.pow(2, attempt), 30000); // Max 30 seconds
  }
  
  // Default exponential backoff
  return Math.min(1000 * Math.pow(2, attempt), 15000); // Max 15 seconds
}

/**
 * Retry function with smart backoff based on error type
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  context?: string
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !isRetryableError(lastError)) {
        break;
      }
      
      const delay = getRetryDelay(lastError, attempt);
      console.warn(`${context ? `[${context}]` : ''} Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}