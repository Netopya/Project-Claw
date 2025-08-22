import { app } from './server.js';
import { initializeDatabase } from '../db/connection.js';

/**
 * Test suite for API endpoints
 * Run with: tsx src/api/test-endpoints.ts
 */

async function testApiEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');

  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Test health endpoints
    console.log('🏥 Testing Health Endpoints:');
    await testHealthEndpoints();
    console.log();

    // Test anime endpoints
    console.log('📚 Testing Anime Endpoints:');
    await testAnimeEndpoints();
    console.log();

    console.log('🎉 All API endpoint tests completed!');

  } catch (error) {
    console.error('❌ API tests failed:', error);
    process.exit(1);
  }
}

async function testHealthEndpoints() {
  // Test basic health check
  console.log('  Testing GET /api/health...');
  const healthResponse = await app.request('/api/health');
  console.log(`    Status: ${healthResponse.status}`);
  const healthData = await healthResponse.json();
  console.log(`    Response: ${healthData.status}`);

  // Test detailed health check
  console.log('  Testing GET /api/health/detailed...');
  const detailedResponse = await app.request('/api/health/detailed');
  console.log(`    Status: ${detailedResponse.status}`);
  const detailedData = await detailedResponse.json();
  console.log(`    Overall Status: ${detailedData.status}`);
  console.log(`    Database: ${detailedData.checks?.database ? '✅' : '❌'}`);
  console.log(`    MAL API: ${detailedData.checks?.myAnimeListApi ? '✅' : '❌'}`);

  // Test database health check
  console.log('  Testing GET /api/health/database...');
  const dbResponse = await app.request('/api/health/database');
  console.log(`    Status: ${dbResponse.status}`);
  const dbData = await dbResponse.json();
  console.log(`    Database Connected: ${dbData.database?.connected ? '✅' : '❌'}`);
}

async function testAnimeEndpoints() {
  // Test GET /api/anime (empty list initially)
  console.log('  Testing GET /api/anime (initial empty list)...');
  const getResponse = await app.request('/api/anime');
  console.log(`    Status: ${getResponse.status}`);
  const getData = await getResponse.json();
  console.log(`    Count: ${getData.count || 0}`);

  // Test URL validation
  console.log('  Testing POST /api/anime/validate...');
  const validateResponse = await app.request('/api/anime/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://myanimelist.net/anime/16498/Shingeki_no_Kyojin' }),
  });
  console.log(`    Status: ${validateResponse.status}`);
  const validateData = await validateResponse.json();
  console.log(`    Valid: ${validateData.data?.isValid ? '✅' : '❌'}`);
  if (validateData.data?.title) {
    console.log(`    Title: ${validateData.data.title}`);
  }

  // Test invalid URL validation
  console.log('  Testing POST /api/anime/validate (invalid URL)...');
  const invalidValidateResponse = await app.request('/api/anime/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/not-mal' }),
  });
  console.log(`    Status: ${invalidValidateResponse.status}`);
  const invalidValidateData = await invalidValidateResponse.json();
  console.log(`    Valid: ${invalidValidateData.data?.isValid ? '✅' : '❌'}`);

  // Test adding anime (will only work if MAL API is configured)
  console.log('  Testing POST /api/anime (add anime)...');
  const addResponse = await app.request('/api/anime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://myanimelist.net/anime/16498/Shingeki_no_Kyojin' }),
  });
  console.log(`    Status: ${addResponse.status}`);
  const addData = await addResponse.json();
  console.log(`    Success: ${addData.success ? '✅' : '❌'}`);
  if (addData.success) {
    console.log(`    Added: ${addData.data?.title}`);
  } else {
    console.log(`    Error: ${addData.message}`);
  }

  // Test GET /api/anime (after potential addition)
  console.log('  Testing GET /api/anime (after addition attempt)...');
  const getAfterResponse = await app.request('/api/anime');
  console.log(`    Status: ${getAfterResponse.status}`);
  const getAfterData = await getAfterResponse.json();
  console.log(`    Count: ${getAfterData.count || 0}`);

  // Test invalid requests
  console.log('  Testing invalid requests...');
  
  // Invalid POST body
  const invalidPostResponse = await app.request('/api/anime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invalid: 'data' }),
  });
  console.log(`    Invalid POST Status: ${invalidPostResponse.status}`);

  // Invalid reorder request
  const invalidReorderResponse = await app.request('/api/anime/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ animeIds: 'not-an-array' }),
  });
  console.log(`    Invalid Reorder Status: ${invalidReorderResponse.status}`);

  // Invalid delete request
  const invalidDeleteResponse = await app.request('/api/anime/invalid-id', {
    method: 'DELETE',
  });
  console.log(`    Invalid Delete Status: ${invalidDeleteResponse.status}`);

  // Test 404 endpoint
  console.log('  Testing 404 endpoint...');
  const notFoundResponse = await app.request('/api/nonexistent');
  console.log(`    404 Status: ${notFoundResponse.status}`);
}

// Helper function to make requests with better error handling
async function makeRequest(path: string, options?: RequestInit) {
  try {
    const response = await app.request(path, options);
    return response;
  } catch (error) {
    console.error(`Request failed for ${path}:`, error);
    throw error;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testApiEndpoints()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}