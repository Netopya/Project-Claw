import React, { useState, useEffect } from 'react';
import * as DndKit from '@dnd-kit/core';
const {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
} = DndKit;
import * as DndKitSortable from '@dnd-kit/sortable';
const {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} = DndKitSortable;

// Type definitions for drag events (using imported DragEndEvent from @dnd-kit/core)

interface DragStartEvent {
  active: { id: string | number };
}

import { AddAnimeForm } from './AddAnimeForm';
import { AnimeCard } from './AnimeCard';

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

interface AppState {
  anime: Anime[];
  isLoading: boolean;
  error: string | null;
  isReordering: boolean;
  draggedAnime: Anime | null;
}

export function WatchlistApp({ initialAnime = [], apiError = null }: WatchlistAppProps) {
  const [state, setState] = useState<AppState>({
    anime: initialAnime,
    isLoading: false,
    error: apiError,
    isReordering: false,
    draggedAnime: null,
  });

  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error';
    message: string;
  }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load anime data on mount if not provided initially
  useEffect(() => {
    if (initialAnime.length === 0 && !apiError) {
      loadAnimeData();
    }
  }, []);

  const loadAnimeData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('http://localhost:3001/api/anime');
      const data = await response.json();

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
        error: 'Failed to connect to the server',
        isLoading: false,
      }));
    }
  };

  const addNotification = (type: 'success' | 'error', message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, type, message }]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleAnimeAdded = (newAnime: Anime) => {
    setState(prev => ({
      ...prev,
      anime: [...prev.anime, newAnime].sort((a, b) => a.priority - b.priority),
    }));
    addNotification('success', `Added "${newAnime.titleEnglish || newAnime.title}" to your watchlist!`);
  };

  const handleError = (error: string) => {
    addNotification('error', error);
  };

  const handleRemoveAnime = async (animeId: number) => {
    const animeToRemove = state.anime.find(a => a.id === animeId);
    if (!animeToRemove) return;

    // Optimistically remove from UI
    setState(prev => ({
      ...prev,
      anime: prev.anime.filter(a => a.id !== animeId),
    }));

    try {
      const response = await fetch(`http://localhost:3001/api/anime/${animeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Update with server response to ensure correct priorities
        setState(prev => ({
          ...prev,
          anime: data.data.remainingAnime,
        }));
        addNotification('success', `Removed "${animeToRemove.titleEnglish || animeToRemove.title}" from your watchlist`);
      } else {
        // Revert optimistic update
        setState(prev => ({
          ...prev,
          anime: [...prev.anime, animeToRemove].sort((a, b) => a.priority - b.priority),
        }));
        addNotification('error', data.message || 'Failed to remove anime');
      }
    } catch (error) {
      // Revert optimistic update
      setState(prev => ({
        ...prev,
        anime: [...prev.anime, animeToRemove].sort((a, b) => a.priority - b.priority),
      }));
      addNotification('error', 'Failed to remove anime. Please try again.');
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
      const response = await fetch('http://localhost:3001/api/anime/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ animeIds }),
      });

      const data = await response.json();

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
        addNotification('error', data.message || 'Failed to reorder anime');
      }
    } catch (error) {
      // Revert to original order
      setState(prev => ({
        ...prev,
        anime: state.anime,
        isReordering: false,
      }));
      addNotification('error', 'Failed to reorder anime. Please try again.');
    }
  };

  const handleRetry = () => {
    loadAnimeData();
  };

  if (state.isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex">
                <div className="w-24 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="flex-1 ml-4 space-y-2">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`
                max-w-sm p-4 rounded-lg shadow-lg border flex items-center justify-between
                ${notification.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }
              `}
            >
              <div className="flex items-center">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="ml-2 text-current opacity-70 hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}

            >
              <SortableContext items={state.anime.map(a => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {state.anime.map((anime) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      onRemove={handleRemoveAnime}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {state.draggedAnime ? (
                  <AnimeCard
                    anime={state.draggedAnime}
                    onRemove={() => {}}
                    isDragging={true}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}