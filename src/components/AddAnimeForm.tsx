import React, { useState } from 'react';

interface AddAnimeFormProps {
  onAnimeAdded: (anime: any) => void;
  onError: (error: string) => void;
}

interface FormState {
  url: string;
  isSubmitting: boolean;
  isValidating: boolean;
  validationError: string | null;
  submitError: string | null;
}

export function AddAnimeForm({ onAnimeAdded, onError }: AddAnimeFormProps) {
  const [state, setState] = useState<FormState>({
    url: '',
    isSubmitting: false,
    isValidating: false,
    validationError: null,
    submitError: null,
  });

  // MyAnimeList URL validation regex
  const MAL_URL_REGEX = /^https?:\/\/(www\.)?myanimelist\.net\/anime\/(\d+)(\/.*)?$/i;

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) {
      return 'Please enter a MyAnimeList URL';
    }

    if (!MAL_URL_REGEX.test(url.trim())) {
      return 'Please enter a valid MyAnimeList anime URL (e.g., https://myanimelist.net/anime/12345/anime-title)';
    }

    return null;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setState(prev => ({
      ...prev,
      url: newUrl,
      validationError: null,
      submitError: null,
    }));
  };

  const handleValidateUrl = async () => {
    const url = state.url.trim();
    const validationError = validateUrl(url);

    if (validationError) {
      setState(prev => ({ ...prev, validationError }));
      return;
    }

    setState(prev => ({ ...prev, isValidating: true, validationError: null }));

    try {
      const response = await fetch('http://localhost:3001/api/anime/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success && data.data.isValid) {
        setState(prev => ({
          ...prev,
          isValidating: false,
          validationError: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isValidating: false,
          validationError: data.data?.error || data.message || 'Invalid URL',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationError: 'Failed to validate URL. Please check your connection.',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = state.url.trim();
    const validationError = validateUrl(url);

    if (validationError) {
      setState(prev => ({ ...prev, validationError }));
      return;
    }

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      submitError: null,
      validationError: null,
    }));

    try {
      const response = await fetch('http://localhost:3001/api/anime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        // Success - clear form and notify parent
        setState({
          url: '',
          isSubmitting: false,
          isValidating: false,
          validationError: null,
          submitError: null,
        });
        onAnimeAdded(data.data);
      } else {
        // API returned error
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          submitError: data.message || 'Failed to add anime',
        }));
        onError(data.message || 'Failed to add anime');
      }
    } catch (error) {
      // Network or other error
      const errorMessage = 'Failed to add anime. Please check your connection and try again.';
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        submitError: errorMessage,
      }));
      onError(errorMessage);
    }
  };

  const hasValidFormat = state.url.trim() && MAL_URL_REGEX.test(state.url.trim());
  const isFormValid = hasValidFormat && !state.validationError;
  const showValidateButton = hasValidFormat && !state.isValidating;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <div className="ml-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Anime to Watchlist
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Paste a MyAnimeList URL to automatically add anime with all details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="anime-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            MyAnimeList URL
          </label>
          <div className="relative">
            <input
              id="anime-url"
              type="url"
              value={state.url}
              onChange={handleUrlChange}
              placeholder="https://myanimelist.net/anime/12345/anime-title"
              className={`
                w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                ${state.validationError
                  ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
                }
              `}
              disabled={state.isSubmitting}
            />
            {state.isValidating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {state.validationError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {state.validationError}
            </p>
          )}

          {state.submitError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
              <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {state.submitError}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {showValidateButton && (
            <button
              type="button"
              onClick={handleValidateUrl}
              disabled={state.isValidating}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-300 mr-2 inline-block"></div>
                  Validating...
                </>
              ) : (
                'Validate URL'
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={!isFormValid || state.isSubmitting || state.isValidating}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {state.isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                Adding Anime...
              </>
            ) : (
              'Add to Watchlist'
            )}
          </button>
        </div>
      </form>

      {/* Help text */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Tip:</strong> Copy the URL from any anime page on MyAnimeList.
          The system will automatically fetch the title, image, rating, and other details.
        </p>
      </div>
    </div>
  );
}