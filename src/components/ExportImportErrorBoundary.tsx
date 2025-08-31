import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Enhanced error boundary specifically for export/import operations
 * Provides better error recovery and user-friendly error messages
 */
export class ExportImportErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ExportImportErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  getErrorType = (error: Error): 'network' | 'validation' | 'permission' | 'storage' | 'unknown' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('format')) {
      return 'validation';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('storage') || message.includes('quota') || message.includes('disk')) {
      return 'storage';
    }
    return 'unknown';
  };

  getErrorMessage = (error: Error): { title: string; message: string; suggestions: string[] } => {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case 'network':
        return {
          title: 'Connection Error',
          message: 'Unable to connect to the server. This might be a temporary network issue.',
          suggestions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Wait a moment and try again'
          ]
        };
      
      case 'validation':
        return {
          title: 'Data Validation Error',
          message: 'The data format is invalid or corrupted.',
          suggestions: [
            'Ensure you\'re using a valid export file',
            'Check that the file hasn\'t been modified',
            'Try exporting the data again if this is an import operation'
          ]
        };
      
      case 'permission':
        return {
          title: 'Permission Error',
          message: 'You don\'t have permission to perform this operation.',
          suggestions: [
            'Refresh the page to restore your session',
            'Contact support if the problem persists'
          ]
        };
      
      case 'storage':
        return {
          title: 'Storage Error',
          message: 'There\'s not enough storage space or a storage-related issue occurred.',
          suggestions: [
            'Free up some disk space',
            'Try with a smaller dataset',
            'Contact support if the problem persists'
          ]
        };
      
      default:
        return {
          title: 'Unexpected Error',
          message: 'An unexpected error occurred during the export/import operation.',
          suggestions: [
            'Try the operation again',
            'Refresh the page if the problem persists',
            'Contact support with the error details below'
          ]
        };
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      const { title, message, suggestions } = this.getErrorMessage(this.state.error);

      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-800 p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                {title}
              </h3>
              
              <p className="text-red-700 dark:text-red-300 mb-4">
                {message}
              </p>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  What you can try:
                </h4>
                <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Page
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium">
                    Technical Details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono text-red-800 dark:text-red-200 overflow-auto max-h-40">
                    <div className="font-semibold mb-1">Error:</div>
                    <div className="mb-2">{this.state.error.message}</div>
                    {this.state.error.stack && (
                      <>
                        <div className="font-semibold mb-1">Stack Trace:</div>
                        <pre className="whitespace-pre-wrap text-xs">{this.state.error.stack}</pre>
                      </>
                    )}
                    {this.state.errorInfo && (
                      <>
                        <div className="font-semibold mb-1 mt-2">Component Stack:</div>
                        <pre className="whitespace-pre-wrap text-xs">{this.state.errorInfo.componentStack}</pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}