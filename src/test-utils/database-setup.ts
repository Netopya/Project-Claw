import Database from 'better-sqlite3';

export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  
  // Initialize the database schema directly for in-memory database
  initializeTestSchema(db);
  return db;
}

export function setupTestDatabase(): Database.Database {
  return createTestDatabase();
}

function initializeTestSchema(db: Database.Database): void {
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Create anime_info table - comprehensive anime information
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
    CREATE TABLE timeline_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      root_mal_id INTEGER NOT NULL UNIQUE,
      timeline_data TEXT NOT NULL,
      cache_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes for optimal query performance
  db.exec('CREATE UNIQUE INDEX idx_anime_info_mal_id ON anime_info(mal_id)');
  db.exec('CREATE INDEX idx_user_watchlist_anime_info_id ON user_watchlist(anime_info_id)');
  db.exec('CREATE INDEX idx_user_watchlist_priority ON user_watchlist(priority)');
  db.exec('CREATE INDEX idx_anime_relationships_source ON anime_relationships(source_mal_id)');
  db.exec('CREATE INDEX idx_anime_relationships_target ON anime_relationships(target_mal_id)');
  db.exec('CREATE INDEX idx_anime_relationships_type ON anime_relationships(relationship_type)');
  db.exec('CREATE UNIQUE INDEX idx_timeline_cache_root ON timeline_cache(root_mal_id)');
}