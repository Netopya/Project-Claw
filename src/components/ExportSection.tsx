import React, { useState, useCallback } from 'react';

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

interface ExportProgress {
  percentage: number;
  message: string;
}

interface ExportMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ExportSection: React.FC<ExportSectionProps> = ({ 
  initialStats, 
  onStatsUpdate 
}) => {
  const [stats, setStats] = useState<DatabaseStats>(initialStats);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({ percentage: 0, message: '' });
  const [messages, setMessages] = useState<ExportMessage[]>([]);

  const addMessage = useCallback((type: ExportMessage['type'], message: string) => {
    const newMessage: ExportMessage = {
      id: Date.now().toString(),
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

  const refreshStats = useCallback(async () => {
    try {
      setIsRefreshingStats(true);
      clearMessages();
      
      const response = await fetch('/api/export/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        onStatsUpdate?.(data.data);
        addMessage('success', 'Database statistics refreshed successfully');
      } else {
        addMessage('error', `Failed to refresh statistics: ${data.error}`);
      }
    } catch (error) {
      console.error('Error refreshing statistics:', error);
      addMessage('error', 'Failed to refresh statistics');
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
      updateProgress(10, 'Preparing export...');
      
      const response = await fetch('/api/export/generate', {
        method: 'POST'
      });
      
      updateProgress(50, 'Generating export file...');
      
      if (response.ok) {
        updateProgress(90, 'Downloading file...');
        
        // Get filename from response headers or generate one
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
          : generateFilename();
        
        // Download the file
        const blob = await response.blob();
        downloadFile(blob, filename);
        
        updateProgress(100, 'Export complete!');
        addMessage('success', `Export completed successfully! Downloaded: ${filename}`);
        
        // Refresh stats after successful export
        await refreshStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      addMessage('error', `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      // Reset progress after 3 seconds
      setTimeout(() => {
        updateProgress(0, '');
      }, 3000);
    }
  }, [clearMessages, updateProgress, generateFilename, downloadFile, addMessage, refreshStats]);

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

          {/* Export Progress */}
          {isExporting && (
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

          {/* Export Messages */}
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
    </div>
  );
};