import { useState, useRef, useEffect } from 'react';
import { TimelineBadge } from './TimelineBadge';
import { TimelinePopover } from './TimelinePopover';
import type { SeriesTimeline, TimelineEntry } from '../types/timeline';

interface TimelineBadgesProps {
  timeline: SeriesTimeline;
  currentMalId: number;
}

export function TimelineBadges({ timeline, currentMalId }: TimelineBadgesProps) {
  const [hoveredEntry, setHoveredEntry] = useState<TimelineEntry | null>(null);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Maximum number of badges to show when collapsed
  const MAX_COLLAPSED_BADGES = 5;
  const shouldTruncate = timeline.entries.length > MAX_COLLAPSED_BADGES;
  const displayedEntries = isExpanded ? timeline.entries : timeline.entries.slice(0, MAX_COLLAPSED_BADGES);

  // Check scroll state
  const checkScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    setShowScrollButtons(scrollWidth > clientWidth);
  };

  // Handle scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollState();
    container.addEventListener('scroll', checkScrollState);
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', checkScrollState);
      resizeObserver.disconnect();
    };
  }, [displayedEntries]);

  // Scroll functions
  const scrollLeft = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.scrollBy({
      left: -200,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.scrollBy({
      left: 200,
      behavior: 'smooth'
    });
  };

  // Auto-scroll to current anime on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentIndex = displayedEntries.findIndex(entry => entry.malId === currentMalId);
    if (currentIndex === -1) return;

    // Calculate approximate position of current badge
    const badgeWidth = 80; // Approximate badge width
    const scrollPosition = currentIndex * badgeWidth - container.clientWidth / 2;
    
    container.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });
  }, [currentMalId, displayedEntries]);

  if (timeline.entries.length <= 1) {
    return null; // Don't show timeline for single entries
  }

  return (
    <div className="timeline-badges-container mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Series Timeline
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {timeline.totalEntries} {timeline.totalEntries === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        
        {/* Expand/Collapse button */}
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            {isExpanded ? 'Show Less' : `Show All (${timeline.entries.length})`}
          </button>
        )}
      </div>

      {/* Timeline container with scroll controls */}
      <div className="relative">
        {/* Left scroll button */}
        {showScrollButtons && canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right scroll button */}
        {showScrollButtons && canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Scrollable timeline badges */}
        <div 
          ref={scrollContainerRef}
          className={`
            timeline-badges-scroll flex items-center space-x-1 overflow-x-auto scrollbar-hide
            ${showScrollButtons ? 'px-10' : ''}
          `}
          style={{
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
        >
          {displayedEntries.map((entry, index) => (
            <TimelineBadge
              key={entry.malId}
              entry={entry}
              isCurrentAnime={entry.malId === currentMalId}
              isConnected={index < displayedEntries.length - 1}
              onHover={(entry, anchor) => {
                setHoveredEntry(entry);
                setAnchorElement(anchor);
              }}
            />
          ))}
          
          {/* Truncation indicator */}
          {shouldTruncate && !isExpanded && (
            <div className="flex items-center px-2">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                +{timeline.entries.length - MAX_COLLAPSED_BADGES} more
              </button>
            </div>
          )}
        </div>

        {/* Gradient overlays for scroll indication */}
        {showScrollButtons && (
          <>
            {canScrollLeft && (
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-800 to-transparent pointer-events-none" />
            )}
            {canScrollRight && (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-800 to-transparent pointer-events-none" />
            )}
          </>
        )}
      </div>

      {/* Touch scroll hint for mobile */}
      <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-center sm:hidden">
        Swipe to scroll timeline
      </div>

      {/* Timeline Popover */}
      {hoveredEntry && anchorElement && (
        <TimelinePopover 
          entry={hoveredEntry}
          anchorElement={anchorElement}
          onClose={() => {
            setHoveredEntry(null);
            setAnchorElement(null);
          }}
        />
      )}
    </div>
  );
}