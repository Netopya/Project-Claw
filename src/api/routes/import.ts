import { Hono } from 'hono';
import { ImportValidationService } from '../services/import-validation-service.js';
import { ImportExecutionService } from '../services/import-execution-service.js';
import { 
  ImportError, 
  ValidationError, 
  SchemaError, 
  ERROR_CODES, 
  toApiError 
} from '../../utils/export-import-error-handler.js';
import type { 
  ImportOptions, 
  ImportValidateResponse, 
  ImportPreviewResponse, 
  ImportExecuteResponse 
} from '../../types/export-import.js';

const importRoutes = new Hono();

// POST /api/import/validate - Validate uploaded file
importRoutes.post('/validate', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    
    if (!file) {
      const validationError = new ValidationError(
        'No file provided for validation',
        [],
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportValidateResponse, validationError.statusCode);
    }

    // Check file size (50MB limit)
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxFileSize) {
      const validationError = new ValidationError(
        `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the maximum allowed size of 50MB`,
        [`File size: ${(file.size / 1024 / 1024).toFixed(1)}MB`, 'Maximum allowed: 50MB'],
        ERROR_CODES.VALIDATION_FILE_TOO_LARGE
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportValidateResponse, validationError.statusCode);
    }

    // Validate file format first
    const validationService = new ImportValidationService();
    const formatValidation = validationService.validateFileFormat(file.name, file.type);
    
    if (!formatValidation.isValid) {
      const validationError = new ValidationError(
        'Invalid file format',
        formatValidation.errors,
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportValidateResponse, validationError.statusCode);
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Validate file content
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    return c.json({
      success: true,
      data: validationResult
    } as ImportValidateResponse);

  } catch (error) {
    console.error('Error validating import file:', error);
    
    // Determine specific error type
    let importError: ImportError | ValidationError;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      importError = new ValidationError(
        'Invalid JSON format in import file',
        ['The file does not contain valid JSON data'],
        ERROR_CODES.VALIDATION_INVALID_JSON
      );
    } else if (errorMessage.includes('timeout')) {
      importError = new ImportError(
        'File validation timed out',
        ERROR_CODES.OPERATION_TIMEOUT,
        408,
        true
      );
    } else {
      importError = new ImportError(
        'Failed to validate import file',
        ERROR_CODES.IMPORT_INVALID_FORMAT,
        500,
        true
      );
    }
    
    return c.json({
      success: false,
      error: toApiError(importError)
    } as ImportValidateResponse, importError.statusCode);
  }
});

// POST /api/import/preview - Preview import data
importRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    
    if (!file) {
      const validationError = new ValidationError(
        'No file provided for preview',
        [],
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportPreviewResponse, validationError.statusCode);
    }

    // Convert file to buffer and parse
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validationService = new ImportValidationService();
    
    // First validate the file
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    if (!validationResult.isValid) {
      const validationError = new ValidationError(
        'File validation failed',
        validationResult.errors.map(e => e.message),
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportPreviewResponse, validationError.statusCode);
    }

    // Parse the validated file
    let exportData;
    try {
      exportData = JSON.parse(fileBuffer.toString('utf-8'));
    } catch (parseError) {
      const validationError = new ValidationError(
        'Invalid JSON format in import file',
        ['The file does not contain valid JSON data'],
        ERROR_CODES.VALIDATION_INVALID_JSON
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportPreviewResponse, validationError.statusCode);
    }
    
    // Create import preview
    const importPreview = await validationService.createImportPreview(exportData);
    
    return c.json({
      success: true,
      data: importPreview
    } as ImportPreviewResponse);

  } catch (error) {
    console.error('Error creating import preview:', error);
    
    // Determine specific error type
    let importError: ImportError | ValidationError | SchemaError;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('schema') || errorMessage.includes('version')) {
      importError = new SchemaError(
        'Schema version mismatch detected',
        '1.0.0', // Current version
        'unknown', // File version
        ERROR_CODES.IMPORT_SCHEMA_MISMATCH
      );
    } else if (errorMessage.includes('checksum') || errorMessage.includes('integrity')) {
      importError = new ValidationError(
        'Data integrity check failed',
        ['File checksum does not match expected value'],
        ERROR_CODES.VALIDATION_CHECKSUM_MISMATCH
      );
    } else if (errorMessage.includes('metadata')) {
      importError = new ValidationError(
        'Missing required metadata',
        ['Export metadata is missing or incomplete'],
        ERROR_CODES.VALIDATION_MISSING_METADATA
      );
    } else {
      importError = new ImportError(
        'Failed to create import preview',
        ERROR_CODES.IMPORT_INVALID_FORMAT,
        500,
        true
      );
    }
    
    return c.json({
      success: false,
      error: toApiError(importError)
    } as ImportPreviewResponse, importError.statusCode);
  }
});

