import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressIndicator } from './ProgressIndicator';
import type { ProgressState } from '../utils/progress-tracker';

const createMockProgressState = (overrides: Partial<ProgressState> = {}): ProgressState => ({
  steps: [
    { id: 'step1', name: 'Step 1', weight: 30, status: 'completed', message: 'Step 1 completed', startTime: 1000, endTime: 2000 },
    { id: 'step2', name: 'Step 2', weight: 50, status: 'in-progress', message: 'Processing step 2...', startTime: 2000 },
    { id: 'step3', name: 'Step 3', weight: 20, status: 'pending' }
  ],
  currentStepIndex: 1,
  overallProgress: 55,
  isComplete: false,
  hasError: false,
  estimatedTimeRemaining: 5000,
  ...overrides
});

describe('ProgressIndicator', () => {
  it('renders overall progress correctly', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getAllByText('Processing step 2...')).toHaveLength(2); // Appears in main status and step detail
  });

  it('shows time estimate when enabled', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} showTimeEstimate={true} />);
    
    expect(screen.getByText(/Estimated time remaining: 5s/)).toBeInTheDocument();
  });

  it('hides time estimate when disabled', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} showTimeEstimate={false} />);
    
    expect(screen.queryByText(/Estimated time remaining/)).not.toBeInTheDocument();
  });

  it('shows step progress when enabled', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} showSteps={true} />);
    
    expect(screen.getByText('Steps')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 completed')).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('hides step progress when disabled', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} showSteps={false} />);
    
    expect(screen.queryByText('Steps')).not.toBeInTheDocument();
    expect(screen.queryByText('Step 1')).not.toBeInTheDocument();
  });

  it('displays completed step with correct styling', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    const step1 = screen.getByText('Step 1');
    expect(step1).toHaveClass('text-green-700');
    
    // Check for completed icon (checkmark)
    const completedIcon = document.querySelector('.text-green-500');
    expect(completedIcon).toBeInTheDocument();
  });

  it('displays in-progress step with spinner', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    const step2 = screen.getByText('Step 2');
    expect(step2).toHaveClass('text-blue-700');
    
    // Check for spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays pending step with correct styling', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    const step3 = screen.getByText('Step 3').closest('div');
    expect(step3).toHaveClass('text-gray-500');
  });

  it('shows error state correctly', () => {
    const progress = createMockProgressState({
      steps: [
        { id: 'step1', name: 'Step 1', weight: 50, status: 'error', message: 'Step 1 failed' },
        { id: 'step2', name: 'Step 2', weight: 50, status: 'pending' }
      ],
      hasError: true,
      overallProgress: 0,
      isComplete: true
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    expect(screen.getByText('Operation failed')).toBeInTheDocument();
    expect(screen.getByText('Operation Failed')).toBeInTheDocument();
    expect(screen.getByText('Step 1 failed')).toBeInTheDocument();
    
    // Check for error styling
    const progressBar = document.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('shows completion state correctly', () => {
    const progress = createMockProgressState({
      steps: [
        { id: 'step1', name: 'Step 1', weight: 50, status: 'completed' },
        { id: 'step2', name: 'Step 2', weight: 50, status: 'completed' }
      ],
      isComplete: true,
      hasError: false,
      overallProgress: 100,
      estimatedTimeRemaining: undefined
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
    expect(screen.getByText('Operation Completed Successfully')).toBeInTheDocument();
    expect(screen.getByText('All steps completed without errors')).toBeInTheDocument();
    
    // Check for success styling
    const progressBar = document.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('displays step duration when available', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    // Step 1 has startTime: 1000, endTime: 2000 (1 second duration)
    expect(screen.getByText('1s')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} className="custom-class" />);
    
    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('handles empty steps array', () => {
    const progress = createMockProgressState({
      steps: [],
      currentStepIndex: 0,
      overallProgress: 0
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    expect(screen.getByText('0 of 0 completed')).toBeInTheDocument();
  });

  it('shows step message when different from step name', () => {
    const progress = createMockProgressState({
      steps: [
        { id: 'step1', name: 'Validation', weight: 100, status: 'in-progress', message: 'Validating file format and structure...' }
      ]
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(screen.getByText('Validating file format and structure...')).toBeInTheDocument();
  });

  it('does not show duplicate message when same as step name', () => {
    const progress = createMockProgressState({
      steps: [
        { id: 'step1', name: 'Validation', weight: 100, status: 'in-progress', message: 'Validation' }
      ]
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    const validationTexts = screen.getAllByText('Validation');
    expect(validationTexts).toHaveLength(1); // Should only appear once
  });

  it('handles progress bar animation classes', () => {
    const progress = createMockProgressState();
    render(<ProgressIndicator progress={progress} />);
    
    // Check for animated progress bar
    const animatedBar = document.querySelector('.animate-pulse');
    expect(animatedBar).toBeInTheDocument();
  });

  it('does not show animation when complete', () => {
    const progress = createMockProgressState({
      isComplete: true,
      hasError: false
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    // Should not have animated bar when complete
    const animatedBar = document.querySelector('.animate-pulse');
    expect(animatedBar).not.toBeInTheDocument();
  });

  it('does not show animation when error', () => {
    const progress = createMockProgressState({
      hasError: true
    });
    
    render(<ProgressIndicator progress={progress} />);
    
    // Should not have animated bar when error
    const animatedBar = document.querySelector('.animate-pulse');
    expect(animatedBar).not.toBeInTheDocument();
  });
});