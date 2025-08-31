import React, { useState, useCallback, useRef } from 'react';
import type { 
  ImportPreview, 
  ImportOptions, 
  ImportResult, 
  ValidationResult,
  ImportMode,
  DuplicateHandling,
  DatabaseStats
} from '../types/export-import.js';
import { ProgressTracker, IMPORT_STEPS, type ProgressState } from '../utils/progress-tracker.js';
import { ProgressIndicator } from './ProgressIndicator.js';
import { MessageSystem, useMessageSystem } from './MessageSystem.js';
import { 
  getErrorDetails, 
  retryOperation, 
  ImportError, 
  ValidationError,
  ERROR_CODES 
} from '../utils/export-import-error-handler.js';

interface ImportSectionProps {
  onStatsUpdate?: (stats: DatabaseStats) => void;
}

export const ImportSection: React.FC<ImportSectionProps> = ({ onStatsUpdate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mode: 'merge',
    handleDuplicates: 'skip',
    validateRelationships: true,
    clearCache: false
  });
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const { messages, addMessage, removeMessage, clearMessages } = useMessageSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportState = useCallback(() => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportPreview(null);
    setProgressState(null);
    clearMessages();
  }, [clearMessages]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      clearMessages();
      addMessage('error', 'Please select a JSON file', {
        title: 'Invalid File Type',
        details: 'Only JSON files are supported for import operations'
      });
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setImportPreview(null);
    setProgressState(null);
    clearMessages();
    addMessage('info', `File selected: ${file.name}`, {
      details: `Size: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type}`,
      autoRemove: true
    });
  }, [addMessage, clearMessages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const validateFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setIsValidating(true);
      clearMessages();
      
      // Initialize progress tracker for validation
      const progressTracker = new ProgressTracker([
        { id: 'format', name: 'Validating file format', weight: 30 },
        { id: 'content', name: 'Validating file content', weight: 50 },
        { id: 'preview', name: 'Generating preview', weight: 20 }
      ], setProgressState);
      
      progressTracker.start();
      progressTracker.startStep('format', 'Checking file format and structure...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await retryOperation(async () => {
        const res = await fetch('/api/import/validate', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errorData = await res.json();
          
          // Create specific error based on response
          if (errorData.error?.code) {
            if (errorData.error.code.includes('VALIDATION')) {
              const validationError = new ValidationError(
                errorData.error.message || 'Validation failed',
                errorData.error.details ? [errorData.error.details] : [],
                errorData.error.code
              );
              throw validationError;
            } else {
              const importError = new ImportError(
                errorData.error.message || 'Import validation failed',
                errorData.error.code,
                res.status
              );
              throw importError;
            }
          }
          
          throw new ImportError(
            errorData.error || 'Validation failed',
            ERROR_CODES.IMPORT_INVALID_FORMAT,
            res.status
          );
        }
        
        return res;
      }, 2, 'File Validation');

      const result = await response.json();
      progressTracker.completeStep('format', 'File format validated');
      progressTracker.startStep('content', 'Validating file content...');

      if (result.success) {
        setValidationResult(result.data);
        progressTracker.completeStep('content', 'Content validation completed');
        
        if (result.data.isValid) {
          progressTracker.startStep('preview', 'Generating import preview...');
          addMessage('success', 'File validation successful', { autoRemove: true });
          
          // Automatically get preview after successful validation
          await getImportPreview();
          progressTracker.completeStep('preview', 'Preview generated successfully');
        } else {
          progressTracker.errorStep('content', 'File validation failed');
          const errorMessages = result.data.errors.map((e: any) => e.message).join(', ');
          addMessage('error', 'File validation failed', {
            title: 'Validation Error',
            details: errorMessages
          });
        }
      } else {
        progressTracker.errorStep('content', result.error.message);
        const errorDetails = getErrorDetails(new Error(result.error.message));
        addMessage('error', errorDetails.message, {
          title: errorDetails.title,
          details: errorDetails.suggestions.join('\n')
        });
      }
    } catch (error) {
      console.error('Validation error:', error);
      
      // Get enhanced error details
      const errorDetails = getErrorDetails(error as Error);
      
      addMessage('error', errorDetails.message, {
        title: errorDetails.title,
        details: errorDetails.suggestions.join('\n'),
        actions: errorDetails.retryable ? [
          {
            label: 'Retry Validation',
            onClick: () => validateFile(),
            variant: 'primary'
          }
        ] : []
      });
      
      // Update progress tracker with error
      const progressTracker = new ProgressTracker([
        { id: 'format', name: 'Validating file format', weight: 30 },
        { id: 'content', name: 'Validating file content', weight: 50 },
        { id: 'preview', name: 'Generating preview', weight: 20 }
      ], setProgressState);
      progressTracker.errorStep('content', errorDetails.message);
    } finally {
      setIsValidating(false);
      setTimeout(() => setProgressState(null), 3000);
    }
  }, [selectedFile, clearMessages, addMessage]);

  const getImportPreview = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setImportPreview(result.data);
        addMessage('info', 'Import preview generated', {
          details: `Records to import: ${result.data.summary.animeInfo + result.data.summary.userWatchlist + result.data.summary.animeRelationships + result.data.summary.timelineCache}`,
          autoRemove: true
        });
      } else {
        addMessage('error', 'Preview generation failed', {
          title: 'Preview Error',
          details: result.error.message
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      addMessage('error', 'Preview generation failed', {
        title: 'Network Error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [selectedFile, addMessage]);

  const executeImport = useCallback(async () => {
    if (!selectedFile || !importPreview) return;

    try {
      setIsImporting(true);
      clearMessages();
      
      // Initialize progress tracker for import
      const progressTracker = new ProgressTracker(IMPORT_STEPS, setProgressState);
      progressTracker.start();
      
      // Step 1: Validate
      progressTracker.startStep('validate', 'Re-validating import file...');
      await new Promise(resolve => setTimeout(resolve, 300));
      progressTracker.completeStep('validate', 'File validation confirmed');
      
      // Step 2: Parse
      progressTracker.startStep('parse', 'Parsing file content...');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify(importOptions));
      progressTracker.completeStep('parse', 'File content parsed successfully');

      // Step 3: Migrate (if needed)
      if (importPreview.schemaMigrationRequired) {
        progressTracker.startStep('migrate', 'Migrating schema to current version...');
        await new Promise(resolve => setTimeout(resolve, 500));
        progressTracker.completeStep('migrate', 'Schema migration completed');
      } else {
        progressTracker.startStep('migrate', 'No schema migration required');
        progressTracker.completeStep('migrate', 'Schema version compatible');
      }

      // Step 4: Process import with retry logic
      progressTracker.startStep('process', 'Processing import data...');
      
      const response = await retryOperation(async () => {
        const res = await fetch('/api/import/execute', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errorData = await res.json();
          
          // Create specific error based on response
          if (errorData.error?.code) {
            const importError = new ImportError(
              errorData.error.message || 'Import execution failed',
              errorData.error.code,
              res.status,
              errorData.error.code !== ERROR_CODES.IMPORT_ROLLBACK_FAILED
            );
            throw importError;
          }
          
          throw new ImportError(
            errorData.error || 'Import execution failed',
            ERROR_CODES.IMPORT_EXECUTION_FAILED,
            res.status
          );
        }
        
        return res;
      }, 2, 'Import Execution');

      const result = await response.json();

      if (result.success) {
        const importResult: ImportResult = result.data;
        progressTracker.completeStep('process', 'Import data processed successfully');
        
        // Step 5: Finalize
        progressTracker.startStep('finalize', 'Finalizing import operation...');
        
        const totalProcessed = Object.values(importResult.recordsProcessed).reduce((sum, count) => sum + count, 0);
        
        // Trigger stats update if callback provided
        if (onStatsUpdate) {
          try {
            const statsResponse = await fetch('/api/export/stats');
            const statsData = await statsResponse.json();
            if (statsData.success) {
              onStatsUpdate(statsData.data);
            }
          } catch (error) {
            console.error('Failed to refresh stats after import:', error);
          }
        }
        
        progressTracker.completeStep('finalize', 'Import operation finalized');
        progressTracker.complete();
        
        addMessage('success', `Import completed successfully!`, {
          title: 'Import Successful',
          details: `Processed ${totalProcessed} records\n${Object.entries(importResult.recordsProcessed).map(([key, count]) => `${key}: ${count}`).join('\n')}`,
          autoRemove: true
        });
        
        if (importResult.warnings.length > 0) {
          addMessage('warning', `Import completed with warnings`, {
            title: 'Import Warnings',
            details: importResult.warnings.map(w => w.message).join('\n')
          });
        }

        // Reset state after successful import
        setTimeout(() => {
          resetImportState();
        }, 5000);
      } else {
        progressTracker.errorStep('process', result.error.message);
        const errorDetails = getErrorDetails(new Error(result.error.message));
        addMessage('error', errorDetails.message, {
          title: errorDetails.title,
          details: errorDetails.suggestions.join('\n'),
          actions: errorDetails.retryable ? [
            {
              label: 'Retry Import',
              onClick: () => executeImport(),
              variant: 'primary'
            }
          ] : []
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      
      // Get enhanced error details
      const errorDetails = getErrorDetails(error as Error);
      
      addMessage('error', errorDetails.message, {
        title: errorDetails.title,
        details: errorDetails.suggestions.join('\n'),
        actions: errorDetails.retryable ? [
          {
            label: 'Retry Import',
            onClick: () => executeImport(),
            variant: 'primary'
          }
        ] : []
      });
      
      // Update progress tracker with error
      const progressTracker = new ProgressTracker(IMPORT_STEPS, setProgressState);
      progressTracker.errorStep('process', errorDetails.message);
    } finally {
      setIsImporting(false);
      setTimeout(() => setProgressState(null), 5000);
    }
  }, [selectedFile, importPreview, importOptions, clearMessages, addMessage, resetImportState, onStatsUpdate]);

  const handleModeChange = useCallback((mode: ImportMode) => {
    setImportOptions(prev => ({ ...prev, mode }));
  }, []);

  const handleDuplicateHandlingChange = useCallback((handling: DuplicateHandling) => {
    setImportOptions(prev => ({ ...prev, handleDuplicates: handling }));
  }, []);

  const handleOptionChange = useCallback((key: keyof ImportOptions, value: boolean) => {
    setImportOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Import Data
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Import anime data from a backup file. You can choose to merge with existing data or replace it entirely.
      </p>

      {/* File Upload Area */}
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInputChange}
            className="hidden"
            aria-label="Select import file"
          />
          
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {selectedFile ? selectedFile.name : 'Drop your import file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                browse to upload
              </button>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              JSON files only, max 50MB
            </p>
          </div>
        </div>

        {/* File Actions */}
        {selectedFile && !importPreview && (
          <div className="flex gap-2">
            <button
              onClick={validateFile}
              disabled={isValidating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              {isValidating ? 'Validating...' : 'Validate File'}
            </button>
            
            <button
              onClick={resetImportState}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        {/* Enhanced Progress Tracking */}
        {progressState && (
          <ProgressIndicator 
            progress={progressState}
            showSteps={true}
            showTimeEstimate={true}
            className="mt-4"
          />
        )}

        {/* Import Preview */}
        {importPreview && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Import Preview</h4>
            
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Export Date:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {new Date(importPreview.metadata.exportDate).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Version:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {importPreview.metadata.version}
                </span>
              </div>
            </div>

            {/* Data Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {importPreview.summary.animeInfo.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Anime Info</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {importPreview.summary.userWatchlist.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Watchlist</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {importPreview.summary.animeRelationships.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Relationships</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded">
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {importPreview.summary.timelineCache.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Timeline Cache</div>
              </div>
            </div>

            {/* Conflicts */}
            {(importPreview.conflicts.duplicateAnime.length > 0 || importPreview.conflicts.duplicateWatchlistEntries.length > 0) && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <h5 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Potential Conflicts</h5>
                {importPreview.conflicts.duplicateAnime.length > 0 && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {importPreview.conflicts.duplicateAnime.length} duplicate anime entries found
                  </p>
                )}
                {importPreview.conflicts.duplicateWatchlistEntries.length > 0 && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {importPreview.conflicts.duplicateWatchlistEntries.length} duplicate watchlist entries found
                  </p>
                )}
              </div>
            )}

            {/* Schema Migration Warning */}
            {importPreview.schemaMigrationRequired && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-1">Schema Migration Required</h5>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This file uses an older schema version and will be automatically migrated during import.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Import Options */}
        {importPreview && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Import Options</h4>
            
            {/* Import Mode */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importOptions.mode === 'merge'}
                    onChange={() => handleModeChange('merge')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    Merge - Add new data and update existing records
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importOptions.mode === 'replace'}
                    onChange={() => handleModeChange('replace')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    Replace - Clear existing data and import fresh
                  </span>
                </label>
              </div>
            </div>

            {/* Duplicate Handling */}
            {importOptions.mode === 'merge' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Handle Duplicates
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      value="skip"
                      checked={importOptions.handleDuplicates === 'skip'}
                      onChange={() => handleDuplicateHandlingChange('skip')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Skip - Keep existing records unchanged
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="duplicateHandling"
                      value="update"
                      checked={importOptions.handleDuplicates === 'update'}
                      onChange={() => handleDuplicateHandlingChange('update')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">
                      Update - Overwrite existing records with imported data
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Additional Options */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={importOptions.validateRelationships}
                  onChange={(e) => handleOptionChange('validateRelationships', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">
                  Validate relationships during import
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={importOptions.clearCache}
                  onChange={(e) => handleOptionChange('clearCache', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-900 dark:text-white">
                  Clear timeline cache after import
                </span>
              </label>
            </div>

            {/* Import Button */}
            <div className="mt-6">
              <button
                onClick={executeImport}
                disabled={isImporting}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                <span>{isImporting ? 'Importing...' : 'Start Import'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Message System */}
        <MessageSystem 
          messages={messages}
          onRemoveMessage={removeMessage}
          maxMessages={3}
          className="mt-4"
        />
      </div>
    </div>
  );
};