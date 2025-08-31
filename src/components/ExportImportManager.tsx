import React, { useState, useCallback } from 'react';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import { ExportImportErrorBoundary } from './ExportImportErrorBoundary';
import type { DatabaseStats } from '../types/export-import';

interface ExportImportManagerProps {
  initialStats: DatabaseStats;
}

export const ExportImportManager: React.FC<ExportImportManagerProps> = ({ initialStats }) => {
  const [stats, setStats] = useState<DatabaseStats>(initialStats);
  
  const handleStatsUpdate = useCallback((newStats: DatabaseStats) => {
    setStats(newStats);
  }, []);

  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    // Log error for debugging
    console.error('Export/Import Error:', error, errorInfo);
    
    // Could send to error reporting service here
    // errorReportingService.report(error, errorInfo);
  }, []);

  return (
    <div className="space-y-8">
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