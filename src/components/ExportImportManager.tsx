import React, { useState, useCallback, useEffect } from 'react';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { ExportImportErrorBoundary } from './ExportImportErrorBoundary';
import { apiFetch } from '../utils/api-config.js';
import type { DatabaseStats } from '../types/export-import';

interface ExportImportManagerProps {
  initialStats: DatabaseStats | null;
}

export const ExportImportManager: React.FC<ExportImportManagerProps> = ({ initialStats }) => {
  const [stats, setStats] = useState<DatabaseStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState(!initialStats);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats client-side if not provided (production build scenario)
  useEffect(() => {
    if (!initialStats) {
      fetchStats();
    }
  }, [initialStats]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiFetch('/api/export/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }
      
      const statsData = await response.json();
      setStats(statsData);
      // Clear error on successful fetch
      setError(null);
    } catch (err) {
      console.error('Error fetching database statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load database statistics');
      
      // Provide fallback stats
      setStats({
        animeInfo: 0,
        userWatchlist: 0,
        animeRelationships: 0,
        timelineCache: 0,
        total: 0,
        lastUpdated: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStatsUpdate = useCallback((newStats: DatabaseStats) => {
    setStats(newStats);
  }, []);

  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    // Log error for debugging
    console.error('Export/Import Error:', error, errorInfo);
    
    // Could send to error reporting service here
    // errorReportingService.report(error, errorInfo);
  }, []);

  // Show loading state while fetching stats
  if (isLoading) {
    return (
      <div className="space-y-8 mt-8">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading database statistics...</p>
        </div>
      </div>
    );
  }

  // Show error state if stats failed to load
  if (error && !stats) {
    return (
      <div className="space-y-8 mt-8">
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">⚠️ Error loading database statistics</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render normally once stats are available
  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-8 mt-8">
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
          <div className="text-yellow-800">
            <strong>Warning:</strong> {error}
          </div>
        </div>
      )}
      
      <ExportImportErrorBoundary onError={handleError}>
        <ExportSection 
          initialStats={stats} 
          onStatsUpdate={handleStatsUpdate} 
        />
      </ExportImportErrorBoundary>
      
      <ExportImportErrorBoundary onError={handleError}>
        <ImportSection 
          onStatsUpdate={handleStatsUpdate} 
        />
      </ExportImportErrorBoundary>
    </div>
  );
};