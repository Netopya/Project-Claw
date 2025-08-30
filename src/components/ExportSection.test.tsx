import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportSection } from './ExportSection';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock DOM methods
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

// Mock createElement to return a mock element with click method
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName) => {
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick,
      style: {},
    } as any;
  }
  return originalCreateElement.call(document, tagName);
});

document.body.appendChild = mockAppendChild;
document.body.removeChild = mockRemoveChild;

const mockStats = {
  animeInfo: 150,
  userWatchlist: 75,
  animeRelationships: 200,
  timelineCache: 50,
  total: 475,
  lastUpdated: '2025-01-15T10:30:00.000Z'
};

describe('ExportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders database statistics correctly', () => {
    render(<ExportSection initialStats={mockStats} />);
    
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('475')).toBeInTheDocument();
    expect(screen.getByText('Anime Info')).toBeInTheDocument();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('Relationships')).toBeInTheDocument();
    expect(screen.getByText('Timeline Cache')).toBeInTheDocument();
  });

  it('displays formatted last updated date', () => {
    render(<ExportSection initialStats={mockStats} />);
    
    // The date should be formatted using toLocaleString()
    const expectedDate = new Date(mockStats.lastUpdated).toLocaleString();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('renders export button with correct initial state', () => {
    render(<ExportSection initialStats={mockStats} />);
    
    const exportButton = screen.getByRole('button', { name: /export all database data/i });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).not.toBeDisabled();
    expect(screen.getByText('Export Data')).toBeInTheDocument();
  });

  it('renders refresh button with correct initial state', () => {
    render(<ExportSection initialStats={mockStats} />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).not.toBeDisabled();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  describe('Statistics Refresh', () => {
    it('successfully refreshes statistics', async () => {
      const updatedStats = {
        ...mockStats,
        animeInfo: 200,
        total: 525,
        lastUpdated: '2025-01-15T11:00:00.000Z'
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: updatedStats
        })
      });

      const onStatsUpdate = vi.fn();
      render(<ExportSection initialStats={mockStats} onStatsUpdate={onStatsUpdate} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      // Button should show loading state
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      expect(refreshButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText('200')).toBeInTheDocument(); // Updated anime count
        expect(screen.getByText('525')).toBeInTheDocument(); // Updated total
      });

      expect(onStatsUpdate).toHaveBeenCalledWith(updatedStats);
      expect(screen.getByText('Database statistics refreshed successfully')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument(); // Button text restored
      expect(refreshButton).not.toBeDisabled();
    });

    it('handles refresh error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Database connection failed'
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to refresh statistics: Database connection failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(refreshButton).not.toBeDisabled();
    });

    it('handles network error during refresh', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to refresh statistics')).toBeInTheDocument();
      });
    });
  });

  describe('Data Export', () => {
    it('successfully exports data with proper filename', async () => {
      const mockBlob = new Blob(['mock export data'], { type: 'application/json' });
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: (name: string) => name === 'Content-Disposition' ? 'attachment; filename="test-export.json"' : null
          },
          blob: async () => mockBlob
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: mockStats
          })
        });

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      // Button should show loading state
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
      expect(exportButton).toBeDisabled();

      // Progress should be visible
      await waitFor(() => {
        expect(screen.getByText('Preparing export...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Export completed successfully! Downloaded: test-export.json')).toBeInTheDocument();
      });

      // Verify file download was triggered
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      // Button should be restored
      expect(screen.getByText('Export Data')).toBeInTheDocument();
      expect(exportButton).not.toBeDisabled();
    });

    it('generates filename when not provided in headers', async () => {
      const mockBlob = new Blob(['mock export data'], { type: 'application/json' });
      
      // Mock Date to ensure consistent filename generation
      const mockDate = new Date('2025-01-15T12:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      vi.spyOn(mockDate, 'toISOString').mockReturnValue('2025-01-15T12-00-00-000Z');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => null // No Content-Disposition header
          },
          blob: async () => mockBlob
        })
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: mockStats
          })
        });

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Export completed successfully!/)).toBeInTheDocument();
      });

      // Verify the generated filename pattern
      expect(screen.getByText(/Downloaded: project-claw-export-.*\.json/)).toBeInTheDocument();
    });

    it('handles export API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Database export failed'
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export failed: Database export failed')).toBeInTheDocument();
      });

      expect(screen.getByText('Export Data')).toBeInTheDocument();
      expect(exportButton).not.toBeDisabled();
    });

    it('handles network error during export', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export failed: Network connection failed')).toBeInTheDocument();
      });
    });

    it('shows progress updates during export', async () => {
      const mockBlob = new Blob(['mock export data'], { type: 'application/json' });
      
      // Delay the response to test progress states
      mockFetch
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              ok: true,
              headers: { get: () => null },
              blob: async () => mockBlob
            }), 100)
          )
        );

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      // Check initial progress
      expect(screen.getByText('Preparing export...')).toBeInTheDocument();
      
      // Progress bar should be visible
      expect(screen.getByText('Preparing export...')).toBeInTheDocument();
    });

    it('disables refresh button during export', async () => {
      const mockBlob = new Blob(['mock export data'], { type: 'application/json' });
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            headers: { get: () => null },
            blob: async () => mockBlob
          }), 100)
        )
      );

      render(<ExportSection initialStats={mockStats} />);
      
      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      
      fireEvent.click(exportButton);

      expect(refreshButton).toBeDisabled();
      
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });
  });

  describe('Message Management', () => {
    it('auto-removes success messages after 5 seconds', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockStats
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Database statistics refreshed successfully')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('Database statistics refreshed successfully')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('does not auto-remove error messages', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Test error'
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to refresh statistics: Test error')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Error message should still be visible
      expect(screen.getByText('Failed to refresh statistics: Test error')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('displays multiple messages correctly', async () => {
      // First, trigger a refresh error
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'First error'
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to refresh statistics: First error')).toBeInTheDocument();
      });

      // Then trigger an export error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Export error'
        })
      });

      const exportButton = screen.getByRole('button', { name: /export all database data/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText('Export failed: Export error')).toBeInTheDocument();
      });

      // Both error messages should be visible
      expect(screen.getByText('Failed to refresh statistics: First error')).toBeInTheDocument();
      expect(screen.getByText('Export failed: Export error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ExportSection initialStats={mockStats} />);
      
      expect(screen.getByRole('button', { name: /export all database data/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh database statistics/i })).toBeInTheDocument();
    });

    it('maintains focus management during operations', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockStats
        })
      });

      render(<ExportSection initialStats={mockStats} />);
      
      const refreshButton = screen.getByRole('button', { name: /refresh database statistics/i });
      refreshButton.focus();
      
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });

      // Button should still be focusable after operation
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero statistics correctly', () => {
      const zeroStats = {
        animeInfo: 0,
        userWatchlist: 0,
        animeRelationships: 0,
        timelineCache: 0,
        total: 0,
        lastUpdated: '2025-01-15T10:30:00.000Z'
      };

      render(<ExportSection initialStats={zeroStats} />);
      
      expect(screen.getAllByText('0')).toHaveLength(5); // 4 individual stats + 1 total
    });

    it('handles large numbers with proper formatting', () => {
      const largeStats = {
        animeInfo: 1234567,
        userWatchlist: 987654,
        animeRelationships: 2468135,
        timelineCache: 1357924,
        total: 6048280,
        lastUpdated: '2025-01-15T10:30:00.000Z'
      };

      render(<ExportSection initialStats={largeStats} />);
      
      // Numbers should be formatted with locale-specific separators
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
      expect(screen.getByText('987,654')).toBeInTheDocument();
      expect(screen.getByText('2,468,135')).toBeInTheDocument();
      expect(screen.getByText('1,357,924')).toBeInTheDocument();
      expect(screen.getByText('6,048,280')).toBeInTheDocument();
    });

    it('handles invalid date gracefully', () => {
      const invalidDateStats = {
        ...mockStats,
        lastUpdated: 'invalid-date'
      };

      render(<ExportSection initialStats={invalidDateStats} />);
      
      // Should not crash and should display something
      expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
    });
  });
});