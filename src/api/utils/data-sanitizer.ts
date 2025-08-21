import type { CreateAnimeData, UpdateAnimeData, SeriesInfo } from '../../types/anime.js';

/**
 * Data sanitization utilities to clean and normalize data
 */

/**
 * Sanitize string input
 */
export function sanitizeString(input: unknown, maxLength: number = 500): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input !== 'string') {
    return null;
  }

  return input
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, maxLength) || null; // Return null if empty after sanitization
}

/**
 * Sanitize URL input
 */
export function sanitizeUrl(input: unknown): string | null {
  const sanitized = sanitizeString(input, 2000);
  
  if (!sanitized) {
    return null;
  }

  try {
    // Validate URL format
    new URL(sanitized);
    return sanitized;
  } catch (error) {
    return null;
  }
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: unknown, min?: number, max?: number): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  let num: number;

  if (typeof input === 'number') {
    num = input;
  } else if (typeof input === 'string') {
    num = parseFloat(input);
  } else {
    return null;
  }

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return null;
  }

  if (max !== undefined && num > max) {
    return null;
  }

  return num;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: unknown, min?: number, max?: number): number | null {
  const num = sanitizeNumber(input, min, max);
  
  if (num === null) {
    return null;
  }

  return Number.isInteger(num) ? num : null;
}

/**
 * Sanitize date input
 */
export function sanitizeDate(input: unknown): Date | null {
  if (input === null || input === undefined) {
    return null;
  }

  let date: Date;

  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    date = new Date(input);
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else {
    return null;
  }

  if (isNaN(date.getTime())) {
    return null;
  }

  // Reasonable date range for anime (1900 to 10 years in the future)
  const minDate = new Date('1900-01-01');
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);

  if (date < minDate || date > maxDate) {
    return null;
  }

  return date;
}

/**
 * Sanitize series info object
 */
export function sanitizeSeriesInfo(input: unknown): SeriesInfo | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input !== 'object') {
    return null;
  }

  const obj = input as any;

  const totalSeries = sanitizeInteger(obj.totalSeries, 1, 1000);
  const currentPosition = sanitizeInteger(obj.currentPosition, 1, 1000);

  if (totalSeries === null || currentPosition === null) {
    return null;
  }

  if (currentPosition > totalSeries) {
    return null;
  }

  const hasSequels = typeof obj.hasSequels === 'boolean' ? obj.hasSequels : false;
  const hasPrequels = typeof obj.hasPrequels === 'boolean' ? obj.hasPrequels : false;

  let relatedTitles: string[] = [];
  if (Array.isArray(obj.relatedTitles)) {
    relatedTitles = obj.relatedTitles
      .map(title => sanitizeString(title, 200))
      .filter((title): title is string => title !== null)
      .slice(0, 50); // Limit to 50 related titles
  }

  return {
    totalSeries,
    currentPosition,
    hasSequels,
    hasPrequels,
    relatedTitles,
  };
}

/**
 * Sanitize create anime data
 */
export function sanitizeCreateAnimeData(input: unknown): CreateAnimeData | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const obj = input as any;

  const malId = sanitizeInteger(obj.malId, 1, 999999999);
  const title = sanitizeString(obj.title, 500);

  if (malId === null || title === null) {
    return null; // Required fields missing
  }

  return {
    malId,
    title,
    titleEnglish: sanitizeString(obj.titleEnglish, 500),
    titleJapanese: sanitizeString(obj.titleJapanese, 500),
    imageUrl: sanitizeUrl(obj.imageUrl),
    rating: sanitizeNumber(obj.rating, 0, 10),
    premiereDate: sanitizeDate(obj.premiereDate),
    numEpisodes: sanitizeInteger(obj.numEpisodes, 0, 10000),
    seriesInfo: sanitizeSeriesInfo(obj.seriesInfo),
  };
}

/**
 * Sanitize update anime data
 */
export function sanitizeUpdateAnimeData(input: unknown): UpdateAnimeData | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const obj = input as any;
  const sanitized: UpdateAnimeData = {};

  // All fields are optional for updates
  if (obj.title !== undefined) {
    const title = sanitizeString(obj.title, 500);
    if (title !== null) {
      sanitized.title = title;
    }
  }

  if (obj.titleEnglish !== undefined) {
    sanitized.titleEnglish = sanitizeString(obj.titleEnglish, 500);
  }

  if (obj.titleJapanese !== undefined) {
    sanitized.titleJapanese = sanitizeString(obj.titleJapanese, 500);
  }

  if (obj.imageUrl !== undefined) {
    sanitized.imageUrl = sanitizeUrl(obj.imageUrl);
  }

  if (obj.rating !== undefined) {
    sanitized.rating = sanitizeNumber(obj.rating, 0, 10);
  }

  if (obj.premiereDate !== undefined) {
    sanitized.premiereDate = sanitizeDate(obj.premiereDate);
  }

  if (obj.numEpisodes !== undefined) {
    sanitized.numEpisodes = sanitizeInteger(obj.numEpisodes, 0, 10000);
  }

  if (obj.priority !== undefined) {
    sanitized.priority = sanitizeInteger(obj.priority, 1, 1000000);
  }

  if (obj.seriesInfo !== undefined) {
    sanitized.seriesInfo = sanitizeSeriesInfo(obj.seriesInfo);
  }

  // Return null if no valid fields were found
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Deep sanitize any object by recursively cleaning all string values
 */
export function deepSanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number') {
    return isFinite(obj) ? obj : null;
  }

  if (typeof obj === 'boolean') {
    return obj;
  }

  if (obj instanceof Date) {
    return sanitizeDate(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeObject(item)).filter(item => item !== null);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, 100);
      const sanitizedValue = deepSanitizeObject(value);
      
      if (sanitizedKey && sanitizedValue !== null) {
        sanitized[sanitizedKey] = sanitizedValue;
      }
    }
    return sanitized;
  }

  return null;
}

/**
 * Remove potentially dangerous content from strings
 */
export function removeDangerousContent(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:(?!image\/)/gi, ''); // Remove non-image data URLs
}

/**
 * Sanitize HTML content (basic implementation)
 */
export function sanitizeHtml(input: string): string {
  return removeDangerousContent(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}