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

interface ImportSectionProps {
  onStatsUpdate?: (stats: DatabaseStats) => void;
}

interface ImportMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ImportProgress {
  percentage: number;
  message: string;
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
  const [progress, setProgress] = useState<ImportProgress>({ percentage: 0, message: '' });
  const [messages, setMessages] = useState<ImportMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMessage = useCallback((type: ImportMessage['type'], message: string) => {
    const newMessage: ImportMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message
    };
    setMessages(prev => [...prev, newMessage]);
    
    // Auto-remove success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }, 5000);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const updateProgress = useCallback((percentage: number, message: string) => {
    setProgress({ percentage, message });
  }, []);

  const resetImportState = useCallback(() => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportPreview(null);
    setProgress({ percentage: 0, message: '' });
    clearMessages();
  }, [clearMessages]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      clearMessages();
      addMessage('error', 'Please select a JSON file');
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setImportPreview(null);
    clearMessages();
    addMessage('info', `Selected file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
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
      updateProgress(25, 'Validating file format...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/validate', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      updateProgress(75, 'Processing validation results...');

      if (result.success) {
        setValidationResult(result.data);
        updateProgress(100, 'File validation complete');
        
        if (result.data.isValid) {
          addMessage('success', 'File validation successful');
          // Automatically get preview after successful validation
          await getImportPreview();
        } else {
          addMessage('error', `File validation failed: ${result.data.errors.map((e: any) => e.message).join(', ')}`);
        }
      } else {
        addMessage('error', `Validation failed: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      addMessage('error', `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsValidating(false);
      setTimeout(() => updateProgress(0, ''), 3000);
    }
  }, [selectedFile, clearMessages, updateProgress, addMessage]);

  const getImportPreview = useCallback(async () => {
    if (!selectedFile) return;

    try {
      updateProgress(25, 'Generating import preview...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      updateProgress(75, 'Processing preview data...');

      if (result.success) {
        setImportPreview(result.data);
        updateProgress(100, 'Preview generated successfully');
        addMessage('info', 'Import preview ready');
      } else {
        addMessage('error', `Preview failed: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Preview error:', error);
      addMessage('error', `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTimeout(() => updateProgress(0, ''), 3000);
    }
  }, [selectedFile, updateProgress, addMessage]);

  const executeImport = useCallback(async () => {
    if (!selectedFile || !importPreview) return;

    try {
      setIsImporting(true);
      clearMessages();
      updateProgress(10, 'Preparing import...');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify(importOptions));

      updateProgress(25, 'Uploading file...');

      const response = await fetch('/api/import/execute', {
        method: 'POST',
        body: formData
      });

      updateProgress(75, 'Processing import...');

      const result = await response.json();

      if (result.success) {
        const importResult: ImportResult = result.data;
        updateProgress(100, 'Import completed successfully');
        
        const totalProcessed = Object.values(importResult.recordsProcessed).reduce((sum, count) => sum + count, 0);
        addMessage('success', `Import completed! Processed ${totalProcessed} records.`);
        
        if (importResult.warnings.length > 0) {
          addMessage('warning', `${importResult.warnings.length} warnings occurred during import`);
        }

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

        // Reset state after successful import
        setTimeout(() => {
          resetImportState();
        }, 3000);
      } else {
        addMessage('error', `Import failed: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      addMessage('error', `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      setTimeout(() => updateProgress(0, ''), 3000);
    }
  }, [selectedFile, importPreview, importOptions, clearMessages, updateProgress, addMessage, resetImportState, onStatsUpdate]);

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

        {/* Progress Indicator */}
        {(isValidating || isImporting || progress.percentage > 0) && (
          <div className="space-y-2">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {progress.message}
            </p>
          </div>
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

        {/* Messages */}
        {messages.length > 0 && (
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 border rounded-md ${
                  message.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : message.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : message.type === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start">
                  {message.type === 'success' && (
                    <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                    </svg>
                  )}
                  {message.type === 'error' && (
                    <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                    </svg>
                  )}
                  {message.type === 'warning' && (
                    <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                    </svg>
                  )}
                  {message.type === 'info' && (
                    <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                    </svg>
                  )}
                  <p className={`text-sm ${
                    message.type === 'success' 
                      ? 'text-green-800 dark:text-green-200' 
                      : message.type === 'error'
                      ? 'text-red-800 dark:text-red-200'
                      : message.type === 'warning'
                      ? 'text-yellow-800 dark:text-yellow-200'
                      : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    {message.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};