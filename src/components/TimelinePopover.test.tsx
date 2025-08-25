import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelinePopover } from './TimelinePopover';
import type { TimelineEntry } from '../types/timeline';

const mockTimelineEntry: TimelineEntry = {
  malId: 12345,
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  animeType: 'tv',
  premiereDate: new Date('2023-01-15'),
  numEpisodes: 12,
  episodeDuration: 24,
  chronologicalOrder: 1,
  isMainEntry: true,
  relationshipPath: []
};

// Mock anchor element
const createMockAnchorElement = (): HTMLElement => {
  const element = document.createElement('div');
  element.getBoundingClientRect = vi.fn(() => ({
    top: 100,
    left: 200,
    bottom: 150,
    right: 250,
    width: 50,
    height: 50,
    x: 200,
    y: 100,
    toJSON: vi.fn()
  }));
  return element;
};

describe('TimelinePopover', () => {
  const mockOnClose = vi.fn();
  let mockAnchorElement: HTMLElement;

  beforeEach(() => {
    mockOnClose.mockClear();
    mockAnchorElement = createMockAnchorElement();
    
    // Mock window properties
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('renders popover with anime information', () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Test Anime English')).toBeInTheDocument();
    expect(screen.getByText('Test Anime')).toBeInTheDocument();
    expect(screen.getByText('TV Series')).toBeInTheDocument();
    expect(screen.getByText('#1 in timeline')).toBeInTheDocument();
    expect(screen.getByText('Premiered: January 14, 2023')).toBeInTheDocument();
    expect(screen.getByText('12 episodes (24 min each)')).toBeInTheDocument();
  });

  it('shows main timeline entry indicator', () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Main timeline entry')).toBeInTheDocument();
  });

  it('does not show main timeline indicator for non-main entries', () => {
    const nonMainEntry = { ...mockTimelineEntry, isMainEntry: false };
    
    render(
      <TimelinePopover
        entry={nonMainEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.queryByText('Main timeline entry')).not.toBeInTheDocument();
  });

  it('handles missing English title gracefully', () => {
    const entryWithoutEnglishTitle = {
      ...mockTimelineEntry,
      titleEnglish: null
    };

    render(
      <TimelinePopover
        entry={entryWithoutEnglishTitle}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Test Anime')).toBeInTheDocument();
    expect(screen.queryByText('Test Anime English')).not.toBeInTheDocument();
  });

  it('handles missing premiere date gracefully', () => {
    const entryWithoutDate = {
      ...mockTimelineEntry,
      premiereDate: null
    };

    render(
      <TimelinePopover
        entry={entryWithoutDate}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Premiered: Unknown')).toBeInTheDocument();
  });

  it('handles missing episode information gracefully', () => {
    const entryWithoutEpisodes = {
      ...mockTimelineEntry,
      numEpisodes: null,
      episodeDuration: null
    };

    render(
      <TimelinePopover
        entry={entryWithoutEpisodes}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Unknown episodes')).toBeInTheDocument();
  });

  it('formats single episode correctly', () => {
    const singleEpisodeEntry = {
      ...mockTimelineEntry,
      numEpisodes: 1,
      episodeDuration: 90
    };

    render(
      <TimelinePopover
        entry={singleEpisodeEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('1 episode (90 min each)')).toBeInTheDocument();
  });

  it('displays correct type labels for different anime types', () => {
    const movieEntry = { ...mockTimelineEntry, animeType: 'movie' as const };
    
    const { rerender } = render(
      <TimelinePopover
        entry={movieEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('Movie')).toBeInTheDocument();

    const ovaEntry = { ...mockTimelineEntry, animeType: 'ova' as const };
    rerender(
      <TimelinePopover
        entry={ovaEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('OVA (Original Video Animation)')).toBeInTheDocument();

    const onaEntry = { ...mockTimelineEntry, animeType: 'ona' as const };
    rerender(
      <TimelinePopover
        entry={onaEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    expect(screen.getByText('ONA (Original Net Animation)')).toBeInTheDocument();
  });

  it('includes MyAnimeList link', () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    const malLink = screen.getByText('View on MyAnimeList');
    expect(malLink).toBeInTheDocument();
    expect(malLink.closest('a')).toHaveAttribute('href', 'https://myanimelist.net/anime/12345');
    expect(malLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(malLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('closes popover when clicking outside', async () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    // Click outside the popover
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('closes popover when pressing Escape key', async () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('does not close popover when clicking inside', async () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    const popover = screen.getByText('Test Anime English').closest('div');
    fireEvent.mouseDown(popover!);

    // Wait a bit to ensure onClose is not called
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('repositions on window resize', async () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={mockAnchorElement}
      />
    );

    // Change window size
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

    fireEvent.resize(window);

    // The component should still render without errors
    expect(screen.getByText('Test Anime English')).toBeInTheDocument();
  });

  it('handles null anchor element gracefully', () => {
    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={null}
      />
    );

    // The component should still render, positioned at 0,0
    expect(screen.getByText('Test Anime English')).toBeInTheDocument();
  });

  it('calculates position correctly for different placements', () => {
    // Test bottom placement when there's not enough space above
    const lowAnchorElement = createMockAnchorElement();
    lowAnchorElement.getBoundingClientRect = vi.fn(() => ({
      top: 10, // Very close to top of viewport
      left: 200,
      bottom: 60,
      right: 250,
      width: 50,
      height: 50,
      x: 200,
      y: 10,
      toJSON: vi.fn()
    }));

    render(
      <TimelinePopover
        entry={mockTimelineEntry}
        onClose={mockOnClose}
        anchorElement={lowAnchorElement}
      />
    );

    expect(screen.getByText('Test Anime English')).toBeInTheDocument();
  });
});