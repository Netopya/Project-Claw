/**
 * Utility functions for parsing MyAnimeList URLs
 */

export interface ParsedAnimeUrl {
  malId: number;
  isValid: boolean;
  error?: string;
}

/**
 * Extract anime ID from MyAnimeList URL
 * Supports formats:
 * - https://myanimelist.net/anime/{id}
 * - https://myanimelist.net/anime/{id}/title-slug
 * - http://myanimelist.net/anime/{id}
 */
export function parseMyAnimeListUrl(url: string): ParsedAnimeUrl {
  try {
    // Basic URL validation
    if (!url || typeof url !== 'string') {
      return {
        malId: 0,
        isValid: false,
        error: 'URL is required and must be a string'
      };
    }

    // Normalize URL - ensure it starts with http/https
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    // Parse URL
    const parsedUrl = new URL(normalizedUrl);
    
    // Check if it's a MyAnimeList domain
    if (!parsedUrl.hostname.includes('myanimelist.net')) {
      return {
        malId: 0,
        isValid: false,
        error: 'URL must be from myanimelist.net'
      };
    }

    // Extract path and check format
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    
    // Should be: ['anime', '{id}', ...optional title parts]
    if (pathParts.length < 2 || pathParts[0] !== 'anime') {
      return {
        malId: 0,
        isValid: false,
        error: 'URL must be in format: https://myanimelist.net/anime/{id}'
      };
    }

    // Extract and validate anime ID
    const animeIdStr = pathParts[1];
    const animeId = parseInt(animeIdStr, 10);

    if (isNaN(animeId) || animeId <= 0) {
      return {
        malId: 0,
        isValid: false,
        error: 'Invalid anime ID in URL'
      };
    }

    return {
      malId: animeId,
      isValid: true
    };

  } catch (error) {
    return {
      malId: 0,
      isValid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Validate if a string looks like a MyAnimeList URL
 */
export function isMyAnimeListUrl(url: string): boolean {
  const parsed = parseMyAnimeListUrl(url);
  return parsed.isValid;
}

/**
 * Generate a clean MyAnimeList URL from an anime ID
 */
export function generateMyAnimeListUrl(malId: number, title?: string): string {
  const baseUrl = `https://myanimelist.net/anime/${malId}`;
  
  if (title) {
    // Create URL-friendly slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    return `${baseUrl}/${slug}`;
  }
  
  return baseUrl;
}