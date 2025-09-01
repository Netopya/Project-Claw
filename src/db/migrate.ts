#!/usr/bin/env tsx

/**
 * Database Migration Management Script
 * 
 * This script provides utilities for managing database migrations:
 * - Run pending migrations
 * - Check migration status
 * - Generate new migrations
 * - Reset database (development only)
 */

import { MigrationService } from './migration-service.js';
import { initializeDatabase, closeDatabaseConnection } from './connection.js';
import { config } from '../config/env.js';

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'status':
        await showMigrationStatus();
        break;
      case 'run':
        await runMigrations();
        break;
      case 'reset':
        await resetDatabase();
        break;
      case 'verify':
        await verifyDatabase();
        break;
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Migration command failed:', error);
    process.exit(1);
  } finally {
    closeDatabaseConnection();
  }
}

async function showMigrationStatus() {
  console.log('📊 Checking migration status...\n');
  
  const migrationService = new MigrationService();
  const status = await migrationService.getMigrationStatus();
  
  console.log(`Database: ${config.databasePath}`);
  console.log(`Applied migrations: ${status.appliedMigrations}`);
  console.log(`Total migrations: ${status.totalMigrations}`);
  console.log(`Needs migration: ${status.needsMigration ? '✅ Yes' : '❌ No'}`);
  
  if (status.lastMigration) {
    console.log(`Last migration: ${status.lastMigration}`);
  }
  
  if (status.needsMigration) {
    console.log(`\n🔄 ${status.totalMigrations - status.appliedMigrations} pending migration(s)`);
    console.log('Run "npm run db:migrate run" to apply pending migrations');
  } else {
    console.log('\n✅ Database is up to date');
  }
}

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');
  
  const migrationService = new MigrationService();
  
  // Show status before migration
  const statusBefore = await migrationService.getMigrationStatus();
  console.log(`Before: ${statusBefore.appliedMigrations}/${statusBefore.totalMigrations} migrations applied`);
  
  if (!statusBefore.needsMigration) {
    console.log('✅ No migrations needed - database is already up to date');
    return;
  }
  
  // Run migrations
  await migrationService.runMigrations();
  
  // Create performance indexes
  await migrationService.createPerformanceIndexes();
  
  // Verify integrity
  const isValid = await migrationService.verifyDatabaseIntegrity();
  if (!isValid) {
    throw new Error('Database integrity verification failed after migration');
  }
  
  // Show status after migration
  const statusAfter = await migrationService.getMigrationStatus();
  console.log(`\nAfter: ${statusAfter.appliedMigrations}/${statusAfter.totalMigrations} migrations applied`);
  console.log('✅ Migration completed successfully');
}

async function resetDatabase() {
  if (!config.isDevelopment) {
    console.error('❌ Database reset is only allowed in development environment');
    console.error('Set NODE_ENV=development to enable this command');
    process.exit(1);
  }
  
  console.log('⚠️  WARNING: This will completely reset your database!');
  console.log('All data will be lost. This action cannot be undone.\n');
  
  // In a real implementation, you might want to add a confirmation prompt here
  console.log('🗑️  Resetting database...');
  
  const { getSQLiteConnection } = await import('./connection.js');
  const sqlite = getSQLiteConnection();
  
  try {
    // Drop all tables
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];
    
    console.log(`Dropping ${tables.length} tables...`);
    
    // Disable foreign key constraints temporarily
    sqlite.exec('PRAGMA foreign_keys = OFF');
    
    for (const table of tables) {
      sqlite.exec(`DROP TABLE IF EXISTS "${table.name}"`);
      console.log(`  ✓ Dropped table: ${table.name}`);
    }
    
    // Re-enable foreign key constraints
    sqlite.exec('PRAGMA foreign_keys = ON');
    
    console.log('\n🔄 Running fresh migrations...');
    
    // Run migrations to recreate schema
    await initializeDatabase();
    
    console.log('✅ Database reset completed successfully');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

async function verifyDatabase() {
  console.log('🔍 Verifying database integrity...\n');
  
  const migrationService = new MigrationService();
  const isValid = await migrationService.verifyDatabaseIntegrity();
  
  if (isValid) {
    console.log('✅ Database integrity verification passed');
  } else {
    console.log('❌ Database integrity verification failed');
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🗃️  Database Migration Management

Usage: npm run db:migrate <command>

Commands:
  status    Show current migration status
  run       Run all pending migrations
  verify    Verify database integrity
  reset     Reset database (development only)

Examples:
  npm run db:migrate status
  npm run db:migrate run
  npm run db:migrate verify
  npm run db:migrate reset

Environment:
  Database: ${config.databasePath}
  Environment: ${config.isDevelopment ? 'development' : 'production'}
`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}