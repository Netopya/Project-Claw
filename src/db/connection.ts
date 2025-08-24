import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/anime.db';

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

// Database initialization function - creates fresh schema
export async function initializeDatabase() {
  try {
    console.log('Initializing database with new schema...');
    
    // Drop existing tables if they exist (fresh start as per requirements)
    console.log('Dropping existing tables...');
    sqlite.exec(`DROP TABLE IF EXISTS timeline_cache`);
    sqlite.exec(`DROP TABLE IF EXISTS anime_relationships`);
    sqlite.exec(`DROP TABLE IF EXISTS user_watchlist`);
    sqlite.exec(`DROP TABLE IF EXISTS anime`); // Legacy table
    sqlite.exec(`DROP TABLE IF EXISTS anime_info`);
    
    console.log('Creating new database schema...');
    
    // Create anime_info table
    sqlite.exec(`
      CREATE TABLE anime_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        mal_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        title_english TEXT,
        title_japanese TEXT,
        image_url TEXT,
        rating REAL,
        premiere_date TEXT,
        num_episodes INTEGER,
        episode_duration INTEGER,
        anime_type TEXT NOT NULL DEFAULT 'unknown',
        status TEXT,
        source TEXT,
        studios TEXT,
        genres TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_watchlist table
    sqlite.exec(`
      CREATE TABLE user_watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        anime_info_id INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        watch_status TEXT NOT NULL DEFAULT 'plan_to_watch',
        user_rating REAL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (anime_info_id) REFERENCES anime_info(id)
      )
    `);
    
    // Create anime_relationships table
    sqlite.exec(`
      CREATE TABLE anime_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        source_mal_id INTEGER NOT NULL,
        target_mal_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_mal_id) REFERENCES anime_info(mal_id),
        FOREIGN KEY (target_mal_id) REFERENCES anime_info(mal_id),
        UNIQUE(source_mal_id, target_mal_id, relationship_type)
      )
    `);
    
    // Create timeline_cache table
    sqlite.exec(`
      CREATE TABLE timeline_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        root_mal_id INTEGER NOT NULL UNIQUE,
        timeline_data TEXT NOT NULL,
        cache_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Creating database indexes for optimal performance...');
    
    // Indexes for anime_info table
    sqlite.exec('CREATE UNIQUE INDEX idx_anime_info_mal_id ON anime_info(mal_id)');
    
    // Indexes for user_watchlist table
    sqlite.exec('CREATE INDEX idx_user_watchlist_anime_info_id ON user_watchlist(anime_info_id)');
    sqlite.exec('CREATE INDEX idx_user_watchlist_priority ON user_watchlist(priority)');
    
    // Indexes for anime_relationships table (critical for graph traversal performance)
    sqlite.exec('CREATE INDEX idx_anime_relationships_source ON anime_relationships(source_mal_id)');
    sqlite.exec('CREATE INDEX idx_anime_relationships_target ON anime_relationships(target_mal_id)');
    sqlite.exec('CREATE INDEX idx_anime_relationships_type ON anime_relationships(relationship_type)');
    
    // Indexes for timeline_cache table
    sqlite.exec('CREATE UNIQUE INDEX idx_timeline_cache_root ON timeline_cache(root_mal_id)');
    
    console.log('Database schema created successfully with all tables and indexes');
    console.log('Tables created: anime_info, user_watchlist, anime_relationships, timeline_cache');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
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