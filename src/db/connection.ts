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

// Database initialization function
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Check if tables already exist
    const tableExists = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='anime'
    `).get();
    
    if (!tableExists) {
      console.log('Creating anime table...');
      
      // Create table
      sqlite.exec(`
        CREATE TABLE anime (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          mal_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          title_english TEXT,
          title_japanese TEXT,
          image_url TEXT,
          rating REAL,
          premiere_date TEXT,
          num_episodes INTEGER,
          series_info TEXT,
          priority INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes
      sqlite.exec('CREATE UNIQUE INDEX anime_mal_id_unique ON anime (mal_id)');
      sqlite.exec('CREATE INDEX idx_anime_priority ON anime (priority)');
      sqlite.exec('CREATE INDEX idx_anime_mal_id ON anime (mal_id)');
      
      console.log('Database tables created successfully');
    } else {
      console.log('Database tables already exist');
    }
    
    console.log('Database initialized successfully');
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