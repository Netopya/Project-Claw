import { 
  validateMalId, 
  validateTitle, 
  validateImageUrl, 
  validateRating, 
  validateNumEpisodes, 
  validatePremiereDate, 
  validateSeriesInfo, 
  validateCreateAnimeData,
  validateUpdateAnimeData,
  validateMyAnimeListResponse 
} from '../types/validation.js';

import { 
  sanitizeCreateAnimeData, 
  sanitizeUpdateAnimeData, 
  sanitizeString, 
  sanitizeNumber 
} from './utils/data-sanitizer.js';

import { 
  transformToCreateAnimeData, 
  processSeriesRelationships,
  validateAndTransformApiResponse 
} from './utils/data-processor.js';

/**
 * Test suite for data validation and processing
 */

function runValidationTests() {
  console.log('🧪 Running Data Validation Tests...\n');

  // Test MAL ID validation
  console.log('📋 Testing MAL ID validation:');
  console.log('  Valid ID (12345):', validateMalId(12345));
  console.log('  Invalid ID (0):', validateMalId(0));
  console.log('  Invalid ID (string):', validateMalId('abc'));
  console.log('  Invalid ID (null):', validateMalId(null));
  console.log();

  // Test title validation
  console.log('📋 Testing title validation:');
  console.log('  Valid title:', validateTitle('Attack on Titan'));
  console.log('  Empty title:', validateTitle(''));
  console.log('  Null title:', validateTitle(null));
  console.log('  Long title:', validateTitle('A'.repeat(600)));
  console.log();

  // Test image URL validation
  console.log('📋 Testing image URL validation:');
  console.log('  Valid URL:', validateImageUrl('https://cdn.myanimelist.net/images/anime/10/47347.jpg'));
  console.log('  Invalid URL:', validateImageUrl('not-a-url'));
  console.log('  Non-image URL:', validateImageUrl('https://example.com/page'));
  console.log('  Null URL:', validateImageUrl(null));
  console.log();

  // Test rating validation
  console.log('📋 Testing rating validation:');
  console.log('  Valid rating (8.5):', validateRating(8.5));
  console.log('  Invalid rating (-1):', validateRating(-1));
  console.log('  Invalid rating (15):', validateRating(15));
  console.log('  Invalid rating (NaN):', validateRating(NaN));
  console.log();

  // Test episode count validation
  console.log('📋 Testing episode count validation:');
  console.log('  Valid count (24):', validateNumEpisodes(24));
  console.log('  Invalid count (-5):', validateNumEpisodes(-5));
  console.log('  Invalid count (float):', validateNumEpisodes(24.5));
  console.log('  Null count:', validateNumEpisodes(null));
  console.log();

  // Test date validation
  console.log('📋 Testing premiere date validation:');
  console.log('  Valid date:', validatePremiereDate(new Date('2013-04-07')));
  console.log('  Future date:', validatePremiereDate(new Date('2030-01-01')));
  console.log('  Invalid date:', validatePremiereDate(new Date('invalid')));
  console.log('  Very old date:', validatePremiereDate(new Date('1800-01-01')));
  console.log();

  // Test series info validation
  console.log('📋 Testing series info validation:');
  const validSeriesInfo = {
    totalSeries: 4,
    currentPosition: 2,
    hasSequels: true,
    hasPrequels: true,
    relatedTitles: ['Season 1', 'Season 3']
  };
  console.log('  Valid series info:', validateSeriesInfo(validSeriesInfo));
  
  const invalidSeriesInfo = {
    totalSeries: 2,
    currentPosition: 5, // Greater than total
    hasSequels: 'yes', // Should be boolean
    hasPrequels: true,
    relatedTitles: 'not an array'
  };
  console.log('  Invalid series info:', validateSeriesInfo(invalidSeriesInfo));
  console.log();
}

function runSanitizationTests() {
  console.log('🧼 Running Data Sanitization Tests...\n');

  // Test string sanitization
  console.log('📋 Testing string sanitization:');
  console.log('  Normal string:', sanitizeString('Attack on Titan'));
  console.log('  String with extra spaces:', sanitizeString('  Attack   on   Titan  '));
  console.log('  String with control chars:', sanitizeString('Attack\x00on\x1FTitan'));
  console.log('  Empty string:', sanitizeString('   '));
  console.log('  Null input:', sanitizeString(null));
  console.log();

  // Test number sanitization
  console.log('📋 Testing number sanitization:');
  console.log('  Valid number:', sanitizeNumber(8.5, 0, 10));
  console.log('  String number:', sanitizeNumber('8.5', 0, 10));
  console.log('  Out of range:', sanitizeNumber(15, 0, 10));
  console.log('  Invalid input:', sanitizeNumber('abc'));
  console.log();

  // Test create anime data sanitization
  console.log('📋 Testing create anime data sanitization:');
  const validCreateData = {
    malId: 16498,
    title: 'Attack on Titan',
    titleEnglish: 'Attack on Titan',
    titleJapanese: '進撃の巨人',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
    rating: 9.0,
    numEpisodes: 25
  };
  console.log('  Valid data:', sanitizeCreateAnimeData(validCreateData));

  const invalidCreateData = {
    malId: 'not-a-number',
    title: '',
    rating: 15
  };
  console.log('  Invalid data:', sanitizeCreateAnimeData(invalidCreateData));
  console.log();
}

function runProcessingTests() {
  console.log('⚙️ Running Data Processing Tests...\n');

  // Test MyAnimeList API response processing
  console.log('📋 Testing API response processing:');
  
  const mockApiResponse = {
    id: 16498,
    title: 'Shingeki no Kyojin',
    alternative_titles: {
      en: 'Attack on Titan',
      ja: '進撃の巨人'
    },
    main_picture: {
      medium: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
      large: 'https://cdn.myanimelist.net/images/anime/10/47347l.jpg'
    },
    mean: 9.0,
    start_date: '2013-04-07',
    num_episodes: 25,
    related_anime: [
      {
        node: { id: 25777, title: 'Shingeki no Kyojin Season 2' },
        relation_type: 'sequel'
      }
    ]
  };

  const processedResponse = validateAndTransformApiResponse(mockApiResponse);
  console.log('  Processed API response:', processedResponse);
  console.log();

  // Test series relationship processing
  console.log('📋 Testing series relationship processing:');
  const seriesInfo = processSeriesRelationships(mockApiResponse);
  console.log('  Series info:', seriesInfo);
  console.log();
}

function runIntegrationTests() {
  console.log('🔗 Running Integration Tests...\n');

  // Test complete validation workflow
  console.log('📋 Testing complete validation workflow:');
  
  const testData = {
    malId: 16498,
    title: '  Attack on Titan  ', // Has extra spaces
    titleEnglish: 'Attack on Titan',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
    rating: '9.0', // String that should be converted to number
    numEpisodes: 25,
    premiereDate: '2013-04-07' // String date
  };

  console.log('  Original data:', testData);
  
  // Sanitize first
  const sanitized = sanitizeCreateAnimeData(testData);
  console.log('  Sanitized data:', sanitized);
  
  // Then validate
  if (sanitized) {
    const validation = validateCreateAnimeData(sanitized);
    console.log('  Validation result:', validation);
  }
  console.log();
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting Data Model and Validation Tests\n');
    
    runValidationTests();
    runSanitizationTests();
    runProcessingTests();
    runIntegrationTests();
    
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}