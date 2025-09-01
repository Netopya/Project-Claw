import React, { useState, useEffect } from 'react';

interface IndeterminateProgressProps {
  isActive: boolean;
  title?: string;
  className?: string;
}

interface ProgressPhase {
  id: string;
  label: string;
  description: string;
  estimatedDuration: number; // in milliseconds
  icon: React.ReactNode;
}

const PROGRESS_PHASES: ProgressPhase[] = [
  {
    id: 'fetching',
    label: 'Fetching anime data',
    description: 'Getting anime information from MyAnimeList',
    estimatedDuration: 2000,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    )
  },
  {
    id: 'relationships',
    label: 'Discovering relationships',
    description: 'Finding related anime (sequels, prequels, etc.)',
    estimatedDuration: 4000,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    )
  },
  {
    id: 'processing',
    label: 'Processing related anime',
    description: 'This may take a moment for anime with many relationships',
    estimatedDuration: 6000,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  },
  {
    id: 'finalizing',
    label: 'Adding to watchlist',
    description: 'Saving anime and relationships to your watchlist',
    estimatedDuration: 1000,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
];

export const IndeterminateProgress: React.FC<IndeterminateProgressProps> = ({
  isActive,
  title = "Adding anime to watchlist",
  className = ""
}) => {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setCurrentPhaseIndex(0);
      setElapsedTime(0);
      setStartTime(null);
      return;
    }

    setStartTime(Date.now());
    
    // Progress through phases based on estimated durations
    const intervals: NodeJS.Timeout[] = [];
    let cumulativeTime = 0;

    PROGRESS_PHASES.forEach((phase, index) => {
      cumulativeTime += phase.estimatedDuration;
      
      const timeout = setTimeout(() => {
        if (index < PROGRESS_PHASES.length - 1) {
          setCurrentPhaseIndex(index + 1);
        }
      }, cumulativeTime);
      
      intervals.push(timeout);
    });

    // Update elapsed time every 100ms
    const elapsedInterval = setInterval(() => {
      if (startTime) {
        setElapsedTime(Date.now() - startTime);
      }
    }, 100);

    return () => {
      intervals.forEach(clearTimeout);
      clearInterval(elapsedInterval);
    };
  }, [isActive, startTime]);

  if (!isActive) {
    return null;
  }

  const currentPhase = PROGRESS_PHASES[currentPhaseIndex];
  const totalEstimatedTime = PROGRESS_PHASES.reduce((sum, phase) => sum + phase.estimatedDuration, 0);
  const progressPercentage = Math.min((elapsedTime / totalEstimatedTime) * 100, 95); // Cap at 95% for indeterminate feel

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center mb-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {title}
        </h3>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="bg-blue-100 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out relative"
            style={{ width: `${progressPercentage}%` }}
          >
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Current Phase */}
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
          {currentPhase.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {currentPhase.label}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            {currentPhase.description}
          </p>
        </div>
      </div>

      {/* Phase Indicators */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
        {PROGRESS_PHASES.map((phase, index) => (
          <div
            key={phase.id}
            className={`flex items-center space-x-1 text-xs ${
              index <= currentPhaseIndex
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-blue-400 dark:text-blue-600'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                index < currentPhaseIndex
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : index === currentPhaseIndex
                    ? 'bg-blue-600 dark:bg-blue-400 animate-pulse'
                    : 'bg-blue-300 dark:bg-blue-600'
              }`}
            />
            <span className="hidden sm:inline">{phase.label}</span>
          </div>
        ))}
      </div>

      {/* Time Indicator */}
      <div className="text-center mt-3">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {elapsedTime > 10000 
            ? "This is taking longer than usual - complex anime relationships detected"
            : `${Math.floor(elapsedTime / 1000)}s elapsed`
          }
        </p>
      </div>
    </div>
  );
};