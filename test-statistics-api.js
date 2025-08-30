// Simple test script to verify the statistics API endpoints
import { app } from './src/api/server.js';

async function testStatisticsEndpoints() {
  console.log('🧪 Testing Statistics API Endpoints...\n');

  const endpoints = [
    '/api/export/stats',
    '/api/export/stats/detailed',
    '/api/export/stats/validate'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint}...`);
      
      const request = new Request(`http://localhost:3001${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await app.fetch(request);
      const data = await response.json();
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Response:`, JSON.stringify(data, null, 2));
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error testing ${endpoint}:`, error.message);
      console.log('');
    }
  }
  
  console.log('🎉 Statistics API testing complete!');
}

// Run the tests
testStatisticsEndpoints().catch(console.error);