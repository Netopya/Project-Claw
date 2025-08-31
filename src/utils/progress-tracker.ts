/**
 * Progress tracking utility for export/import operations
 */

export interface ProgressStep {
  id: string;
  name: string;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message?: string;
  startTime?: number;
  endTime?: number;
}

export interface ProgressState {
  steps: ProgressStep[];
  currentStepIndex: number;
  overallProgress: number;
  isComplete: boolean;
  hasError: boolean;
  estimatedTimeRemaining?: number;
}

export class ProgressTracker {
  private steps: ProgressStep[] = [];
  private currentStepIndex = 0;
  private startTime?: number;
  private onUpdate?: (state: ProgressState) => void;

  constructor(steps: Omit<ProgressStep, 'status'>[], onUpdate?: (state: ProgressState) => void) {
    this.steps = steps.map(step => ({ ...step, status: 'pending' as const }));
    this.onUpdate = onUpdate;
  }

  /**
   * Start the progress tracking
   */
  start(): void {
    this.startTime = Date.now();
    this.notifyUpdate();
  }

  /**
   * Start the next step
   */
  startStep(stepId: string, message?: string): void {
    const stepIndex = this.steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found`);
    }

    // Mark previous steps as completed if not already
    for (let i = 0; i < stepIndex; i++) {
      if (this.steps[i].status === 'pending' || this.steps[i].status === 'in-progress') {
        this.steps[i].status = 'completed';
        this.steps[i].endTime = Date.now();
      }
    }

    // Start current step
    this.steps[stepIndex].status = 'in-progress';
    this.steps[stepIndex].startTime = Date.now();
    this.steps[stepIndex].message = message;
    this.currentStepIndex = stepIndex;

    this.notifyUpdate();
  }

  /**
   * Update the current step's message
   */
  updateStep(stepId: string, message: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.message = message;
      this.notifyUpdate();
    }
  }

  /**
   * Complete a step
   */
  completeStep(stepId: string, message?: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.endTime = Date.now();
      if (message) {
        step.message = message;
      }
      this.notifyUpdate();
    }
  }

  /**
   * Mark a step as error
   */
  errorStep(stepId: string, message: string): void {
    const step = this.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'error';
      step.endTime = Date.now();
      step.message = message;
      this.notifyUpdate();
    }
  }

  /**
   * Complete all remaining steps
   */
  complete(): void {
    this.steps.forEach(step => {
      if (step.status !== 'completed' && step.status !== 'error') {
        step.status = 'completed';
        step.endTime = Date.now();
      }
    });
    this.notifyUpdate();
  }

  /**
   * Get current progress state
   */
  getState(): ProgressState {
    const totalWeight = this.steps.reduce((sum, step) => sum + step.weight, 0);
    let completedWeight = 0;
    let hasError = false;

    this.steps.forEach(step => {
      if (step.status === 'completed') {
        completedWeight += step.weight;
      } else if (step.status === 'in-progress') {
        completedWeight += step.weight * 0.5; // Half credit for in-progress
      } else if (step.status === 'error') {
        hasError = true;
      }
    });

    const overallProgress = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
    const isComplete = this.steps.every(step => 
      step.status === 'completed' || step.status === 'error'
    );

    // Estimate time remaining based on completed steps
    let estimatedTimeRemaining: number | undefined;
    if (this.startTime && !isComplete && overallProgress > 0) {
      const elapsedTime = Date.now() - this.startTime;
      const estimatedTotalTime = (elapsedTime / overallProgress) * 100;
      estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
    }

    return {
      steps: [...this.steps],
      currentStepIndex: this.currentStepIndex,
      overallProgress: Math.round(overallProgress),
      isComplete,
      hasError,
      estimatedTimeRemaining
    };
  }

  /**
   * Reset the progress tracker
   */
  reset(): void {
    this.steps.forEach(step => {
      step.status = 'pending';
      step.message = undefined;
      step.startTime = undefined;
      step.endTime = undefined;
    });
    this.currentStepIndex = 0;
    this.startTime = undefined;
    this.notifyUpdate();
  }

  private notifyUpdate(): void {
    if (this.onUpdate) {
      this.onUpdate(this.getState());
    }
  }
}

/**
 * Format time duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Export operation steps configuration
 */
export const EXPORT_STEPS: Omit<ProgressStep, 'status'>[] = [
  { id: 'validate', name: 'Validating data integrity', weight: 20 },
  { id: 'extract', name: 'Extracting database records', weight: 40 },
  { id: 'generate', name: 'Generating export file', weight: 30 },
  { id: 'download', name: 'Preparing download', weight: 10 }
];

/**
 * Import operation steps configuration
 */
export const IMPORT_STEPS: Omit<ProgressStep, 'status'>[] = [
  { id: 'validate', name: 'Validating import file', weight: 15 },
  { id: 'parse', name: 'Parsing file content', weight: 10 },
  { id: 'migrate', name: 'Migrating schema if needed', weight: 15 },
  { id: 'process', name: 'Processing import data', weight: 50 },
  { id: 'finalize', name: 'Finalizing import', weight: 10 }
];