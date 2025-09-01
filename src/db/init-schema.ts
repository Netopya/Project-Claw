#!/usr/bin/env node

/**
 * DEPRECATED: Database Schema Initialization Script
 * 
 * This script is deprecated in favor of proper Drizzle migrations.
 * Use the migration system instead:
 * - npm run db:migrate:status (check migration status)
 * - npm run db:migrate:run (run pending migrations)
 * - npm run db:migrate:reset (reset database in development)
 * 
 * This file is kept for reference but should not be used in production.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname as pathDirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/anime.db';

function initializeFreshDatabase() {
  console.log('⚠️  WARNING: This script is deprecated!');
  console.log('� DUse the migration system instead:');
  console.log('   npm run db:migrate:run');
  console.log('   npm run db:migrate:status');
  console.log('');
  console.log('🚀 Starting fresh database initialization...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);

  try {
    // Ensure the data directory exists
    const dbDir = pathDirname(DATABASE_PATH);
    if (!existsSync(dbDir)) {
      console.log(`📂 Creating database directory: ${dbDir}`);
      mkdirSync(dbDir, { recursive: true });
    }

    // Create SQLite connection
    const sqlite = new Database(DATABASE_PATH);

    // Enable WAL mode for better concurrent access
    sqlite.pragma('journal_mode = WAL');

    console.log('🗑️  Dropping existing tables...');

    // Drop existing tables in correct order (respecting foreign key constraints)
    const dropStatements = [
      'DROP TABLE IF EXISTS timeline_cache',
      'DROP TABLE IF EXISTS anime_relationships',
      'DROP TABLE IF EXISTS user_watchlist',
      'DROP TABLE IF EXISTS anime', // Legacy table
      'DROP TABLE IF EXISTS anime_info'
    ];

    dropStatements.forEach(statement => {
      sqlite.exec(statement);
    });

    console.log('🏗️  Creating new database schema...');

    // Create anime_info table - comprehensive anime information
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

    // Create user_watchlist table - user's personal watchlist
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

    // Create anime_relationships table - for graph traversal
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

    // Create timeline_cache table - for performance optimization
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

    console.log('📊 Creating database indexes for optimal query performance...');

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

    // Verify tables were created
    const tables = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    console.log('✅ Database schema created successfully!');
    console.log('📋 Tables created:');
    tables.forEach((table: any) => {
      console.log(`   - ${table.name}`);
    });

    // Verify indexes were created
    const indexes = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    console.log('🔍 Indexes created:');
    indexes.forEach((index: any) => {
      console.log(`   - ${index.name}`);
    });

    sqlite.close();
    console.log('🎉 Database initialization completed successfully!');

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run the initialization if this script is executed directly
// ES module equivalent of require.main === module
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  initializeFreshDatabase();
}

export { initializeFreshDatabase };