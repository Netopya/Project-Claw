import type { 
  Anime, 
  CreateAnimeData, 
  UpdateAnimeData, 
  SeriesInfo, 
  MyAnimeListResponse 
} from './anime.js';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
  strict?: boolean; // Enable strict validation
  allowPartial?: boolean; // Allow partial data for updates
}

/**
 * Validate MyAnimeList ID
 */
export function validateMalId(malId: unknown): ValidationResult {
  const errors: string[] = [];

  if (malId === null || malId === undefined) {
    errors.push('MyAnimeList ID is required');
  } else if (typeof malId !== 'number') {
    errors.push('MyAnimeList ID must be a number');
  } else if (!Number.isInteger(malId)) {
    errors.push('MyAnimeList ID must be an integer');
  } else if (malId <= 0) {
    errors.push('MyAnimeList ID must be a positive number');
  } else if (malId > 999999999) {
    errors.push('MyAnimeList ID is too large');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate anime title
 */
export function validateTitle(title: unknown, fieldName: string = 'title'): ValidationResult {
  const errors: string[] = [];

  if (title === null || title === undefined) {
    errors.push(`${fieldName} is required`);
  } else if (typeof title !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else if (title.trim().length === 0) {
    errors.push(`${fieldName} cannot be empty`);
  } else if (title.length > 500) {
    errors.push(`${fieldName} is too long (maximum 500 characters)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate optional title (can be null)
 */
export function validateOptionalTitle(title: unknown, fieldName: string): ValidationResult {
  if (title === null || title === undefined) {
    return { isValid: true, errors: [] };
  }

  return validateTitle(title, fieldName);
}

/**
 * Validate image URL
 */
export function validateImageUrl(imageUrl: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (imageUrl === null || imageUrl === undefined) {
    return { isValid: true, errors: [] }; // Optional field
  }

  if (typeof imageUrl !== 'string') {
    errors.push('Image URL must be a string');
  } else if (imageUrl.trim().length === 0) {
    errors.push('Image URL cannot be empty');
  } else {
    try {
      const url = new URL(imageUrl);
      
      // Check protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Image URL must use HTTP or HTTPS protocol');
      }

      // Check if it looks like an image URL
      const pathname = url.pathname.toLowerCase();
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
      
      if (!hasImageExtension && !pathname.includes('image')) {
        warnings.push('URL may not point to an image file');
      }

      // Check for MyAnimeList CDN (preferred)
      if (!url.hostname.includes('myanimelist.net')) {
        warnings.push('Image URL is not from MyAnimeList CDN');
      }

    } catch (error) {
      errors.push('Image URL is not a valid URL');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate rating
 */
export function validateRating(rating: unknown): ValidationResult {
  const errors: string[] = [];

  if (rating === null || rating === undefined) {
    return { isValid: true, errors: [] }; // Optional field
  }

  if (typeof rating !== 'number') {
    errors.push('Rating must be a number');
  } else if (isNaN(rating)) {
    errors.push('Rating cannot be NaN');
  } else if (rating < 0) {
    errors.push('Rating cannot be negative');
  } else if (rating > 10) {
    errors.push('Rating cannot be greater than 10');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate number of episodes
 */
export function validateNumEpisodes(numEpisodes: unknown): ValidationResult {
  const errors: string[] = [];

  if (numEpisodes === null || numEpisodes === undefined) {
    return { isValid: true, errors: [] }; // Optional field
  }

  if (typeof numEpisodes !== 'number') {
    errors.push('Number of episodes must be a number');
  } else if (!Number.isInteger(numEpisodes)) {
    errors.push('Number of episodes must be an integer');
  } else if (numEpisodes < 0) {
    errors.push('Number of episodes cannot be negative');
  } else if (numEpisodes > 10000) {
    errors.push('Number of episodes is unrealistically high');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate premiere date
 */
export function validatePremiereDate(premiereDate: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (premiereDate === null || premiereDate === undefined) {
    return { isValid: true, errors: [] }; // Optional field
  }

  if (!(premiereDate instanceof Date)) {
    errors.push('Premiere date must be a Date object');
  } else if (isNaN(premiereDate.getTime())) {
    errors.push('Premiere date is not a valid date');
  } else {
    const now = new Date();
    const minDate = new Date('1900-01-01');
    const maxDate = new Date(now.getFullYear() + 10, 11, 31); // 10 years in the future

    if (premiereDate < minDate) {
      errors.push('Premiere date is too far in the past');
    } else if (premiereDate > maxDate) {
      errors.push('Premiere date is too far in the future');
    } else if (premiereDate > now) {
      warnings.push('Premiere date is in the future');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate priority
 */
export function validatePriority(priority: unknown): ValidationResult {
  const errors: string[] = [];

  if (priority === null || priority === undefined) {
    errors.push('Priority is required');
  } else if (typeof priority !== 'number') {
    errors.push('Priority must be a number');
  } else if (!Number.isInteger(priority)) {
    errors.push('Priority must be an integer');
  } else if (priority < 1) {
    errors.push('Priority must be at least 1');
  } else if (priority > 1000000) {
    errors.push('Priority is too high');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate series info
 */
export function validateSeriesInfo(seriesInfo: unknown): ValidationResult {
  const errors: string[] = [];

  if (seriesInfo === null || seriesInfo === undefined) {
    return { isValid: true, errors: [] }; // Optional field
  }

  if (typeof seriesInfo !== 'object') {
    errors.push('Series info must be an object');
    return { isValid: false, errors };
  }

  const info = seriesInfo as any;

  // Validate totalSeries
  if (typeof info.totalSeries !== 'number' || !Number.isInteger(info.totalSeries) || info.totalSeries < 1) {
    errors.push('Series info totalSeries must be a positive integer');
  }

  // Validate currentPosition
  if (typeof info.currentPosition !== 'number' || !Number.isInteger(info.currentPosition) || info.currentPosition < 1) {
    errors.push('Series info currentPosition must be a positive integer');
  }

  // Validate position is not greater than total
  if (typeof info.totalSeries === 'number' && typeof info.currentPosition === 'number') {
    if (info.currentPosition > info.totalSeries) {
      errors.push('Series info currentPosition cannot be greater than totalSeries');
    }
  }

  // Validate boolean fields
  if (typeof info.hasSequels !== 'boolean') {
    errors.push('Series info hasSequels must be a boolean');
  }

  if (typeof info.hasPrequels !== 'boolean') {
    errors.push('Series info hasPrequels must be a boolean');
  }

  // Validate relatedTitles
  if (!Array.isArray(info.relatedTitles)) {
    errors.push('Series info relatedTitles must be an array');
  } else {
    info.relatedTitles.forEach((title: any, index: number) => {
      if (typeof title !== 'string') {
        errors.push(`Series info relatedTitles[${index}] must be a string`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate create anime data
 */
export function validateCreateAnimeData(data: unknown, options: ValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Anime data must be an object'],
    };
  }

  const animeData = data as any;

  // Validate required fields
  const malIdResult = validateMalId(animeData.malId);
  errors.push(...malIdResult.errors);

  const titleResult = validateTitle(animeData.title);
  errors.push(...titleResult.errors);

  // Validate optional fields
  if (animeData.titleEnglish !== undefined) {
    const titleEnglishResult = validateOptionalTitle(animeData.titleEnglish, 'English title');
    errors.push(...titleEnglishResult.errors);
  }

  if (animeData.titleJapanese !== undefined) {
    const titleJapaneseResult = validateOptionalTitle(animeData.titleJapanese, 'Japanese title');
    errors.push(...titleJapaneseResult.errors);
  }

  if (animeData.imageUrl !== undefined) {
    const imageUrlResult = validateImageUrl(animeData.imageUrl);
    errors.push(...imageUrlResult.errors);
    if (imageUrlResult.warnings) warnings.push(...imageUrlResult.warnings);
  }

  if (animeData.rating !== undefined) {
    const ratingResult = validateRating(animeData.rating);
    errors.push(...ratingResult.errors);
  }

  if (animeData.numEpisodes !== undefined) {
    const numEpisodesResult = validateNumEpisodes(animeData.numEpisodes);
    errors.push(...numEpisodesResult.errors);
  }

  if (animeData.premiereDate !== undefined) {
    const premiereDateResult = validatePremiereDate(animeData.premiereDate);
    errors.push(...premiereDateResult.errors);
    if (premiereDateResult.warnings) warnings.push(...premiereDateResult.warnings);
  }

  if (animeData.seriesInfo !== undefined) {
    const seriesInfoResult = validateSeriesInfo(animeData.seriesInfo);
    errors.push(...seriesInfoResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate update anime data
 */
export function validateUpdateAnimeData(data: unknown, options: ValidationOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Update data must be an object'],
    };
  }

  const updateData = data as any;

  // All fields are optional for updates, but if present, must be valid
  if (updateData.title !== undefined) {
    const titleResult = validateTitle(updateData.title);
    errors.push(...titleResult.errors);
  }

  if (updateData.titleEnglish !== undefined) {
    const titleEnglishResult = validateOptionalTitle(updateData.titleEnglish, 'English title');
    errors.push(...titleEnglishResult.errors);
  }

  if (updateData.titleJapanese !== undefined) {
    const titleJapaneseResult = validateOptionalTitle(updateData.titleJapanese, 'Japanese title');
    errors.push(...titleJapaneseResult.errors);
  }

  if (updateData.imageUrl !== undefined) {
    const imageUrlResult = validateImageUrl(updateData.imageUrl);
    errors.push(...imageUrlResult.errors);
    if (imageUrlResult.warnings) warnings.push(...imageUrlResult.warnings);
  }

  if (updateData.rating !== undefined) {
    const ratingResult = validateRating(updateData.rating);
    errors.push(...ratingResult.errors);
  }

  if (updateData.numEpisodes !== undefined) {
    const numEpisodesResult = validateNumEpisodes(updateData.numEpisodes);
    errors.push(...numEpisodesResult.errors);
  }

  if (updateData.premiereDate !== undefined) {
    const premiereDateResult = validatePremiereDate(updateData.premiereDate);
    errors.push(...premiereDateResult.errors);
    if (premiereDateResult.warnings) warnings.push(...premiereDateResult.warnings);
  }

  if (updateData.priority !== undefined) {
    const priorityResult = validatePriority(updateData.priority);
    errors.push(...priorityResult.errors);
  }

  if (updateData.seriesInfo !== undefined) {
    const seriesInfoResult = validateSeriesInfo(updateData.seriesInfo);
    errors.push(...seriesInfoResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate MyAnimeList API response
 */
export function validateMyAnimeListResponse(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['MyAnimeList response must be an object'],
    };
  }

  const response = data as any;

  // Validate required fields from API
  const idResult = validateMalId(response.id);
  errors.push(...idResult.errors);

  const titleResult = validateTitle(response.title);
  errors.push(...titleResult.errors);

  // Validate optional fields if present
  if (response.alternative_titles) {
    if (typeof response.alternative_titles !== 'object') {
      errors.push('Alternative titles must be an object');
    } else {
      if (response.alternative_titles.en !== undefined) {
        const enResult = validateOptionalTitle(response.alternative_titles.en, 'English alternative title');
        errors.push(...enResult.errors);
      }
      if (response.alternative_titles.ja !== undefined) {
        const jaResult = validateOptionalTitle(response.alternative_titles.ja, 'Japanese alternative title');
        errors.push(...jaResult.errors);
      }
    }
  }

  if (response.main_picture) {
    if (typeof response.main_picture !== 'object') {
      errors.push('Main picture must be an object');
    } else {
      if (response.main_picture.medium) {
        const mediumResult = validateImageUrl(response.main_picture.medium);
        errors.push(...mediumResult.errors);
      }
      if (response.main_picture.large) {
        const largeResult = validateImageUrl(response.main_picture.large);
        errors.push(...largeResult.errors);
      }
    }
  }

  if (response.mean !== undefined) {
    const ratingResult = validateRating(response.mean);
    errors.push(...ratingResult.errors);
  }

  if (response.num_episodes !== undefined) {
    const episodesResult = validateNumEpisodes(response.num_episodes);
    errors.push(...episodesResult.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}