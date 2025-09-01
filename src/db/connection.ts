import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config/env.js';
import { MigrationService } from './migration-service.js';

const DATABASE_PATH = config.databasePath;

// Ensure the data directory exists
const dbDir = dirname(DATABASE_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(DATABASE_PATH);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export SQLite connection for services that need direct access
export function getSQLiteConnection() {
  return sqlite;
}

// Database initialization function - uses proper migrations
export async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database...');
    
    const migrationService = new MigrationService();
    
    // Check if migrations are needed
    const migrationStatus = await migrationService.getMigrationStatus();
    console.log(`📊 Migration status: ${migrationStatus.appliedMigrations}/${migrationStatus.totalMigrations} applied`);
    
    if (migrationStatus.needsMigration) {
      console.log('🔄 Running database migrations...');
      await migrationService.runMigrations();
    } else {
      console.log('✅ Database is already up to date');
    }
    
    // Create performance indexes
    await migrationService.createPerformanceIndexes();
    
    // Verify database integrity
    const isValid = await migrationService.verifyDatabaseIntegrity();
    if (!isValid) {
      throw new Error('Database integrity verification failed');
    }
    
    console.log('✅ Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Database connection health check
export function checkDatabaseConnection(): boolean {
  try {
    // Simple query to test connection
    sqlite.prepare('SELECT 1').get();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export function closeDatabaseConnection() {
  try {
    sqlite.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Handle process termination
process.on('SIGINT', closeDatabaseConnection);
process.on('SIGTERM', closeDatabaseConnection);