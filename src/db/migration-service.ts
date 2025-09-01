import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getSQLiteConnection, db } from './connection.js';
import { existsSync } from 'fs';
import { join } from 'path';

export class MigrationService {
  private readonly sqlite = getSQLiteConnection();
  private readonly migrationsPath = './src/db/migrations';

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('🔄 Running database migrations...');
      
      // Check if migrations directory exists
      if (!existsSync(this.migrationsPath)) {
        throw new Error(`Migrations directory not found: ${this.migrationsPath}`);
      }

      // Run migrations using Drizzle's migrate function
      await migrate(db, { migrationsFolder: this.migrationsPath });
      
      console.log('✅ Database migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Check if database needs migration
   */
  async needsMigration(): Promise<boolean> {
    try {
      // Check if the __drizzle_migrations table exists
      const result = this.sqlite.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='__drizzle_migrations'
      `).get();

      if (!result) {
        console.log('📋 Database is new - migrations needed');
        return true;
      }

      // Check if there are pending migrations
      const appliedMigrations = this.sqlite.prepare(`
        SELECT hash FROM __drizzle_migrations ORDER BY id
      `).all() as { hash: string }[];

      // Read migration journal to see what migrations should exist
      const journalPath = join(this.migrationsPath, 'meta/_journal.json');
      if (!existsSync(journalPath)) {
        console.log('📋 No migration journal found');
        return false;
      }

      const fs = await import('fs');
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      const expectedMigrations = journal.entries || [];

      if (appliedMigrations.length < expectedMigrations.length) {
        console.log(`📋 Pending migrations: ${expectedMigrations.length - appliedMigrations.length}`);
        return true;
      }

      console.log('✅ Database is up to date');
      return false;
    } catch (error) {
      console.error('Error checking migration status:', error);
      // If we can't determine, assume migration is needed for safety
      return true;
    }
  }

  /**
   * Get migration status information
   */
  async getMigrationStatus(): Promise<{
    needsMigration: boolean;
    appliedMigrations: number;
    totalMigrations: number;
    lastMigration?: string;
  }> {
    try {
      const needsMigration = await this.needsMigration();
      
      // Get applied migrations count
      let appliedMigrations = 0;
      let lastMigration: string | undefined;
      
      try {
        const migrations = this.sqlite.prepare(`
          SELECT hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 1
        `).all() as { hash: string; created_at: number }[];
        
        appliedMigrations = (this.sqlite.prepare(`
          SELECT COUNT(*) as count FROM __drizzle_migrations
        `).get() as { count: number } | undefined)?.count || 0;
        
        if (migrations.length > 0) {
          lastMigration = new Date(migrations[0].created_at).toISOString();
        }
      } catch {
        // Table doesn't exist yet
      }

      // Get total migrations from journal
      let totalMigrations = 0;
      try {
        const journalPath = join(this.migrationsPath, 'meta/_journal.json');
        if (existsSync(journalPath)) {
          const fs = await import('fs');
          const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
          totalMigrations = (journal.entries || []).length;
        }
      } catch {
        // Journal doesn't exist or is invalid
      }

      return {
        needsMigration,
        appliedMigrations,
        totalMigrations,
        lastMigration
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        needsMigration: true,
        appliedMigrations: 0,
        totalMigrations: 0
      };
    }
  }

  /**
   * Create additional indexes that aren't part of the schema
   * These are performance optimizations that can be added after initial migration
   */
  async createPerformanceIndexes(): Promise<void> {
    try {
      console.log('🔧 Creating performance indexes...');
      
      const indexes = [
        // User watchlist indexes for sorting and filtering
        'CREATE INDEX IF NOT EXISTS idx_user_watchlist_priority ON user_watchlist(priority)',
        'CREATE INDEX IF NOT EXISTS idx_user_watchlist_watch_status ON user_watchlist(watch_status)',
        'CREATE INDEX IF NOT EXISTS idx_user_watchlist_created_at ON user_watchlist(created_at)',
        
        // Anime relationships indexes for graph traversal
        'CREATE INDEX IF NOT EXISTS idx_anime_relationships_source ON anime_relationships(source_mal_id)',
        'CREATE INDEX IF NOT EXISTS idx_anime_relationships_target ON anime_relationships(target_mal_id)',
        'CREATE INDEX IF NOT EXISTS idx_anime_relationships_type ON anime_relationships(relationship_type)',
        'CREATE INDEX IF NOT EXISTS idx_anime_relationships_source_type ON anime_relationships(source_mal_id, relationship_type)',
        
        // Anime info indexes for search and filtering
        'CREATE INDEX IF NOT EXISTS idx_anime_info_title ON anime_info(title)',
        'CREATE INDEX IF NOT EXISTS idx_anime_info_type ON anime_info(anime_type)',
        'CREATE INDEX IF NOT EXISTS idx_anime_info_status ON anime_info(status)',
        'CREATE INDEX IF NOT EXISTS idx_anime_info_rating ON anime_info(rating)',
        
        // Timeline cache indexes
        'CREATE INDEX IF NOT EXISTS idx_timeline_cache_version ON timeline_cache(cache_version)',
        'CREATE INDEX IF NOT EXISTS idx_timeline_cache_updated ON timeline_cache(updated_at)'
      ];

      for (const indexSql of indexes) {
        this.sqlite.exec(indexSql);
      }
      
      console.log(`✅ Created ${indexes.length} performance indexes`);
    } catch (error) {
      console.error('❌ Failed to create performance indexes:', error);
      // Don't throw - indexes are optional optimizations
    }
  }

  /**
   * Verify database integrity after migration
   */
  async verifyDatabaseIntegrity(): Promise<boolean> {
    try {
      console.log('🔍 Verifying database integrity...');
      
      // Check that all expected tables exist
      const expectedTables = ['anime_info', 'user_watchlist', 'anime_relationships', 'timeline_cache'];
      const existingTables = this.sqlite.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'
      `).all() as { name: string }[];
      
      const existingTableNames = existingTables.map(t => t.name);
      const missingTables = expectedTables.filter(table => !existingTableNames.includes(table));
      
      if (missingTables.length > 0) {
        console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
        return false;
      }
      
      // Run PRAGMA integrity_check
      const integrityResult = this.sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      if (integrityResult.integrity_check !== 'ok') {
        console.error(`❌ Database integrity check failed: ${integrityResult.integrity_check}`);
        return false;
      }
      
      // Test basic operations on each table
      for (const table of expectedTables) {
        try {
          this.sqlite.prepare(`SELECT COUNT(*) FROM ${table}`).get();
        } catch (error) {
          console.error(`❌ Failed to query table ${table}:`, error);
          return false;
        }
      }
      
      console.log('✅ Database integrity verified');
      return true;
    } catch (error) {
      console.error('❌ Database integrity verification failed:', error);
      return false;
    }
  }
}