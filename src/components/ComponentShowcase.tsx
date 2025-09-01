import React from 'react';
import { MessageSystem, useMessageSystem } from './MessageSystem';
import { ProgressIndicator } from './ProgressIndicator';
import { TimelineBadge } from './TimelineBadge';
import { TimelineBadges } from './TimelineBadges';
import { AnimeCard } from './AnimeCard';
import { Toast } from './Toast';
import { LoadingSkeleton } from './LoadingSkeleton';
import { OfflineIndicator } from './OfflineIndicator';
import type { ProgressState } from '../utils/progress-tracker';
import type { SeriesTimeline, TimelineEntry } from '../types/timeline';

export const ComponentShowcase: React.FC = () => {
  const messageSystem = useMessageSystem();

  // Sample data for components
  const sampleAnime = {
    id: 1,
    malId: 16498,
    title: "Attack on Titan",
    titleEnglish: "Attack on Titan",
    titleJapanese: "進撃の巨人",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/47347.jpg",
    rating: 9.0,
    premiereDate: "2013-04-07",
    numEpisodes: 25,
    seriesInfo: null,
    priority: 1,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z"
  };

  const sampleProgressState: ProgressState = {
    isComplete: false,
    hasError: false,
    overallProgress: 65,
    currentStepIndex: 1,
    estimatedTimeRemaining: 30000,
    steps: [
      {
        id: 'step1',
        name: 'Validation',
        message: 'Validating import data',
        status: 'completed',
        startTime: Date.now() - 10000,
        endTime: Date.now() - 8000
      },
      {
        id: 'step2', 
        name: 'Processing',
        message: 'Processing anime records',
        status: 'in-progress',
        startTime: Date.now() - 5000
      },
      {
        id: 'step3',
        name: 'Finalizing',
        message: 'Finalizing import',
        status: 'pending'
      }
    ]
  };

  const sampleTimelineEntry: TimelineEntry = {
    malId: 16498,
    title: "Attack on Titan",
    titleEnglish: "Attack on Titan",
    titleJapanese: "進撃の巨人",
    animeType: 'tv',
    premiereDate: "2013-04-07",
    numEpisodes: 25,
    episodeDuration: 24,
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/47347.jpg"
  };

  const sampleTimeline: SeriesTimeline = {
    rootMalId: 16498,
    entries: [sampleTimelineEntry],
    totalEntries: 1
  };

  return (
    <div className="space-y-12">  
    {/* Message System */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Message System</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => messageSystem.addMessage('success', 'Operation completed successfully!')}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Add Success Message
            </button>
            <button
              onClick={() => messageSystem.addMessage('error', 'Something went wrong!', { 
                title: 'Error',
                details: 'Stack trace or detailed error information would go here'
              })}
              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Add Error Message
            </button>
            <button
              onClick={() => messageSystem.addMessage('warning', 'Please review your settings')}
              className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Add Warning Message
            </button>
            <button
              onClick={() => messageSystem.addMessage('info', 'New feature available!', {
                actions: [
                  { label: 'Learn More', onClick: () => alert('Learn more clicked!'), variant: 'primary' },
                  { label: 'Dismiss', onClick: () => {}, variant: 'secondary' }
                ]
              })}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Info with Actions
            </button>
            <button
              onClick={() => messageSystem.clearMessages()}
              className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear All
            </button>
          </div>
          <MessageSystem
            messages={messageSystem.messages}
            onRemoveMessage={messageSystem.removeMessage}
            className="max-w-2xl"
          />
        </div>
      </section>

      {/* Progress Indicator */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Progress Indicator</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">In Progress</h3>
            <ProgressIndicator progress={sampleProgressState} />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Completed</h3>
            <ProgressIndicator 
              progress={{
                ...sampleProgressState,
                isComplete: true,
                overallProgress: 100,
                currentStepIndex: 2,
                steps: sampleProgressState.steps.map(step => ({ ...step, status: 'completed' as const }))
              }} 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">With Error</h3>
            <ProgressIndicator 
              progress={{
                ...sampleProgressState,
                hasError: true,
                overallProgress: 45,
                steps: [
                  ...sampleProgressState.steps.slice(0, 1),
                  { ...sampleProgressState.steps[1], status: 'error' as const, message: 'Failed to process data' },
                  ...sampleProgressState.steps.slice(2)
                ]
              }} 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Minimal (No Steps)</h3>
            <ProgressIndicator 
              progress={sampleProgressState} 
              showSteps={false}
              showTimeEstimate={false}
            />
          </div>
        </div>
      </section>    
  {/* Timeline Badge */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Timeline Badge</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Different Types</h3>
            <div className="flex flex-wrap gap-4">
              <TimelineBadge
                entry={{ ...sampleTimelineEntry, animeType: 'tv' }}
                isCurrentAnime={true}
                isConnected={true}
                onHover={() => {}}
              />
              <TimelineBadge
                entry={{ ...sampleTimelineEntry, animeType: 'movie', numEpisodes: 1 }}
                isCurrentAnime={false}
                isConnected={true}
                onHover={() => {}}
              />
              <TimelineBadge
                entry={{ ...sampleTimelineEntry, animeType: 'ova', numEpisodes: 6 }}
                isCurrentAnime={false}
                isConnected={true}
                onHover={() => {}}
              />
              <TimelineBadge
                entry={{ ...sampleTimelineEntry, animeType: 'special', numEpisodes: 2 }}
                isCurrentAnime={false}
                isConnected={false}
                onHover={() => {}}
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Timeline Badges (Connected)</h3>
            <TimelineBadges
              timeline={sampleTimeline}
              currentMalId={16498}
            />
          </div>
        </div>
      </section>

      {/* Anime Card */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Anime Card</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Standard Card</h3>
            <div className="max-w-2xl">
              <AnimeCard
                anime={sampleAnime}
                onRemove={() => alert('Remove clicked!')}
                timeline={sampleTimeline}
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Loading Timeline</h3>
            <div className="max-w-2xl">
              <AnimeCard
                anime={sampleAnime}
                onRemove={() => alert('Remove clicked!')}
                timelineLoading={true}
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Timeline Error</h3>
            <div className="max-w-2xl">
              <AnimeCard
                anime={sampleAnime}
                onRemove={() => alert('Remove clicked!')}
                timelineError="Failed to load timeline"
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">No Image</h3>
            <div className="max-w-2xl">
              <AnimeCard
                anime={{ ...sampleAnime, imageUrl: null }}
                onRemove={() => alert('Remove clicked!')}
              />
            </div>
          </div>
        </div>
      </section>      
{/* Loading Skeleton */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Loading Skeleton</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Different Variants</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Card Skeleton</h4>
                <LoadingSkeleton variant="card" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">List Item Skeleton</h4>
                <LoadingSkeleton variant="list-item" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Text Skeleton</h4>
                <LoadingSkeleton variant="text" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Multiple Items</h3>
            <div className="space-y-2">
              <LoadingSkeleton variant="list-item" />
              <LoadingSkeleton variant="list-item" />
              <LoadingSkeleton variant="list-item" />
            </div>
          </div>
        </div>
      </section>

      {/* Toast */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Toast</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const toastContainer = document.getElementById('toast-container');
                if (toastContainer) {
                  const toast = document.createElement('div');
                  toast.innerHTML = `
                    <div class="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
                      Success toast message!
                    </div>
                  `;
                  toastContainer.appendChild(toast);
                  setTimeout(() => toast.remove(), 3000);
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Show Success Toast
            </button>
            <button
              onClick={() => {
                const toastContainer = document.getElementById('toast-container');
                if (toastContainer) {
                  const toast = document.createElement('div');
                  toast.innerHTML = `
                    <div class="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
                      Error toast message!
                    </div>
                  `;
                  toastContainer.appendChild(toast);
                  setTimeout(() => toast.remove(), 3000);
                }
              }}
              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Show Error Toast
            </button>
          </div>
          <div id="toast-container" className="fixed top-4 right-4 space-y-2 z-50"></div>
        </div>
      </section>

      {/* Offline Indicator */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Offline Indicator</h2>
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            This component automatically detects online/offline status. Try disconnecting your internet to see it in action.
          </p>
          <OfflineIndicator />
        </div>
      </section>      {
/* UI Components (Astro) */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">UI Components (Astro)</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Buttons</h3>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Primary Button
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                Secondary Button
              </button>
              <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Outline Button
              </button>
              <button className="px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                Text Button
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Card Title</h4>
                <p className="text-gray-600 dark:text-gray-400">This is a sample card with some content.</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Another Card</h4>
                <p className="text-gray-600 dark:text-gray-400">Cards can contain various types of content.</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Inputs</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Text Input
                </label>
                <input
                  type="text"
                  placeholder="Enter some text..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Textarea
                </label>
                <textarea
                  placeholder="Enter a longer message..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                ></textarea>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Spinners</h3>
            <div className="flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Component Props Documentation */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Component Props Reference</h2>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">MessageSystem</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">messages: Message[]</code> - Array of messages to display</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">onRemoveMessage: (id: string) =&gt; void</code> - Callback when message is dismissed</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">maxMessages?: number</code> - Maximum messages to show (default: 5)</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">className?: string</code> - Additional CSS classes</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">ProgressIndicator</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">progress: ProgressState</code> - Progress state object</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">showSteps?: boolean</code> - Show individual steps (default: true)</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">showTimeEstimate?: boolean</code> - Show time estimate (default: true)</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">className?: string</code> - Additional CSS classes</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4">AnimeCard</h3>
            <div className="space-y-2 text-sm">
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">anime: Anime</code> - Anime data object</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">onRemove: (id: number) =&gt; void</code> - Remove callback</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">isDragging?: boolean</code> - Dragging state (default: false)</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">timeline?: SeriesTimeline | null</code> - Timeline data</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">timelineLoading?: boolean</code> - Timeline loading state</div>
              <div><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">timelineError?: string | null</code> - Timeline error message</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};