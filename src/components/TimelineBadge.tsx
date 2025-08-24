import { useState, useRef } from 'react';
import type { TimelineEntry, AnimeType } from '../types/timeline';

interface TimelineBadgeProps {
  entry: TimelineEntry;
  isCurrentAnime: boolean;
  isConnected: boolean;
  onHover: (entry: TimelineEntry | null, anchorElement?: HTMLElement | null) => void;
}

export function TimelineBadge({ 
  entry, 
  isCurrentAnime, 
  isConnected, 
  onHover 
}: TimelineBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const formatYear = (date: Date | string | null): string => {
    if (!date) return '?';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '?';
    return dateObj.getFullYear().toString();
  };
  
  const formatEpisodeCount = (count: number | null, duration: number | null): string => {
    if (!count) return '';
    const episodeText = count === 1 ? '1ep' : `${count}ep`;
    if (duration) {
      return `${episodeText} (${duration}m)`;
    }
    return episodeText;
  };

  const getTypeColor = (type: AnimeType): string => {
    switch (type) {
      case 'tv':
        return 'bg-blue-500 text-white';
      case 'movie':
        return 'bg-purple-500 text-white';
      case 'ova':
        return 'bg-green-500 text-white';
      case 'special':
        return 'bg-orange-500 text-white';
      case 'ona':
        return 'bg-teal-500 text-white';
      case 'music':
        return 'bg-pink-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getTypeLabel = (type: AnimeType): string => {
    switch (type) {
      case 'tv':
        return 'TV';
      case 'movie':
        return 'Movie';
      case 'ova':
        return 'OVA';
      case 'special':
        return 'Special';
      case 'ona':
        return 'ONA';
      case 'music':
        return 'Music';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <div className="timeline-badge-wrapper flex items-center">
      <div 
        ref={badgeRef}
        className={`
          timeline-badge relative px-2 py-1 rounded-lg text-xs font-medium cursor-pointer
          transition-all duration-200 hover:scale-105 hover:shadow-md
          ${isCurrentAnime 
            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' 
            : ''
          }
          ${getTypeColor(entry.animeType)}
        `}
        onMouseEnter={() => onHover(entry, badgeRef.current)}
        onMouseLeave={() => onHover(null, null)}
        title={entry.titleEnglish || entry.title}
      >
        <div className="flex flex-col items-center space-y-0.5 min-w-0">
          <div className="font-semibold text-center truncate w-full">
            {getTypeLabel(entry.animeType)}
          </div>
          <div className="text-center opacity-90">
            {formatYear(entry.premiereDate)}
          </div>
          {entry.numEpisodes && (
            <div className="text-center opacity-80 text-xs">
              {formatEpisodeCount(entry.numEpisodes, entry.episodeDuration)}
            </div>
          )}
        </div>
        
        {/* Current anime indicator */}
        {isCurrentAnime && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full border-2 border-white dark:border-gray-800"></div>
        )}
      </div>
      
      {/* Timeline connector arrow */}
      {isConnected && (
        <div className="timeline-connector flex items-center px-1">
          <svg 
            className="w-4 h-4 text-gray-400 dark:text-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M9 5l7 7-7 7" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}