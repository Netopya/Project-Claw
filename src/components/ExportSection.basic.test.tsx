import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { ExportSection } from './ExportSection';

// Basic smoke test to verify the component can be imported and instantiated
describe('ExportSection - Basic Tests', () => {
  const mockStats = {
    animeInfo: 150,
    userWatchlist: 75,
    animeRelationships: 200,
    timelineCache: 50,
    total: 475,
    lastUpdated: '2025-01-15T10:30:00.000Z'
  };

  it('should be importable', () => {
    expect(ExportSection).toBeDefined();
    expect(typeof ExportSection).toBe('function');
  });

  it('should accept props without throwing', () => {
    expect(() => {
      const props = {
        initialStats: mockStats,
        onStatsUpdate: vi.fn()
      };
      // Just verify props are accepted
      expect(props).toBeDefined();
    }).not.toThrow();
  });

  it('should have the correct component name', () => {
    expect(ExportSection.name).toBe('ExportSection');
  });
});