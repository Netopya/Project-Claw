import type { MyAnimeListResponse, SeriesInfo, CreateAnimeData } from '../../types/anime.js';
import { validateMyAnimeListResponse, validateCreateAnimeData } from '../../types/validation.js';

/**
 * Data processing utilities for MyAnimeList API responses
 */

/**
 * Process and validate MyAnimeList API response
 */
export function processMyAnimeListResponse(
  response: unknown
): { isValid: boolean; data?: MyAnimeListResponse; errors: string[] } {
  const validation = validateMyAnimeListResponse(response);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      errors: validation.errors,
    };
  }

  return {
    isValid: true,
    data: response as MyAnimeListResponse,
    errors: [],
  };
}

/**
 * Extract the best available title from MyAnimeList response
 */
export function extractBestTitle(malData: MyAnimeListResponse): string {
  // Priority: English title > Main title
  return malData.alternative_titles?.en || malData.title;
}

/**
 * Extract the best available image URL from MyAnimeList response
 */
export function extractBestImageUrl(malData: MyAnimeListResponse): string | null {
  if (!malData.main_picture) {
    return null;
  }

  // Priority: Large image > Medium image
  return malData.main_picture.large || malData.main_picture.medium || null;
}

/**
 * Parse date string from MyAnimeList API
 */
export function parseApiDate(dateString: string | undefined): Date | null {
  if (!dateString) {
    return null;
  }

  try {
    // MyAnimeList API returns dates in YYYY-MM-DD format
    const date = new Date(dateString + 'T00:00:00.000Z'); // Add time to avoid timezone issues
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Failed to parse date from API:', dateString);
    return null;
  }
}

/**
 * Process series relationships from MyAnimeList API response
 */
export function processSeriesRelationships(malData: MyAnimeListResponse): SeriesInfo | null {
  if (!malData.related_anime || malData.related_anime.length === 0) {
    return null;
  }

  try {
    const relatedAnime = malData.related_anime;
    
    // Group by relation type
    const relationGroups = relatedAnime.reduce((groups, relation) => {
      const type = relation.relation_type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(relation);
      return groups;
    }, {} as Record<string, typeof relatedAnime>);

    // Extract relevant relation types
    const sequels = relationGroups['sequel'] || [];
    const prequels = relationGroups['prequel'] || [];
    const alternativeVersions = relationGroups['alternative_version'] || [];
    const sideStories = relationGroups['side_story'] || [];

    // Calculate series information
    const hasSequels = sequels.length > 0;
    const hasPrequels = prequels.length > 0;
    
    // Simple calculation for series position and total
    // This is a basic implementation - a more sophisticated version would
    // recursively fetch related anime to build the complete series tree
    let currentPosition = 1;
    let totalSeries = 1;

    if (hasPrequels) {
      currentPosition += prequels.length;
      totalSeries += prequels.length;
    }

    if (hasSequels) {
      totalSeries += sequels.length;
    }

    // Include alternative versions in total count
    if (alternativeVersions.length > 0) {
      totalSeries += alternativeVersions.length;
    }

    // Extract related titles
    const relatedTitles = relatedAnime
      .map(relation => relation.node.title)
      .filter(title => title && title.trim().length > 0);

    return {
      totalSeries,
      currentPosition,
      hasSequels,
      hasPrequels,
      relatedTitles: [...new Set(relatedTitles)], // Remove duplicates
    };

  } catch (error) {
    console.error('Failed to process series relationships:', error);
    return null;
  }
}

/**
 * Transform MyAnimeList API response to CreateAnimeData format
 */
export function transformToCreateAnimeData(
  malData: MyAnimeListResponse,
  seriesInfo: SeriesInfo | null = null
): CreateAnimeData {
  const transformed: CreateAnimeData = {
    malId: malData.id,
    title: malData.title,
    titleEnglish: malData.alternative_titles?.en || null,
    // Use the main title (romanized Japanese) instead of the Japanese characters
    titleJapanese: malData.title || null,
    imageUrl: extractBestImageUrl(malData),
    rating: malData.mean || null,
    premiereDate: parseApiDate(malData.start_date),
    numEpisodes: malData.num_episodes || null,
    seriesInfo,
  };

  return transformed;
}

/**
 * Validate and transform MyAnimeList response to CreateAnimeData
 */
export function validateAndTransformApiResponse(
  response: unknown,
  seriesInfo: SeriesInfo | null = null
): { isValid: boolean; data?: CreateAnimeData; errors: string[]; warnings?: string[] } {
  // First validate the API response
  const responseValidation = processMyAnimeListResponse(response);
  if (!responseValidation.isValid || !responseValidation.data) {
    return {
      isValid: false,
      errors: responseValidation.errors,
    };
  }

  // Transform to our format
  const transformed = transformToCreateAnimeData(responseValidation.data, seriesInfo);

  // Validate the transformed data
  const dataValidation = validateCreateAnimeData(transformed);
  
  return {
    isValid: dataValidation.isValid,
    data: dataValidation.isValid ? transformed : undefined,
    errors: dataValidation.errors,
    warnings: dataValidation.warnings,
  };
}

/**
 * Clean and normalize anime title for display
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-\.\!\?\:\;\,\(\)\[\]]/g, '') // Remove special characters except common punctuation
    .substring(0, 500); // Limit length
}

/**
 * Format rating for display
 */
export function formatRating(rating: number | null): string {
  if (rating === null || rating === undefined) {
    return 'N/A';
  }

  return rating.toFixed(1);
}

/**
 * Format episode count for display
 */
export function formatEpisodeCount(numEpisodes: number | null): string {
  if (numEpisodes === null || numEpisodes === undefined) {
    return 'Unknown';
  }

  if (numEpisodes === 1) {
    return '1 episode';
  }

  return `${numEpisodes} episodes`;
}

/**
 * Format premiere date for display
 */
export function formatPremiereDate(premiereDate: Date | null): string {
  if (!premiereDate) {
    return 'Unknown';
  }

  return premiereDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Generate series badge text for display
 */
export function generateSeriesBadge(seriesInfo: SeriesInfo | null): string | null {
  if (!seriesInfo || seriesInfo.totalSeries <= 1) {
    return null;
  }

  const { totalSeries, currentPosition } = seriesInfo;

  if (totalSeries === 2) {
    return `Part ${currentPosition} of 2`;
  }

  if (totalSeries <= 4) {
    return `Season ${currentPosition} of ${totalSeries}`;
  }

  return `Part ${currentPosition} of ${totalSeries}`;
}

/**
 * Check if anime data has sufficient information for display
 */
export function hasMinimumDisplayData(anime: CreateAnimeData): boolean {
  return !!(anime.malId && anime.title);
}

/**
 * Calculate data completeness score (0-100)
 */
export function calculateDataCompleteness(anime: CreateAnimeData): number {
  const fields = [
    anime.title,
    anime.titleEnglish,
    anime.titleJapanese,
    anime.imageUrl,
    anime.rating,
    anime.premiereDate,
    anime.numEpisodes,
    anime.seriesInfo,
  ];

  const filledFields = fields.filter(field => field !== null && field !== undefined).length;
  return Math.round((filledFields / fields.length) * 100);
}