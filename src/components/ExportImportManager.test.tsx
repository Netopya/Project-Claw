import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportImportManager } from './ExportImportManager';
import type { DatabaseStats } from '../types/export-import';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockStats: DatabaseStats = {
  animeInfo: 100,
  userWatchlist: 50,
  animeRelationships: 25,
  timelineCache: 10,
  total: 185,
  lastUpdated: '2023-01-01T00:00:00.000Z'
};

describe('ExportImportManager', () => {
  it('renders both export and import sections', () => {
    render(<ExportImportManager initialStats={mockStats} />);
    
    // Check for export section
    expect(screen.getByText('Current Database Statistics')).toBeInTheDocument();
    expect(screen.getAllByText('Export Data')).toHaveLength(2); // heading and button
    
    // Check for import section
    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText('Drop your import file here')).toBeInTheDocument();
  });

  it('displays initial statistics correctly', () => {
    render(<ExportImportManager initialStats={mockStats} />);
    
    expect(screen.getByText('100')).toBeInTheDocument(); // animeInfo
    expect(screen.getByText('50')).toBeInTheDocument(); // userWatchlist
    expect(screen.getByText('25')).toBeInTheDocument(); // animeRelationships
    expect(screen.getByText('10')).toBeInTheDocument(); // timelineCache
  });
});