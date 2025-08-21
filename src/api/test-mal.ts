import { AnimeService } from './services/anime-service.js';
import { initializeDatabase } from '../db/connection.js';

/**
 * Test script for MyAnimeList API integration
 * Run with: tsx src/api/test-mal.ts
 */

async function testMyAnimeListIntegration() {
  console.log('🧪 Testing MyAnimeList API Integration...\n');

  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Create anime service
    const animeService = new AnimeService();

    // Check API status
    console.log('🔍 Checking API status...');
    const apiStatus = await animeService.checkApiStatus();
    console.log('API Status:', apiStatus);
    
    if (!apiStatus.isConfigured) {
      console.log('\n⚠️  MyAnimeList API not configured. Please set MAL_CLIENT_ID and MAL_CLIENT_SECRET environment variables.');
      console.log('You can still test URL parsing functionality.\n');
    }

    // Test URL parsing
    console.log('🔗 Testing URL parsing...');
    const testUrls = [
      'https://myanimelist.net/anime/16498/Shingeki_no_Kyojin',
      'https://myanimelist.net/anime/11061',
      'myanimelist.net/anime/9253/Steins_Gate',
      'https://myanimelist.net/anime/invalid',
      'https://example.com/anime/123',
    ];

    for (const url of testUrls) {
      try {
        const validation = await animeService.validateAnimeUrl(url);
        console.log(`  ${url}`);
        console.log(`    Valid: ${validation.isValid}`);
        if (validation.malId) console.log(`    MAL ID: ${validation.malId}`);
        if (validation.title) console.log(`    Title: ${validation.title}`);
        if (validation.error) console.log(`    Error: ${validation.error}`);
        console.log();
      } catch (error) {
        console.log(`  ${url}: Error - ${error.message}\n`);
      }
    }

    // Test adding anime (only if API is configured)
    if (apiStatus.isConfigured && apiStatus.isWorking) {
      console.log('➕ Testing anime addition...');
      try {
        const anime = await animeService.addAnimeFromUrl('https://myanimelist.net/anime/16498/Shingeki_no_Kyojin');
        console.log('✅ Successfully added anime:');
        console.log(`  Title: ${anime.title}`);
        console.log(`  MAL ID: ${anime.malId}`);
        console.log(`  Rating: ${anime.rating}`);
        console.log(`  Episodes: ${anime.numEpisodes}`);
        console.log();
      } catch (error) {
        console.log(`❌ Failed to add anime: ${error.message}\n`);
      }
    }

    console.log('🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMyAnimeListIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });