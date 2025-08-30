import { useState, useEffect, useRef } from 'react';
import * as DndKitSortable from '@dnd-kit/sortable';
import * as DndKitUtilities from '@dnd-kit/utilities';
import { TimelineBadges } from './TimelineBadges';
import type { SeriesTimeline } from '../types/timeline';

const { useSortable } = DndKitSortable;
const { CSS } = DndKitUtilities;

interface Anime {
  id: number;
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  imageUrl: string | null;
  rating: number | null;
  premiereDate: string | null;
  numEpisodes: number | null;
  seriesInfo: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface AnimeCardProps {
  anime: Anime;
  onRemove: (id: number) => void;
  isDragging?: boolean;
  timeline?: SeriesTimeline | null;
  timelineLoading?: boolean;
  timelineError?: string | null;
}

export function AnimeCard({
  anime,
  onRemove,
  isDragging = false,
  timeline = null,
  timelineLoading = false,
  timelineError = null
}: AnimeCardProps) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!anime.imageUrl);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset image state when anime changes
  useEffect(() => {
    setImageError(false);
    setImageLoading(!!anime.imageUrl);
  }, [anime.imageUrl, anime.id]);

  // Check if image is already loaded (for cached images)
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalHeight !== 0) {
      console.log('Image already loaded (cached):', anime.title);
      setImageLoading(false);
    }
  }, [anime.imageUrl, anime.title]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: anime.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRemoveClick = () => {
    setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = () => {
    onRemove(anime.id);
    setShowRemoveConfirm(false);
  };

  const handleCancelRemove = () => {
    setShowRemoveConfirm(false);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log('Image loaded:', anime.title, e.currentTarget.src);
    setImageLoading(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log('Image error:', anime.title, e.currentTarget.src);
    setImageError(true);
    setImageLoading(false);
  };

  const formatRating = (rating: number | null): string => {
    if (!rating) return 'N/A';
    return rating.toFixed(1);
  };

  const formatEpisodes = (episodes: number | null): string => {
    if (!episodes) return 'Unknown';
    return episodes === 1 ? '1 episode' : `${episodes} episodes`;
  };

  const formatPremiereDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short'
      });
    } catch {
      return 'Unknown';
    }
  };

  const formatSeriesInfo = (seriesInfo: any): string | null => {
    if (!seriesInfo || seriesInfo.totalSeries <= 1) return null;

    const { totalSeries, currentPosition } = seriesInfo;

    if (totalSeries === 2) {
      return currentPosition === 1 ? 'Part 1 of 2' : 'Part 2 of 2';
    }

    if (totalSeries <= 4) {
      return `Season ${currentPosition} of ${totalSeries}`;
    }

    return `Part ${currentPosition} of ${totalSeries}`;
  };

  const seriesLabel = formatSeriesInfo(anime.seriesInfo);
  const displayTitle = anime.titleEnglish || anime.title;
  const hasJapaneseTitle = anime.titleJapanese && anime.titleJapanese !== displayTitle;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
        hover:shadow-md transition-all duration-200 overflow-hidden
        ${(isSortableDragging || isDragging) ? 'opacity-50 shadow-lg scale-105' : ''}
      `}
    >
      <div className="flex items-stretch">
        {/* Image Section */}
        <div className="flex-shrink-0 w-24 sm:w-32 h-32 sm:h-40 relative bg-gray-100 dark:bg-gray-700 self-center">
          {/* Loading spinner - only show when we have an image URL and it's loading */}
          {imageLoading && anime.imageUrl && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          )}

          {anime.imageUrl && !imageError ? (
            <img
              ref={imgRef}
              src={anime.imageUrl}
              alt={displayTitle}
              className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Series Badge */}
          {seriesLabel && (
            <div className="absolute bottom-1 left-1 right-1">
              <span className="inline-block w-full text-center px-1 py-0.5 bg-blue-600 text-white text-xs font-medium rounded truncate">
                {seriesLabel}
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex">
            <div className="flex-1">
              {/* Title Section - Now without buttons */}
              <div className="mb-2 pr-20">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={displayTitle}>
                  {displayTitle}
                </h3>
                {hasJapaneseTitle && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={anime.title}>
                    {anime.title}
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-medium">{formatRating(anime.rating)}</span>
                  <span className="mx-2">•</span>
                  <span>{formatEpisodes(anime.numEpisodes)}</span>
                  <span className="mx-2">•</span>
                  <span>Premiered {formatPremiereDate(anime.premiereDate)}</span>
                </div>
              </div>
            </div>
            {/* Action Buttons - Positioned absolutely in top-right */}
            <div className="flex flex-col items-center space-y-1">
              {/* Remove Button */}
              <button
                onClick={handleRemoveClick}
                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Remove from watchlist"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* MyAnimeList Link */}
              <a
                href={`https://myanimelist.net/anime/${anime.malId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="View on MyAnimeList"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Timeline Section */}
          {(timeline || timelineLoading || timelineError) && timeline ? (
              <TimelineBadges
                timeline={timeline}
                currentMalId={anime.malId}
              />
            ) : timelineLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Loading timeline...</span>
              </div>
            ) : timelineError ? (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Timeline unavailable</span>
              </div>
            ) : null}
        </div>

        {/* Drag Handle - spans full height */}
        <div className="flex-shrink-0 flex">
          <div
            {...attributes}
            {...listeners}
            className="px-3 bg-gray-100 dark:bg-gray-700 cursor-grab active:cursor-grabbing flex items-center justify-center h-full"
            title="Drag to reorder"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 rounded-lg">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Remove Anime?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to remove "{displayTitle}" from your watchlist? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancelRemove}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}