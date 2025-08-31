import React, { useState, useCallback } from 'react';
import { ExportSection } from './ExportSection';
import { ImportSection } from './ImportSection';
import type { DatabaseStats } from '../types/export-import';

interface ExportImportManagerProps {
  initialStats: DatabaseStats;
}

export const ExportImportManager: React.FC<ExportImportManagerProps> = ({ initialStats }) => {
  const [stats, setStats] = useState<DatabaseStats>(initialStats);
  
  const handleStatsUpdate = useCallback((newStats: DatabaseStats) => {
    setStats(newStats);
  }, []);

  return (
    <div className="space-y-8">
      <ExportSection 
        initialStats={stats} 
        onStatsUpdate={handleStatsUpdate} 
      />
      <ImportSection 
        onStatsUpdate={handleStatsUpdate} 
      />
    </div>
  );
};