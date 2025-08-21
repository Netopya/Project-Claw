import type { MyAnimeListResponse, SeriesInfo, CreateAnimeData } from '../../types/anime.js';
import { 
  transformToCreateAnimeData, 
  validateAndTransformApiResponse,
  normalizeTitle,
  formatRating,
  formatEpisodeCount,
  formatPremiereDate,
  generateSeriesBadge
} from './data-processor.js';

/**
 * Transform MyAnimeList API response to our internal anime data format
 * @deprecated Use transformToCreateAnimeData from data-processor.ts instead
 */
export function transformMyAnimeListData(
  malData: MyAnimeListResponse,
  seriesInfo: SeriesInfo | null = null
): CreateAnimeData {
  return transformToCreateAnimeData(malData, seriesInfo);
}

/**
 * Validate and transform MyAnimeList API response
 */
export function validateAndTransformMyAnimeListData(
  response: unknown,
  seriesInfo: SeriesInfo | null = null
) {
  return validateAndTransformApiResponse(response, seriesInfo);
}

/**
 * Validate MyAnimeList API response data
 */
export function validateMyAnimeListData(data: any): data is MyAnimeListResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (!data.id || typeof data.id !== 'number') {
    return false;
  }

  if (!data.title || typeof data.title !== 'string') {
    return false;
  }

  return true;
}

/**
 * Extract the best available title from MyAnimeList data
 */
export function getBestTitle(malData: MyAnimeListResponse): string {
  // Prefer English title if available, otherwise use main title
  return malData.alternative_titles?.en || malData.title;
}

/**
 * Extract the best available image URL from MyAnimeList data
 */
export function getBestImageUrl(malData: MyAnimeListResponse): string | null {
  if (!malData.main_picture) {
    return null;
  }

  // Prefer large image, fallback to medium
  return malData.main_picture.large || malData.main_picture.medium || null;
}

/**
 * Format series information for display
 */
export function formatSeriesInfo(seriesInfo: SeriesInfo | null): string | null {
  if (!seriesInfo) {
    return null;
  }

  const { totalSeries, currentPosition } = seriesInfo;

  if (totalSeries <= 1) {
    return null;
  }

  // Generate user-friendly series information
  if (totalSeries === 2) {
    return currentPosition === 1 ? 'Part 1 of 2' : 'Part 2 of 2';
  }

  if (totalSeries <= 4) {
    return `Season ${currentPosition} of ${totalSeries}`;
  }

  return `Part ${currentPosition} of ${totalSeries}`;
}

/**
 * Clean and normalize anime title for URL slugs
 */
export function createTitleSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Parse date string from MyAnimeList API
 */
export function parseMyAnimeListDate(dateString: string | undefined): Date | null {
  if (!dateString) {
    return null;
  }

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('Failed to parse date:', dateString);
    return null;
  }
}

/**
 * Format rating for display
 */
export function formatRating(rating: number | null | undefined): string {
  if (!rating) {
    return 'N/A';
  }

  return rating.toFixed(1);
}

/**
 * Determine if anime data is complete enough for our application
 */
export function isAnimeDataComplete(malData: MyAnimeListResponse): boolean {
  // At minimum, we need ID and title
  return !!(malData.id && malData.title);
}

/**
 * Extract all available titles from MyAnimeList data
 */
export function extractAllTitles(malData: MyAnimeListResponse): string[] {
  const titles: string[] = [malData.title];

  if (malData.alternative_titles?.en) {
    titles.push(malData.alternative_titles.en);
  }

  if (malData.alternative_titles?.ja) {
    titles.push(malData.alternative_titles.ja);
  }

  // Remove duplicates and empty strings
  return [...new Set(titles.filter(title => title && title.trim().length > 0))];
}