// POST /api/import/execute - Execute import operation
importRoutes.post('/execute', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const optionsJson = body.options as string;
    
    if (!file) {
      const validationError = new ValidationError(
        'No file provided for import',
        [],
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportExecuteResponse, validationError.statusCode);
    }

    // Parse import options
    let importOptions: ImportOptions;
    try {
      importOptions = optionsJson ? JSON.parse(optionsJson) : {
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      };
    } catch (parseError) {
      const validationError = new ValidationError(
        'Invalid import options format',
        ['Import options must be valid JSON'],
        ERROR_CODES.VALIDATION_INVALID_JSON
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportExecuteResponse, validationError.statusCode);
    }

    // Convert file to buffer and validate
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const validationService = new ImportValidationService();
    
    // Validate file before execution
    const validationResult = await validationService.validateImportFile(fileBuffer);
    
    if (!validationResult.isValid) {
      const validationError = new ValidationError(
        'File validation failed',
        validationResult.errors.map(e => e.message),
        ERROR_CODES.IMPORT_INVALID_FORMAT
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportExecuteResponse, validationError.statusCode);
    }

    // Parse the validated file
    let exportData;
    try {
      exportData = JSON.parse(fileBuffer.toString('utf-8'));
    } catch (parseError) {
      const validationError = new ValidationError(
        'Invalid JSON format in import file',
        ['The file does not contain valid JSON data'],
        ERROR_CODES.VALIDATION_INVALID_JSON
      );
      
      return c.json({
        success: false,
        error: toApiError(validationError)
      } as ImportExecuteResponse, validationError.statusCode);
    }
    
    // Execute import
    const executionService = new ImportExecutionService();
    const importResult = await executionService.executeImport(exportData, importOptions);
    
    return c.json({
      success: true,
      data: importResult
    } as ImportExecuteResponse);

  } catch (error) {
    console.error('Error executing import:', error);
    
    // Determine specific error type based on error message
    let importError: ImportError;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('rollback') || errorMessage.includes('transaction')) {
      importError = new ImportError(
        'Import failed and rollback was unsuccessful. Database may be in an inconsistent state.',
        ERROR_CODES.IMPORT_ROLLBACK_FAILED,
        500,
        false
      );
    } else if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      importError = new ImportError(
        'Database error occurred during import execution',
        ERROR_CODES.IMPORT_EXECUTION_FAILED,
        500,
        true
      );
    } else if (errorMessage.includes('storage') || errorMessage.includes('space') || errorMessage.includes('ENOSPC')) {
      importError = new ImportError(
        'Insufficient storage space to complete import',
        ERROR_CODES.INSUFFICIENT_STORAGE,
        507,
        true
      );
    } else if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
      importError = new ImportError(
        'Permission denied during import execution',
        ERROR_CODES.PERMISSION_DENIED,
        403,
        false
      );
    } else if (errorMessage.includes('timeout')) {
      importError = new ImportError(
        'Import operation timed out',
        ERROR_CODES.OPERATION_TIMEOUT,
        408,
        true
      );
    } else if (errorMessage.includes('corruption') || errorMessage.includes('integrity')) {
      importError = new ImportError(
        'Data corruption detected during import',
        ERROR_CODES.IMPORT_DATA_CORRUPTION,
        422,
        false
      );
    } else {
      importError = new ImportError(
        'Failed to execute import',
        ERROR_CODES.IMPORT_EXECUTION_FAILED,
        500,
        true
      );
    }
    
    return c.json({
      success: false,
      error: toApiError(importError)
    } as ImportExecuteResponse, importError.statusCode);
  }
});

export { importRoutes };