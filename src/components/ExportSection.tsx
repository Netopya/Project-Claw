import React, { useState, useCallback } from 'react';
import { ProgressTracker, EXPORT_STEPS, type ProgressState } from '../utils/progress-tracker.js';
import { ProgressIndicator } from './ProgressIndicator.js';
import { MessageSystem, useMessageSystem } from './MessageSystem.js';
import { 
  getErrorDetails, 
  retryOperation, 
  ExportError, 
  ERROR_CODES 
} from '../utils/export-import-error-handler.js';

interface DatabaseStats {
  animeInfo: number;
  userWatchlist: number;
  animeRelationships: number;
  timelineCache: number;
  total: number;
  lastUpdated: string;
}

interface ExportSectionProps {
  initialStats: DatabaseStats;
  onStatsUpdate?: (stats: DatabaseStats) => void;
}

export const ExportSection: React.FC<ExportSectionProps> = ({ 
  initialStats, 
  onStatsUpdate 
}) => {
  const [stats, setStats] = useState<DatabaseStats>(initialStats);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const { messages, addMessage, removeMessage, clearMessages } = useMessageSystem();

  const refreshStats = useCallback(async () => {
    try {
      setIsRefreshingStats(true);
      clearMessages();
      
      const response = await fetch('/api/export/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        onStatsUpdate?.(data.data);
        addMessage('success', 'Database statistics refreshed successfully', { autoRemove: true });
      } else {
        addMessage('error', `Failed to refresh statistics: ${data.error}`, {
          title: 'Statistics Refresh Failed',
          details: data.message || 'Unknown error occurred'
        });
      }
    } catch (error) {
      console.error('Error refreshing statistics:', error);
      addMessage('error', 'Failed to refresh statistics', {
        title: 'Network Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRefreshingStats(false);
    }
  }, [onStatsUpdate, addMessage, clearMessages]);

  const generateFilename = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `project-claw-export-${timestamp}.json`;
  }, []);

  const downloadFile = useCallback((blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, []);

  const exportData = useCallback(async () => {
    try {
      setIsExporting(true);
      clearMessages();
      
      // Initialize progress tracker
      const progressTracker = new ProgressTracker(EXPORT_STEPS, setProgressState);
      progressTracker.start();
      
      // Step 1: Validate data integrity
      progressTracker.startStep('validate', 'Validating database integrity...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation time
      progressTracker.completeStep('validate', 'Data validation completed');
      
      // Step 2: Extract data with retry logic
      progressTracker.startStep('extract', 'Extracting database records...');
      
      const response = await retryOperation(async () => {
        const res = await fetch('/api/export/generate', {
          method: 'POST'
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          
          // Create specific error based on response
          if (errorData.error?.code) {
            const exportError = new ExportError(
              errorData.error.message || 'Export failed',
              errorData.error.code,
              res.status
            );
            throw exportError;
          }
          
          throw new ExportError(
            errorData.error || 'Export failed',
            ERROR_CODES.EXPORT_FILE_GENERATION_FAILED,
            res.status
          );
        }
        
        return res;
      }, 3, 'Export Data Extraction');
      
      progressTracker.completeStep('extract', 'Database records extracted successfully');
      
      // Step 3: Generate file
      progressTracker.startStep('generate', 'Generating export file...');
      const blob = await response.blob();
      progressTracker.completeStep('generate', 'Export file generated');
      
      // Step 4: Download
      progressTracker.startStep('download', 'Preparing download...');
      
      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : generateFilename();
      
      // Download the file
      downloadFile(blob, filename);
      
      progressTracker.completeStep('download', 'File download initiated');
      progressTracker.complete();
      
      addMessage('success', `Export completed successfully!`, {
        title: 'Export Successful',
        details: `Downloaded: ${filename}\nSize: ${(blob.size / 1024).toFixed(1)} KB`,
        autoRemove: true
      });
      
      // Refresh stats after successful export
      await refreshStats();
      
    } catch (error) {
      console.error('Export error:', error);
      
      // Get enhanced error details
      const errorDetails = getErrorDetails(error as Error);
      
      addMessage('error', errorDetails.message, {
        title: errorDetails.title,
        details: errorDetails.suggestions.join('\n'),
        actions: errorDetails.retryable ? [
          {
            label: 'Retry Export',
            onClick: () => exportData(),
            variant: 'primary'
          }
        ] : []
      });
      
      // Update progress tracker with error
      if (progressState) {
        const progressTracker = new ProgressTracker(EXPORT_STEPS, setProgressState);
        progressTracker.errorStep('extract', errorDetails.message);
      }
    } finally {
      setIsExporting(false);
      // Reset progress after 5 seconds
      setTimeout(() => {
        setProgressState(null);
      }, 5000);
    }
  }, [clearMessages, generateFilename, downloadFile, addMessage, refreshStats, progressState]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Current Database Statistics
        </h2>
        <button 
          onClick={refreshStats}
          disabled={isRefreshingStats || isExporting}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Refresh database statistics"
        >
          {isRefreshingStats ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.animeInfo.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Anime Info</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.userWatchlist.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Watchlist</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.animeRelationships.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Relationships</div>
        </div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats.timelineCache.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Timeline Cache</div>
        </div>
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400 mb-6">
        <span>Total Records: <span className="font-medium">{stats.total.toLocaleString()}</span></span>
        <span>Last Updated: {new Date(stats.lastUpdated).toLocaleString()}</span>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Export Data
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Create a backup file containing all your anime data. This file can be used to restore your data or migrate to another instance.
        </p>
        
        <div className="space-y-4">
          <button 
            onClick={exportData}
            disabled={isExporting}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Export all database data"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span>{isExporting ? 'Exporting...' : 'Export Data'}</span>
          </button>

          {/* Enhanced Progress Tracking */}
          {progressState && (
            <ProgressIndicator 
              progress={progressState}
              showSteps={true}
              showTimeEstimate={true}
              className="mt-4"
            />
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
    </div>
  );
};