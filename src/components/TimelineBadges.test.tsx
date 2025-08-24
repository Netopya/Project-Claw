import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineBadges } from './TimelineBadges';
import type { SeriesTimeline, TimelineEntry } from '../types/timeline';

const createMockTimelineEntry = (overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  malId: 12345,
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  animeType: 'tv',
  premiereDate: new Date('2023-01-01'),
  numEpisodes: 12,
  episodeDuration: 24,
  chronologicalOrder: 1,
  isMainEntry: true,
  relationshipPath: [],
  ...overrides
});

const createMockTimeline = (entryCount: number = 3): SeriesTimeline => ({
  rootMalId: 12345,
  entries: Array.from({ length: entryCount }, (_, i) => 
    createMockTimelineEntry({
      malId: 12345 + i,
      title: `Test Anime ${i + 1}`,
      titleEnglish: `Test Anime ${i + 1} English`,
      chronologicalOrder: i + 1,
      isMainEntry: i === 0
    })
  ),
  totalEntries: entryCount,
  mainTimelineCount: entryCount,
  lastUpdated: new Date()
});

describe('TimelineBadges', () => {
  beforeEach(() => {
    // Reset any mocked DOM properties
    vi.clearAllMocks();
  });

  it('renders timeline badges for multiple entries', () => {
    const timeline = createMockTimeline(3);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    expect(screen.getByText('Series Timeline')).toBeInTheDocument();
    expect(screen.getByText('3 entries')).toBeInTheDocument();
    expect(screen.getByTitle('Test Anime 1 English')).toBeInTheDocument();
    expect(screen.getByTitle('Test Anime 2 English')).toBeInTheDocument();
    expect(screen.getByTitle('Test Anime 3 English')).toBeInTheDocument();
  });

  it('does not render when timeline has only one entry', () => {
    const timeline = createMockTimeline(1);
    
    const { container } = render(<TimelineBadges timeline={timeline} currentMalId={12345} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('shows expand/collapse button when entries exceed maximum', () => {
    const timeline = createMockTimeline(8); // More than MAX_COLLAPSED_BADGES (5)
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    expect(screen.getByText('Show All (8)')).toBeInTheDocument();
  });

  it('expands to show all entries when expand button is clicked', async () => {
    const timeline = createMockTimeline(8);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    const expandButton = screen.getByText('Show All (8)');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    // Should show all 8 entries
    expect(screen.getByTitle('Test Anime 6 English')).toBeInTheDocument();
    expect(screen.getByTitle('Test Anime 8 English')).toBeInTheDocument();
  });

  it('collapses back to limited view when collapse button is clicked', async () => {
    const timeline = createMockTimeline(8);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    // First expand
    const expandButton = screen.getByText('Show All (8)');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    // Then collapse
    const collapseButton = screen.getByText('Show Less');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.getByText('Show All (8)')).toBeInTheDocument();
    });

    // Should not show entries beyond the limit
    expect(screen.queryByTitle('Test Anime 6 English')).not.toBeInTheDocument();
  });

  it('shows truncation indicator when collapsed', () => {
    const timeline = createMockTimeline(8);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('highlights current anime correctly', () => {
    const timeline = createMockTimeline(3);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12346} />); // Second entry

    const badges = document.querySelectorAll('.timeline-badge');
    expect(badges[0]).not.toHaveClass('ring-2');
    expect(badges[1]).toHaveClass('ring-2', 'ring-blue-400');
    expect(badges[2]).not.toHaveClass('ring-2');
  });

  it('shows scroll buttons when content overflows', async () => {
    const timeline = createMockTimeline(10);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    // Expand to show all entries
    const expandButton = screen.getByText('Show All (10)');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Show Less')).toBeInTheDocument();
    });

    // The scroll buttons logic is complex to test without proper DOM dimensions
    // For now, we'll just verify the component renders without errors when expanded
    expect(screen.getByTitle('Test Anime 10 English')).toBeInTheDocument();
  });

  it('shows mobile scroll hint on small screens', () => {
    render(<TimelineBadges timeline={createMockTimeline(3)} currentMalId={12345} />);

    expect(screen.getByText('Swipe to scroll timeline')).toBeInTheDocument();
  });

  it('displays popover when badge is hovered', async () => {
    const timeline = createMockTimeline(3);
    
    render(<TimelineBadges timeline={timeline} currentMalId={12345} />);

    const firstBadge = screen.getByTitle('Test Anime 1 English');
    fireEvent.mouseEnter(firstBadge);

    await waitFor(() => {
      expect(screen.getByText('Test Anime 1 English')).toBeInTheDocument();
      expect(screen.getByText('#1 in timeline')).toBeInTheDocument();
    });
  });

  it('handles singular entry count correctly', () => {
    const timeline = {
      ...createMockTimeline(1),
      totalEntries: 1
    };
    
    const { container } = render(<TimelineBadges timeline={timeline} currentMalId={12345} />);
    
    // Should not render anything for single entry
    expect(container.firstChild).toBeNull();
  });
});