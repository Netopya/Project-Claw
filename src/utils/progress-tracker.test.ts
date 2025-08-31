import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressTracker, formatDuration, EXPORT_STEPS, IMPORT_STEPS } from './progress-tracker';

describe('ProgressTracker', () => {
  const mockSteps = [
    { id: 'step1', name: 'Step 1', weight: 30 },
    { id: 'step2', name: 'Step 2', weight: 50 },
    { id: 'step3', name: 'Step 3', weight: 20 }
  ];

  let onUpdateMock: ReturnType<typeof vi.fn>;
  let progressTracker: ProgressTracker;

  beforeEach(() => {
    onUpdateMock = vi.fn();
    progressTracker = new ProgressTracker(mockSteps, onUpdateMock);
  });

  describe('initialization', () => {
    it('initializes with pending steps', () => {
      const state = progressTracker.getState();
      
      expect(state.steps).toHaveLength(3);
      expect(state.steps.every(step => step.status === 'pending')).toBe(true);
      expect(state.overallProgress).toBe(0);
      expect(state.isComplete).toBe(false);
      expect(state.hasError).toBe(false);
    });

    it('calls onUpdate callback when provided', () => {
      progressTracker.start();
      expect(onUpdateMock).toHaveBeenCalled();
    });
  });

  describe('step management', () => {
    it('starts a step correctly', () => {
      progressTracker.start();
      progressTracker.startStep('step1', 'Starting step 1');
      
      const state = progressTracker.getState();
      const step1 = state.steps.find(s => s.id === 'step1');
      
      expect(step1?.status).toBe('in-progress');
      expect(step1?.message).toBe('Starting step 1');
      expect(step1?.startTime).toBeDefined();
      expect(state.currentStepIndex).toBe(0);
    });

    it('completes a step correctly', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1', 'Step 1 completed');
      
      const state = progressTracker.getState();
      const step1 = state.steps.find(s => s.id === 'step1');
      
      expect(step1?.status).toBe('completed');
      expect(step1?.message).toBe('Step 1 completed');
      expect(step1?.endTime).toBeDefined();
    });

    it('marks step as error correctly', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.errorStep('step1', 'Step 1 failed');
      
      const state = progressTracker.getState();
      const step1 = state.steps.find(s => s.id === 'step1');
      
      expect(step1?.status).toBe('error');
      expect(step1?.message).toBe('Step 1 failed');
      expect(step1?.endTime).toBeDefined();
      expect(state.hasError).toBe(true);
    });

    it('updates step message', () => {
      progressTracker.start();
      progressTracker.startStep('step1', 'Initial message');
      progressTracker.updateStep('step1', 'Updated message');
      
      const state = progressTracker.getState();
      const step1 = state.steps.find(s => s.id === 'step1');
      
      expect(step1?.message).toBe('Updated message');
    });

    it('throws error for non-existent step', () => {
      expect(() => {
        progressTracker.startStep('nonexistent');
      }).toThrow('Step nonexistent not found');
    });
  });

  describe('progress calculation', () => {
    it('calculates progress correctly for completed steps', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      
      const state = progressTracker.getState();
      expect(state.overallProgress).toBe(30); // step1 weight is 30
    });

    it('calculates progress correctly for in-progress steps', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      
      const state = progressTracker.getState();
      expect(state.overallProgress).toBe(15); // step1 weight (30) * 0.5
    });

    it('calculates progress correctly for mixed step states', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      progressTracker.startStep('step2');
      
      const state = progressTracker.getState();
      expect(state.overallProgress).toBe(55); // 30 (completed) + 25 (50 * 0.5 in-progress)
    });

    it('marks as complete when all steps are done', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      progressTracker.startStep('step2');
      progressTracker.completeStep('step2');
      progressTracker.startStep('step3');
      progressTracker.completeStep('step3');
      
      const state = progressTracker.getState();
      expect(state.isComplete).toBe(true);
      expect(state.overallProgress).toBe(100);
    });
  });

  describe('time estimation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('estimates time remaining based on progress', () => {
      progressTracker.start();
      
      // Advance time by 1 second
      vi.advanceTimersByTime(1000);
      
      // Complete first step (30% of work)
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      
      const state = progressTracker.getState();
      
      // Should estimate ~2.33 seconds remaining (1s for 30% = ~3.33s total - 1s elapsed)
      expect(state.estimatedTimeRemaining).toBeGreaterThan(2000);
      expect(state.estimatedTimeRemaining).toBeLessThan(3000);
    });

    it('does not estimate time when no progress made', () => {
      progressTracker.start();
      
      const state = progressTracker.getState();
      expect(state.estimatedTimeRemaining).toBeUndefined();
    });

    it('does not estimate time when complete', () => {
      progressTracker.start();
      progressTracker.complete();
      
      const state = progressTracker.getState();
      expect(state.estimatedTimeRemaining).toBeUndefined();
    });
  });

  describe('reset functionality', () => {
    it('resets all steps to pending', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      progressTracker.errorStep('step2', 'Error');
      
      progressTracker.reset();
      
      const state = progressTracker.getState();
      expect(state.steps.every(step => step.status === 'pending')).toBe(true);
      expect(state.steps.every(step => !step.message)).toBe(true);
      expect(state.steps.every(step => !step.startTime)).toBe(true);
      expect(state.steps.every(step => !step.endTime)).toBe(true);
      expect(state.overallProgress).toBe(0);
      expect(state.isComplete).toBe(false);
      expect(state.hasError).toBe(false);
    });
  });

  describe('complete functionality', () => {
    it('completes all remaining steps', () => {
      progressTracker.start();
      progressTracker.startStep('step1');
      progressTracker.completeStep('step1');
      
      progressTracker.complete();
      
      const state = progressTracker.getState();
      expect(state.steps.every(step => 
        step.status === 'completed' || step.status === 'error'
      )).toBe(true);
      expect(state.isComplete).toBe(true);
    });
  });
});

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(30000)).toBe('30s');
  });

  it('formats minutes and seconds correctly', () => {
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('formats hours, minutes correctly', () => {
    expect(formatDuration(3665000)).toBe('1h 1m');
    expect(formatDuration(7325000)).toBe('2h 2m');
  });

  it('handles zero duration', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('predefined step configurations', () => {
  it('has valid export steps', () => {
    expect(EXPORT_STEPS).toHaveLength(4);
    expect(EXPORT_STEPS.every(step => step.id && step.name && step.weight > 0)).toBe(true);
    
    const totalWeight = EXPORT_STEPS.reduce((sum, step) => sum + step.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it('has valid import steps', () => {
    expect(IMPORT_STEPS).toHaveLength(5);
    expect(IMPORT_STEPS.every(step => step.id && step.name && step.weight > 0)).toBe(true);
    
    const totalWeight = IMPORT_STEPS.reduce((sum, step) => sum + step.weight, 0);
    expect(totalWeight).toBe(100);
  });
});