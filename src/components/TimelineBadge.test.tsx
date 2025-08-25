import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineBadge } from './TimelineBadge';
import type { TimelineEntry } from '../types/timeline';

const mockTimelineEntry: TimelineEntry = {
  malId: 12345,
  title: 'Test Anime',
  titleEnglish: 'Test Anime English',
  animeType: 'tv',
  premiereDate: new Date('2023-01-01'),
  numEpisodes: 12,
  episodeDuration: 24,
  chronologicalOrder: 1,
  isMainEntry: true,
  relationshipPath: []
};

describe('TimelineBadge', () => {
  const mockOnHover = vi.fn();

  beforeEach(() => {
    mockOnHover.mockClear();
  });

  it('renders timeline badge with correct information', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText('12ep (24m)')).toBeInTheDocument();
  });

  it('shows current anime indicator when isCurrentAnime is true', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={true}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    const badge = screen.getByTitle('Test Anime English');
    expect(badge).toHaveClass('ring-2', 'ring-blue-400');
  });

  it('displays connector arrow when isConnected is true', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    const connector = document.querySelector('.timeline-connector');
    expect(connector).toBeInTheDocument();
  });

  it('does not display connector arrow when isConnected is false', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={false}
        isConnected={false}
        onHover={mockOnHover}
      />
    );

    const connector = document.querySelector('.timeline-connector');
    expect(connector).not.toBeInTheDocument();
  });

  it('calls onHover with entry and anchor element on mouse enter', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    const badge = screen.getByTitle('Test Anime English');
    fireEvent.mouseEnter(badge);

    expect(mockOnHover).toHaveBeenCalledWith(mockTimelineEntry, expect.any(HTMLElement));
  });

  it('calls onHover with null on mouse leave', () => {
    render(
      <TimelineBadge
        entry={mockTimelineEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    const badge = screen.getByTitle('Test Anime English');
    fireEvent.mouseLeave(badge);

    expect(mockOnHover).toHaveBeenCalledWith(null, null);
  });

  it('displays correct type colors for different anime types', () => {
    const movieEntry = { ...mockTimelineEntry, animeType: 'movie' as const };
    
    const { rerender } = render(
      <TimelineBadge
        entry={movieEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    let badge = screen.getByTitle('Test Anime English');
    expect(badge).toHaveClass('bg-purple-500');

    const ovaEntry = { ...mockTimelineEntry, animeType: 'ova' as const };
    rerender(
      <TimelineBadge
        entry={ovaEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    badge = screen.getByTitle('Test Anime English');
    expect(badge).toHaveClass('bg-green-500');
  });

  it('handles missing episode information gracefully', () => {
    const entryWithoutEpisodes = {
      ...mockTimelineEntry,
      numEpisodes: null,
      episodeDuration: null
    };

    render(
      <TimelineBadge
        entry={entryWithoutEpisodes}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.queryByText(/ep/)).not.toBeInTheDocument();
  });

  it('handles missing premiere date gracefully', () => {
    const entryWithoutDate = {
      ...mockTimelineEntry,
      premiereDate: null
    };

    render(
      <TimelineBadge
        entry={entryWithoutDate}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('uses title as fallback when titleEnglish is not available', () => {
    const entryWithoutEnglishTitle = {
      ...mockTimelineEntry,
      titleEnglish: null
    };

    render(
      <TimelineBadge
        entry={entryWithoutEnglishTitle}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    const badge = screen.getByTitle('Test Anime');
    expect(badge).toBeInTheDocument();
  });

  it('formats single episode correctly', () => {
    const singleEpisodeEntry = {
      ...mockTimelineEntry,
      numEpisodes: 1,
      episodeDuration: 90
    };

    render(
      <TimelineBadge
        entry={singleEpisodeEntry}
        isCurrentAnime={false}
        isConnected={true}
        onHover={mockOnHover}
      />
    );

    expect(screen.getByText('1ep (90m)')).toBeInTheDocument();
  });
});