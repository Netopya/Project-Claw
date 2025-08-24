import { useState, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

import { AddAnimeForm } from './AddAnimeForm';
import { AnimeCard } from './AnimeCard';
import { ToastContainer } from './Toast';
import { OfflineIndicator } from './OfflineIndicator';
import { WatchlistSkeleton } from './LoadingSkeleton';
import { ClientOnlyDragDrop } from './ClientOnlyDragDrop';
import { useToast } from '../hooks/useToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { handleApiResponse, getErrorMessage, retryWithDelay } from '../utils/errorHandling';
import type { SeriesTimeline } from '../types/timeline';

// Type definitions for drag events
interface DragStartEvent {
  active: { id: string | number };
}

interface DragEndEvent {
  active: { id: string | number };
  over: { id: string | number } | null;
}

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

interface WatchlistAppProps {
  initialAnime?: Anime[];
  apiError?: string | null;
}

interface TimelineState {
  [malId: number]: {
    timeline: SeriesTimeline | null;
    loading: boolean;
    error: string | null;
  };
}

interface AppState {
  anime: Anime[];
  isLoading: boolean;
  error: string | null;
  isReordering: boolean;
  draggedAnime: Anime | null;
  timelines: TimelineState;
}

export function WatchlistApp({ initialAnime = [], apiError = null }: WatchlistAppProps) {
  const [state, setState] = useState<AppState>({
    anime: initialAnime,
    isLoading: false,
    error: apiError,
    isReordering: false,
    draggedAnime: null,
    timelines: {},
  });

  const { toasts, removeToast, success, error: showError } = useToast();
  const { isOnline } = useNetworkStatus();

  // Load anime data on mount if not provided initially
  useEffect(() => {
    if (initialAnime.length === 0 && !apiError) {
      loadAnimeData();
    }
  }, []);

  // Load timeline data for anime when anime list changes
  useEffect(() => {
    if (state.anime.length > 0 && isOnline) {
      loadTimelineData();
    }
  }, [state.anime, isOnline]);

  const loadAnimeData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await retryWithDelay(async () => {
        const response = await fetch('http://localhost:3001/api/anime');
        return await handleApiResponse(response);
      }, 3); // Retry up to 3 times for loading data

      if (data.success) {
        setState(prev => ({
          ...prev,
          anime: data.data,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: data.message || 'Failed to load anime',
          isLoading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: getErrorMessage(error),
        isLoading: false,
      }));
    }
  };

  const loadTimelineData = async () => {
    // Only load timelines for anime that don't already have timeline data
    const animeNeedingTimelines = state.anime.filter(anime => 
      !state.timelines[anime.malId] || 
      (!state.timelines[anime.malId].timeline && !state.timelines[anime.malId].loading)
    );

    if (animeNeedingTimelines.length === 0) return;

    // Set loading state for all anime that need timelines
    setState(prev => ({
      ...prev,
      timelines: {
        ...prev.timelines,
        ...animeNeedingTimelines.reduce((acc, anime) => ({
          ...acc,
          [anime.malId]: {
            timeline: null,
            loading: true,
            error: null,
          }
        }), {})
      }
    }));

    // Load timelines in parallel with a small delay between requests to avoid overwhelming the API
    const timelinePromises = animeNeedingTimelines.map((anime, index) => 
      new Promise(resolve => {
        setTimeout(async () => {
          try {
            const data = await retryWithDelay(async () => {
              const response = await fetch(`http://localhost:3001/api/anime/${anime.malId}/timeline`);
              return await handleApiResponse(response);
            }, 2); // Retry up to 2 times for timeline data

            if (data.success && data.data) {
              setState(prev => ({
                ...prev,
                timelines: {
                  ...prev.timelines,
                  [anime.malId]: {
                    timeline: data.data,
                    loading: false,
                    error: null,
                  }
                }
              }));
            } else {
              setState(prev => ({
                ...prev,
                timelines: {
                  ...prev.timelines,
                  [anime.malId]: {
                    timeline: null,
                    loading: false,
                    error: data.message || 'Failed to load timeline',
                  }
                }
              }));
            }
          } catch (error) {
            setState(prev => ({
              ...prev,
              timelines: {
                ...prev.timelines,
                [anime.malId]: {
                  timeline: null,
                  loading: false,
                  error: getErrorMessage(error),
                }
              }
            }));
          }
          resolve(void 0);
        }, index * 100); // Stagger requests by 100ms
      })
    );

    await Promise.all(timelinePromises);
  };

  const handleAnimeAdded = (newAnime: Anime) => {
    setState(prev => ({
      ...prev,
      anime: [...prev.anime, newAnime].sort((a, b) => a.priority - b.priority),
    }));
    success(`Added "${newAnime.titleEnglish || newAnime.title}" to your watchlist!`);
    
    // Load timeline data for the new anime if online
    if (isOnline) {
      loadTimelineForAnime(newAnime.malId);
    }
  };

  const loadTimelineForAnime = async (malId: number) => {
    // Set loading state
    setState(prev => ({
      ...prev,
      timelines: {
        ...prev.timelines,
        [malId]: {
          timeline: null,
          loading: true,
          error: null,
        }
      }
    }));

    try {
      const data = await retryWithDelay(async () => {
        const response = await fetch(`http://localhost:3001/api/anime/${malId}/timeline`);
        return await handleApiResponse(response);
      }, 2);

      if (data.success && data.data) {
        setState(prev => ({
          ...prev,
          timelines: {
            ...prev.timelines,
            [malId]: {
              timeline: data.data,
              loading: false,
              error: null,
            }
          }
        }));
      } else {
        setState(prev => ({
          ...prev,
          timelines: {
            ...prev.timelines,
            [malId]: {
              timeline: null,
              loading: false,
              error: data.message || 'Failed to load timeline',
            }
          }
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        timelines: {
          ...prev.timelines,
          [malId]: {
            timeline: null,
            loading: false,
            error: getErrorMessage(error),
          }
        }
      }));
    }
  };

  const handleError = (errorMessage: string) => {
    showError(errorMessage);
  };

  const handleRemoveAnime = async (animeId: number) => {
    const animeToRemove = state.anime.find(a => a.id === animeId);
    if (!animeToRemove) return;

    // Check network status
    if (!isOnline) {
      showError('Cannot remove anime while offline. Please check your connection.');
      return;
    }

    // Optimistically remove from UI
    setState(prev => ({
      ...prev,
      anime: prev.anime.filter(a => a.id !== animeId),
    }));

    try {
      const data = await retryWithDelay(async () => {
        const response = await fetch(`http://localhost:3001/api/anime/${animeId}`, {
          method: 'DELETE',
        });
        return await handleApiResponse(response);
      }, 2); // Retry up to 2 times for delete operations

      if (data.success) {
        // Update with server response to ensure correct priorities
        setState(prev => ({
          ...prev,
          anime: data.data.remainingAnime,
        }));
        success(`Removed "${animeToRemove.titleEnglish || animeToRemove.title}" from your watchlist`);
      } else {
        // Revert optimistic update
        setState(prev => ({
          ...prev,
          anime: [...prev.anime, animeToRemove].sort((a, b) => a.priority - b.priority),
        }));
        showError(data.message || 'Failed to remove anime');
      }
    } catch (error) {
      // Revert optimistic update
      setState(prev => ({
        ...prev,
        anime: [...prev.anime, animeToRemove].sort((a, b) => a.priority - b.priority),
      }));
      showError(getErrorMessage(error));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedAnime = state.anime.find(anime => anime.id === active.id);
    setState(prev => ({ ...prev, draggedAnime }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setState(prev => ({ ...prev, draggedAnime: null }));

    if (!over || active.id === over.id) {
      return;
    }

    // Check network status
    if (!isOnline) {
      showError('Cannot reorder anime while offline. Please check your connection.');
      return;
    }

    const oldIndex = state.anime.findIndex(anime => anime.id === active.id);
    const newIndex = state.anime.findIndex(anime => anime.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update the order
    const newAnimeOrder = arrayMove(state.anime, oldIndex, newIndex);
    setState(prev => ({ ...prev, anime: newAnimeOrder, isReordering: true }));

    try {
      // Send new order to server
      const animeIds = newAnimeOrder.map(anime => anime.id);
      const data = await retryWithDelay(async () => {
        const response = await fetch('http://localhost:3001/api/anime/reorder', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ animeIds }),
        });
        return await handleApiResponse(response);
      }, 2); // Retry up to 2 times for reorder operations

      if (data.success) {
        // Update with server response to ensure correct priorities
        setState(prev => ({
          ...prev,
          anime: data.data,
          isReordering: false,
        }));
      } else {
        // Revert to original order
        setState(prev => ({
          ...prev,
          anime: state.anime,
          isReordering: false,
        }));
        showError(data.message || 'Failed to reorder anime');
      }
    } catch (error) {
      // Revert to original order
      setState(prev => ({
        ...prev,
        anime: state.anime,
        isReordering: false,
      }));
      showError(getErrorMessage(error));
    }
  };

  const handleRetry = () => {
    loadAnimeData();
  };

  if (state.isLoading) {
    return (
      <>
        <OfflineIndicator />
        <WatchlistSkeleton />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <>
      <OfflineIndicator />
      <div className="space-y-6">

      {/* Add Anime Form */}
      <AddAnimeForm onAnimeAdded={handleAnimeAdded} onError={handleError} />

      {/* Error State */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Connection Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {state.error}
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Watchlist */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Your Watchlist
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {state.anime.length === 0 
                  ? 'No anime in your watchlist yet'
                  : `${state.anime.length} anime • Drag to reorder by priority`
                }
              </p>
            </div>
            {state.isReordering && (
              <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Updating order...
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {state.anime.length === 0 ? (
            // Empty State
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Your watchlist is empty
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                Add your first anime by pasting a MyAnimeList URL above. We'll automatically fetch all the details for you!
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>Try adding anime like:</p>
                <p className="font-mono mt-1">https://myanimelist.net/anime/16498/Attack_on_Titan</p>
              </div>
            </div>
          ) : (
            // Anime List with Drag and Drop
            <ClientOnlyDragDrop
              items={state.anime.map(a => a.id)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              dragOverlay={
                state.draggedAnime ? (
                  <AnimeCard
                    anime={state.draggedAnime}
                    onRemove={() => {}}
                    isDragging={true}
                    timeline={state.timelines[state.draggedAnime.malId]?.timeline || null}
                    timelineLoading={state.timelines[state.draggedAnime.malId]?.loading || false}
                    timelineError={state.timelines[state.draggedAnime.malId]?.error || null}
                  />
                ) : null
              }
            >
              {state.anime.map((anime) => {
                const timelineState = state.timelines[anime.malId];
                return (
                  <AnimeCard
                    key={anime.id}
                    anime={anime}
                    onRemove={handleRemoveAnime}
                    timeline={timelineState?.timeline || null}
                    timelineLoading={timelineState?.loading || false}
                    timelineError={timelineState?.error || null}
                  />
                );
              })}
            </ClientOnlyDragDrop>
          )}
        </div>
      </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}