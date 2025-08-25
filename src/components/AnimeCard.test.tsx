import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimeCard } from './AnimeCard';
import type { SeriesTimeline, TimelineEntry } from '../types/timeline';

// Mock the drag and drop dependencies
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}));

// Mock TimelineBadges component
vi.mock('./TimelineBadges', () => ({
  TimelineBadges: ({ timeline, currentMalId }: { timeline: SeriesTimeline; currentMalId: number }) => (
    <div data-testid="timeline-badges">
      <span>Timeline for {currentMalId}</span>
      <span>{timeline.totalEntries} entries</span>
    </div>
  ),
}));

const createMockAnime = (overrides = {}) => ({
  id: 1,
  malId: 12345,
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  titleJapanese: 'テストアニメ',
  imageUrl: 'https://example.com/image.jpg',
  rating: 8.5,
  premiereDate: '2023-01-01',
  numEpisodes: 12,
  seriesInfo: null,
  priority: 1,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

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
  ...overrides,
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

describe('AnimeCard', () => {
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders anime card with basic information', () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('Test Anime English')).toBeInTheDocument();
      expect(screen.getByText('テストアニメ')).toBeInTheDocument();
      expect(screen.getByText('8.5')).toBeInTheDocument();
      expect(screen.getByText('12 episodes')).toBeInTheDocument();
      expect(screen.getByText('Premiered Dec 2022')).toBeInTheDocument();
    });

    it('renders with English title when titleEnglish is available', () => {
      const anime = createMockAnime({
        title: 'Original Title',
        titleEnglish: 'English Title',
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('English Title')).toBeInTheDocument();
    });

    it('falls back to original title when titleEnglish is null', () => {
      const anime = createMockAnime({
        title: 'Original Title',
        titleEnglish: null,
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('Original Title')).toBeInTheDocument();
    });

    it('handles missing image gracefully', () => {
      const anime = createMockAnime({ imageUrl: null });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      // Should show placeholder icon instead of image
      const placeholderIcon = document.querySelector('svg');
      expect(placeholderIcon).toBeInTheDocument();
    });

    it('formats rating correctly', () => {
      const anime = createMockAnime({ rating: 7.23 });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('7.2')).toBeInTheDocument();
    });

    it('shows N/A for null rating', () => {
      const anime = createMockAnime({ rating: null });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('formats episode count correctly', () => {
      const anime = createMockAnime({ numEpisodes: 1 });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('1 episode')).toBeInTheDocument();
    });

    it('shows Unknown for null episode count', () => {
      const anime = createMockAnime({ numEpisodes: null });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Series Information', () => {
    it('displays series badge for multi-part series', () => {
      const anime = createMockAnime({
        seriesInfo: { totalSeries: 2, currentPosition: 1 }
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('Part 1 of 2')).toBeInTheDocument();
    });

    it('displays season information for longer series', () => {
      const anime = createMockAnime({
        seriesInfo: { totalSeries: 4, currentPosition: 2 }
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByText('Season 2 of 4')).toBeInTheDocument();
    });

    it('does not show series badge for single series', () => {
      const anime = createMockAnime({
        seriesInfo: { totalSeries: 1, currentPosition: 1 }
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.queryByText('Part 1 of 1')).not.toBeInTheDocument();
    });
  });

  describe('Timeline Integration', () => {
    it('does not show timeline section when no timeline data is provided', () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.queryByTestId('timeline-badges')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading timeline...')).not.toBeInTheDocument();
    });

    it('shows loading state when timeline is loading', () => {
      const anime = createMockAnime();
      
      render(
        <AnimeCard 
          anime={anime} 
          onRemove={mockOnRemove} 
          timelineLoading={true}
        />
      );

      expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
      expect(screen.queryByTestId('timeline-badges')).not.toBeInTheDocument();
    });

    it('shows error state when timeline loading fails', () => {
      const anime = createMockAnime();
      
      render(
        <AnimeCard 
          anime={anime} 
          onRemove={mockOnRemove} 
          timelineError="Failed to load timeline"
        />
      );

      expect(screen.getByText('Timeline unavailable')).toBeInTheDocument();
      expect(screen.queryByTestId('timeline-badges')).not.toBeInTheDocument();
    });

    it('renders TimelineBadges component when timeline data is available', () => {
      const anime = createMockAnime();
      const timeline = createMockTimeline(3);
      
      render(
        <AnimeCard 
          anime={anime} 
          onRemove={mockOnRemove} 
          timeline={timeline}
        />
      );

      expect(screen.getByTestId('timeline-badges')).toBeInTheDocument();
      expect(screen.getByText('Timeline for 12345')).toBeInTheDocument();
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    it('does not show timeline section when timeline is loading but no error or data', () => {
      const anime = createMockAnime();
      
      render(
        <AnimeCard 
          anime={anime} 
          onRemove={mockOnRemove} 
          timelineLoading={false}
          timelineError={null}
          timeline={null}
        />
      );

      expect(screen.queryByTestId('timeline-badges')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading timeline...')).not.toBeInTheDocument();
      expect(screen.queryByText('Timeline unavailable')).not.toBeInTheDocument();
    });

    it('prioritizes timeline data over loading/error states', () => {
      const anime = createMockAnime();
      const timeline = createMockTimeline(2);
      
      render(
        <AnimeCard 
          anime={anime} 
          onRemove={mockOnRemove} 
          timeline={timeline}
          timelineLoading={true}
          timelineError="Some error"
        />
      );

      // Should show timeline data, not loading or error
      expect(screen.getByTestId('timeline-badges')).toBeInTheDocument();
      expect(screen.queryByText('Loading timeline...')).not.toBeInTheDocument();
      expect(screen.queryByText('Timeline unavailable')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('shows remove confirmation when remove button is clicked', async () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const removeButton = screen.getByTitle('Remove from watchlist');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Remove Anime?')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to remove "Test Anime English"/)).toBeInTheDocument();
      });
    });

    it('calls onRemove when removal is confirmed', async () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      // Click remove button
      const removeButton = screen.getByTitle('Remove from watchlist');
      fireEvent.click(removeButton);

      // Confirm removal
      await waitFor(() => {
        const confirmButton = screen.getByText('Remove');
        fireEvent.click(confirmButton);
      });

      expect(mockOnRemove).toHaveBeenCalledWith(1);
    });

    it('cancels removal when cancel button is clicked', async () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      // Click remove button
      const removeButton = screen.getByTitle('Remove from watchlist');
      fireEvent.click(removeButton);

      // Cancel removal
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
      });

      expect(mockOnRemove).not.toHaveBeenCalled();
      expect(screen.queryByText('Remove Anime?')).not.toBeInTheDocument();
    });

    it('opens MyAnimeList link in new tab', () => {
      const anime = createMockAnime({ malId: 54321 });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const malLink = screen.getByText('View on MyAnimeList');
      expect(malLink).toHaveAttribute('href', 'https://myanimelist.net/anime/54321');
      expect(malLink).toHaveAttribute('target', '_blank');
      expect(malLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Image Loading', () => {
    it('shows loading spinner while image is loading', () => {
      const anime = createMockAnime({ imageUrl: 'https://example.com/image.jpg' });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      // Initially should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('handles image load error gracefully', () => {
      const anime = createMockAnime({ imageUrl: 'https://example.com/broken-image.jpg' });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const image = screen.getByAltText('Test Anime English');
      
      // Simulate image error
      fireEvent.error(image);

      // Should show placeholder icon after error
      const placeholderIcon = document.querySelector('svg');
      expect(placeholderIcon).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('applies dragging styles when isDragging is true', () => {
      const anime = createMockAnime();
      
      const { container } = render(
        <AnimeCard anime={anime} onRemove={mockOnRemove} isDragging={true} />
      );

      const cardElement = container.firstChild as HTMLElement;
      expect(cardElement).toHaveClass('opacity-50', 'shadow-lg', 'scale-105');
    });

    it('does not apply dragging styles when isDragging is false', () => {
      const anime = createMockAnime();
      
      const { container } = render(
        <AnimeCard anime={anime} onRemove={mockOnRemove} isDragging={false} />
      );

      const cardElement = container.firstChild as HTMLElement;
      expect(cardElement).not.toHaveClass('opacity-50', 'shadow-lg', 'scale-105');
    });

    it('renders drag handle with proper accessibility', () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const dragHandle = screen.getByTitle('Drag to reorder');
      expect(dragHandle).toBeInTheDocument();
      expect(dragHandle).toHaveClass('cursor-grab');
    });

    it('accepts isDragging prop for drag overlay styling', () => {
      const anime = createMockAnime();
      
      // The isDragging prop is mainly used for drag overlays
      // It doesn't directly affect styling but should be accepted without errors
      render(
        <AnimeCard anime={anime} onRemove={mockOnRemove} isDragging={true} />
      );

      // Should render without errors
      expect(screen.getByText('Test Anime English')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper alt text for anime image', () => {
      const anime = createMockAnime({
        titleEnglish: 'My Anime Title',
        imageUrl: 'https://example.com/image.jpg'
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const image = screen.getByAltText('My Anime Title');
      expect(image).toBeInTheDocument();
    });

    it('provides proper title attributes for truncated text', () => {
      const anime = createMockAnime({
        titleEnglish: 'Very Long Anime Title That Might Get Truncated',
        titleJapanese: 'とても長いアニメのタイトル'
      });
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      const titleElement = screen.getByTitle('Very Long Anime Title That Might Get Truncated');
      expect(titleElement).toBeInTheDocument();
      
      const japaneseTitleElement = screen.getByTitle('とても長いアニメのタイトル');
      expect(japaneseTitleElement).toBeInTheDocument();
    });

    it('provides proper button labels and titles', () => {
      const anime = createMockAnime();
      
      render(<AnimeCard anime={anime} onRemove={mockOnRemove} />);

      expect(screen.getByTitle('Remove from watchlist')).toBeInTheDocument();
      expect(screen.getByTitle('Drag to reorder')).toBeInTheDocument();
    });
  });
});