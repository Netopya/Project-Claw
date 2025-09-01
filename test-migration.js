#!/usr/bin/env node

/**
 * Simple test script to verify the migration system works
 */

import { MigrationService } from './src/db/migration-service.js';
import { initializeDatabase } from './src/db/connection.js';

async function testMigration() {
  try {
    console.log('🧪 Testing migration system...\n');
    
    // Test migration service
    const migrationService = new MigrationService();
    
    // Check status
    console.log('📊 Checking migration status...');
    const status = await migrationService.getMigrationStatus();
    console.log(`Applied: ${status.appliedMigrations}/${status.totalMigrations}`);
    console.log(`Needs migration: ${status.needsMigration}`);
    
    if (status.lastMigration) {
      console.log(`Last migration: ${status.lastMigration}`);
    }
    
    // Test database initialization
    console.log('\n🚀 Testing database initialization...');
    await initializeDatabase();
    
    console.log('\n✅ Migration system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  }
}

testMigration();