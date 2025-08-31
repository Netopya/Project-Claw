import React from 'react';
import type { ProgressState } from '../utils/progress-tracker.js';
import { formatDuration } from '../utils/progress-tracker.js';

interface ProgressIndicatorProps {
  progress: ProgressState;
  showSteps?: boolean;
  showTimeEstimate?: boolean;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  showSteps = true,
  showTimeEstimate = true,
  className = ''
}) => {
  const currentStep = progress.steps[progress.currentStepIndex];
  const completedSteps = progress.steps.filter(step => step.status === 'completed').length;
  const totalSteps = progress.steps.length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {progress.isComplete 
              ? progress.hasError 
                ? 'Operation failed' 
                : 'Operation completed'
              : currentStep?.message || 'Processing...'
            }
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {progress.overallProgress}%
          </span>
        </div>
        
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              progress.hasError 
                ? 'bg-red-500' 
                : progress.isComplete 
                  ? 'bg-green-500' 
                  : 'bg-blue-500'
            }`}
            style={{ width: `${progress.overallProgress}%` }}
          >
            {/* Animated progress bar for active state */}
            {!progress.isComplete && !progress.hasError && (
              <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Time Estimate */}
      {showTimeEstimate && progress.estimatedTimeRemaining && !progress.isComplete && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Estimated time remaining: {formatDuration(progress.estimatedTimeRemaining)}
        </div>
      )}

      {/* Step Progress */}
      {showSteps && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
            <span>Steps</span>
            <span>{completedSteps} of {totalSteps} completed</span>
          </div>
          
          <div className="space-y-1">
            {progress.steps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-2 text-sm">
                {/* Step Status Icon */}
                <div className="flex-shrink-0">
                  {step.status === 'completed' && (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.status === 'error' && (
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.status === 'in-progress' && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                  )}
                </div>

                {/* Step Name and Message */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${
                    step.status === 'completed' 
                      ? 'text-green-700 dark:text-green-300'
                      : step.status === 'error'
                        ? 'text-red-700 dark:text-red-300'
                        : step.status === 'in-progress'
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.name}
                  </div>
                  {step.message && step.message !== step.name && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {step.message}
                    </div>
                  )}
                </div>

                {/* Step Duration */}
                {step.startTime && step.endTime && (
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDuration(step.endTime - step.startTime)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary */}
      {progress.hasError && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="text-sm">
              <h4 className="font-medium text-red-800 dark:text-red-200">
                Operation Failed
              </h4>
              <div className="mt-1 text-red-700 dark:text-red-300">
                {progress.steps
                  .filter(step => step.status === 'error')
                  .map(step => step.message)
                  .join(', ')
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary */}
      {progress.isComplete && !progress.hasError && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="text-sm">
              <h4 className="font-medium text-green-800 dark:text-green-200">
                Operation Completed Successfully
              </h4>
              <div className="mt-1 text-green-700 dark:text-green-300">
                All steps completed without errors
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};