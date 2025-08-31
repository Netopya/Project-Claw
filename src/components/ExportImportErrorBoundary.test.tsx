import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportImportErrorBoundary } from './ExportImportErrorBoundary';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({ 
  shouldThrow = true, 
  errorMessage = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

describe('ExportImportErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should catch and display network errors with appropriate suggestions', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Network connection failed" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
    expect(screen.getByText(/Check your internet connection/)).toBeInTheDocument();
    expect(screen.getByText(/Try refreshing the page/)).toBeInTheDocument();
  });

  it('should catch and display validation errors with appropriate suggestions', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Invalid data format detected" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Data Validation Error')).toBeInTheDocument();
    expect(screen.getByText(/The data format is invalid or corrupted/)).toBeInTheDocument();
    expect(screen.getByText(/Ensure you're using a valid export file/)).toBeInTheDocument();
  });

  it('should catch and display permission errors with appropriate suggestions', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Permission denied for this operation" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Permission Error')).toBeInTheDocument();
    expect(screen.getByText(/You don't have permission to perform this operation/)).toBeInTheDocument();
    expect(screen.getByText(/Refresh the page to restore your session/)).toBeInTheDocument();
  });

  it('should catch and display storage errors with appropriate suggestions', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Insufficient storage space available" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Storage Error')).toBeInTheDocument();
    expect(screen.getByText(/There's not enough storage space/)).toBeInTheDocument();
    expect(screen.getByText(/Free up some disk space/)).toBeInTheDocument();
  });

  it('should catch and display unknown errors with generic suggestions', () => {
    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Something unexpected happened" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Unexpected Error')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    expect(screen.getByText(/Try the operation again/)).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();
    
    render(
      <ExportImportErrorBoundary onError={onError}>
        <ThrowError errorMessage="Test callback error" />
      </ExportImportErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test callback error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should allow retry functionality', () => {
    let shouldThrow = true;
    
    const DynamicThrowError = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>No error</div>;
    };

    const { rerender } = render(
      <ExportImportErrorBoundary>
        <DynamicThrowError />
      </ExportImportErrorBoundary>
    );

    // Error should be displayed
    expect(screen.getByText('Unexpected Error')).toBeInTheDocument();

    // Change the error condition
    shouldThrow = false;

    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));

    // Should show the component without error
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should allow page refresh functionality', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(
      <ExportImportErrorBoundary>
        <ThrowError />
      </ExportImportErrorBoundary>
    );

    fireEvent.click(screen.getByText('Refresh Page'));
    expect(mockReload).toHaveBeenCalled();
  });

  it('should use custom fallback when provided', () => {
    const customFallback = (error: Error, retry: () => void) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={retry}>Custom Retry</button>
      </div>
    );

    render(
      <ExportImportErrorBoundary fallback={customFallback}>
        <ThrowError errorMessage="Custom fallback test" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Custom error: Custom fallback test')).toBeInTheDocument();
    expect(screen.getByText('Custom Retry')).toBeInTheDocument();
  });

  it('should show technical details in development mode', () => {
    // Mock development environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Development error with stack trace" />
      </ExportImportErrorBoundary>
    );

    expect(screen.getByText('Technical Details (Development)')).toBeInTheDocument();
    
    // Click to expand details
    fireEvent.click(screen.getByText('Technical Details (Development)'));
    
    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('Development error with stack trace')).toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should not show technical details in production mode', () => {
    // Mock production environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ExportImportErrorBoundary>
        <ThrowError errorMessage="Production error" />
      </ExportImportErrorBoundary>
    );

    expect(screen.queryByText('Technical Details (Development)')).not.toBeInTheDocument();

    // Restore environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle errors without error info', () => {
    // Create a boundary that doesn't provide errorInfo
    class TestBoundary extends React.Component<
      { children: React.ReactNode },
      { hasError: boolean; error?: Error }
    > {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      render() {
        if (this.state.hasError && this.state.error) {
          return (
            <ExportImportErrorBoundary>
              <div>Wrapped error boundary test</div>
            </ExportImportErrorBoundary>
          );
        }
        return this.props.children;
      }
    }

    render(
      <TestBoundary>
        <ThrowError />
      </TestBoundary>
    );

    // Should still render the error boundary content
    expect(screen.getByText('Wrapped error boundary test')).toBeInTheDocument();
  });
});