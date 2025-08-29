import { useEffect, useRef, useState } from 'react';
import type { TimelineEntry, AnimeType } from '../types/timeline';

interface TimelinePopoverProps {
  entry: TimelineEntry;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
}

interface PopoverPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export function TimelinePopover({ entry, onClose, anchorElement }: TimelinePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0, placement: 'top' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate optimal position for popover
  const calculatePosition = (): PopoverPosition => {
    if (!anchorElement || !popoverRef.current) {
      return { top: 0, left: 0, placement: 'top' };
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8; // Consistent margin from viewport edges

    // Calculate available space in each direction
    const spaceAbove = anchorRect.top - margin;
    const spaceBelow = viewportHeight - anchorRect.bottom - margin;
    const spaceLeft = anchorRect.left - margin;
    const spaceRight = viewportWidth - anchorRect.right - margin;

    let placement: PopoverPosition['placement'] = 'top';
    let top: number;
    let left: number;

    // Determine optimal placement based on available space
    const needsVerticalSpace = popoverRect.height + margin;
    const needsHorizontalSpace = popoverRect.width + margin;

    // Try vertical placements first (top/bottom)
    if (spaceAbove >= needsVerticalSpace) {
      // Place above
      placement = 'top';
      top = anchorRect.top - popoverRect.height - margin;
      left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
    } else if (spaceBelow >= needsVerticalSpace) {
      // Place below
      placement = 'bottom';
      top = anchorRect.bottom + margin;
      left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
    } else if (spaceRight >= needsHorizontalSpace) {
      // Place to the right
      placement = 'right';
      top = anchorRect.top + (anchorRect.height / 2) - (popoverRect.height / 2);
      left = anchorRect.right + margin;
    } else if (spaceLeft >= needsHorizontalSpace) {
      // Place to the left
      placement = 'left';
      top = anchorRect.top + (anchorRect.height / 2) - (popoverRect.height / 2);
      left = anchorRect.left - popoverRect.width - margin;
    } else {
      // Fallback: place where there's most space, constrained to viewport
      if (spaceBelow >= spaceAbove) {
        placement = 'bottom';
        top = Math.min(anchorRect.bottom + margin, viewportHeight - popoverRect.height - margin);
        left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
      } else {
        placement = 'top';
        top = Math.max(margin, anchorRect.top - popoverRect.height - margin);
        left = anchorRect.left + (anchorRect.width / 2) - (popoverRect.width / 2);
      }
    }

    // Ensure popover stays within horizontal viewport bounds for vertical placements
    if (placement === 'top' || placement === 'bottom') {
      left = Math.max(margin, Math.min(left, viewportWidth - popoverRect.width - margin));
    }

    // Ensure popover stays within vertical viewport bounds for horizontal placements
    if (placement === 'left' || placement === 'right') {
      top = Math.max(margin, Math.min(top, viewportHeight - popoverRect.height - margin));
    }

    return { top, left, placement };
  };

  // Update position when component mounts or anchor changes
  useEffect(() => {
    if (popoverRef.current) {
      const newPosition = calculatePosition();
      setPosition(newPosition);
    }
  }, [anchorElement]);

  // Handle clicks outside popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (popoverRef.current) {
        const newPosition = calculatePosition();
        setPosition(newPosition);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [anchorElement]);

  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Unknown';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Unknown';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatEpisodeInfo = (count: number | null, duration: number | null): string => {
    if (!count) return 'Unknown episodes';
    const episodeText = count === 1 ? '1 episode' : `${count} episodes`;
    if (duration) {
      return `${episodeText} (${duration} min each)`;
    }
    return episodeText;
  };

  const getTypeLabel = (type: AnimeType): string => {
    switch (type) {
      case 'tv':
        return 'TV Series';
      case 'movie':
        return 'Movie';
      case 'ova':
        return 'OVA (Original Video Animation)';
      case 'special':
        return 'Special';
      case 'ona':
        return 'ONA (Original Net Animation)';
      case 'music':
        return 'Music Video';
      default:
        return 'Unknown Type';
    }
  };

  const getArrowClasses = (): string => {
    const baseClasses = 'absolute w-3 h-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transform rotate-45';
    
    switch (position.placement) {
      case 'top':
        return `${baseClasses} -bottom-1.5 left-1/2 -translate-x-1/2 border-t-0 border-l-0`;
      case 'bottom':
        return `${baseClasses} -top-1.5 left-1/2 -translate-x-1/2 border-b-0 border-r-0`;
      case 'left':
        return `${baseClasses} -right-1.5 top-1/2 -translate-y-1/2 border-l-0 border-b-0`;
      case 'right':
        return `${baseClasses} -left-1.5 top-1/2 -translate-y-1/2 border-r-0 border-t-0`;
      default:
        return baseClasses;
    }
  };

  if (error) {
    return (
      <div
        ref={popoverRef}
        className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm"
        style={{ top: position.top, left: position.left }}
      >
        <div className={getArrowClasses()} />
        <div className="error-state">
          <div className="flex items-center space-x-2">
            <svg className="error-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="error-state-text text-sm">Failed to load details</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm animate-scale-in"
      style={{ top: position.top, left: position.left }}
    >
      {/* Arrow */}
      <div className={getArrowClasses()} />
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading details...</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="space-y-3">
          {/* Title */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
              {entry.titleEnglish || entry.title}
            </h3>
            {entry.titleEnglish && entry.title !== entry.titleEnglish && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {entry.title}
              </p>
            )}
          </div>

          {/* Type and chronological position */}
          <div className="flex items-center justify-between text-xs">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {getTypeLabel(entry.animeType)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              #{entry.chronologicalOrder} in timeline
            </span>
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Premiered: {formatDate(entry.premiereDate)}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z" />
              </svg>
              <span>{formatEpisodeInfo(entry.numEpisodes, entry.episodeDuration)}</span>
            </div>

            {entry.isMainEntry && (
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Main timeline entry</span>
              </div>
            )}
          </div>

          {/* MyAnimeList link */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <a
              href={`https://myanimelist.net/anime/${entry.malId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on MyAnimeList
            </a>
          </div>
        </div>
      )}
    </div>
  );
}