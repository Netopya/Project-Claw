import { db, getSQLiteConnection } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { 
  ExportData, 
  ImportOptions, 
  ImportResult, 
  ImportError, 
  ImportWarning 
} from '../../types/export-import.js';

export class ImportExecutionService {
  private readonly sqlite = getSQLiteConnection();

  /**
   * Execute import operation with transaction management
   */
  async executeImport(exportData: ExportData, options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      recordsProcessed: {
        animeInfo: 0,
        userWatchlist: 0,
        animeRelationships: 0,
        timelineCache: 0
      },
      errors: [],
      warnings: []
    };

    // Start transaction
    const transaction = this.sqlite.transaction(() => {
      try {
        // Handle replace mode - clear existing data
        if (options.mode === 'replace') {
          this.clearExistingData();
        }

        // Import data in dependency order
        result.recordsProcessed.animeInfo = this.importAnimeInfo(
          exportData.data.animeInfo, 
          options, 
          result.errors, 
          result.warnings
        );

        result.recordsProcessed.userWatchlist = this.importUserWatchlist(
          exportData.data.userWatchlist, 
          options, 
          result.errors, 
          result.warnings
        );

        result.recordsProcessed.animeRelationships = this.importAnimeRelationships(
          exportData.data.animeRelationships, 
          options, 
          result.errors, 
          result.warnings
        );

        result.recordsProcessed.timelineCache = this.importTimelineCache(
          exportData.data.timelineCache, 
          options, 
          result.errors, 
          result.warnings
        );

        // Clear cache if requested
        if (options.clearCache) {
          this.clearTimelineCache();
          result.warnings.push({
            code: 'CACHE_CLEARED',
            message: 'Timeline cache was cleared as requested'
          });
        }

        // Check if there were any critical errors that should cause rollback
        const criticalErrors = result.errors.filter(error => 
          ['DUPLICATE_KEY_ERROR', 'DATA_INTEGRITY_ERROR', 'TRANSACTION_ERROR'].includes(error.code)
        );

        if (criticalErrors.length > 0) {
          throw new Error(`Import failed with ${criticalErrors.length} critical errors`);
        }

        result.success = true;
        return result;

      } catch (error) {
        // Add the error to results for detailed reporting
        result.errors.push({
          code: 'IMPORT_EXECUTION_ERROR',
          message: `Import execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        throw error; // Re-throw to trigger rollback
      }
    });

    try {
      // Execute the transaction
      return transaction();
    } catch (error) {
      console.error('Import transaction failed, rolling back:', error);
      result.success = false;
      
      // Add rollback information
      result.errors.push({
        code: 'TRANSACTION_ROLLBACK',
        message: 'Import failed and all changes were rolled back',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' }
      });

      return result;
    }
  }

  /**
   * Clear all existing data for replace mode
   */
  private clearExistingData(): void {
    try {
      // Delete in reverse dependency order to avoid foreign key violations
      this.sqlite.prepare('DELETE FROM timeline_cache').run();
      this.sqlite.prepare('DELETE FROM anime_relationships').run();
      this.sqlite.prepare('DELETE FROM user_watchlist').run();
      this.sqlite.prepare('DELETE FROM anime_info').run();
      
      // Reset auto-increment counters
      this.sqlite.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?, ?)')
        .run('anime_info', 'user_watchlist', 'anime_relationships', 'timeline_cache');
        
    } catch (error) {
      throw new Error(`Failed to clear existing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import anime info records
   */
  private importAnimeInfo(
    records: ExportData['data']['animeInfo'], 
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    let processedCount = 0;
    const insertStmt = this.sqlite.prepare(`
      INSERT INTO anime_info (
        mal_id, title, title_english, title_japanese, image_url, rating,
        premiere_date, num_episodes, episode_duration, anime_type, status,
        source, studios, genres, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.sqlite.prepare(`
      UPDATE anime_info SET
        title = ?, title_english = ?, title_japanese = ?, image_url = ?, rating = ?,
        premiere_date = ?, num_episodes = ?, episode_duration = ?, anime_type = ?,
        status = ?, source = ?, studios = ?, genres = ?, updated_at = ?
      WHERE mal_id = ?
    `);

    const checkExistingStmt = this.sqlite.prepare('SELECT id FROM anime_info WHERE mal_id = ?');

    for (const record of records) {
      try {
        const existing = checkExistingStmt.get(record.malId);
        
        if (existing && options.mode === 'merge') {
          // Handle duplicate based on options
          if (options.handleDuplicates === 'skip') {
            warnings.push({
              code: 'DUPLICATE_SKIPPED',
              message: `Skipped duplicate anime with MAL ID ${record.malId}`,
              table: 'animeInfo',
              recordId: record.id,
              details: { malId: record.malId }
            });
            continue;
          } else if (options.handleDuplicates === 'update') {
            // Update existing record
            updateStmt.run(
              record.title,
              record.titleEnglish,
              record.titleJapanese,
              record.imageUrl,
              record.rating,
              record.premiereDate,
              record.numEpisodes,
              record.episodeDuration,
              record.animeType,
              record.status,
              record.source,
              record.studios,
              record.genres,
              new Date().toISOString(),
              record.malId
            );
            
            warnings.push({
              code: 'DUPLICATE_UPDATED',
              message: `Updated existing anime with MAL ID ${record.malId}`,
              table: 'animeInfo',
              recordId: record.id,
              details: { malId: record.malId }
            });
            processedCount++;
          }
        } else if (!existing) {
          // Insert new record
          insertStmt.run(
            record.malId,
            record.title,
            record.titleEnglish,
            record.titleJapanese,
            record.imageUrl,
            record.rating,
            record.premiereDate,
            record.numEpisodes,
            record.episodeDuration,
            record.animeType,
            record.status,
            record.source,
            record.studios,
            record.genres,
            record.createdAt || new Date().toISOString(),
            record.updatedAt || new Date().toISOString()
          );
          processedCount++;
        }
      } catch (error) {
        errors.push({
          code: 'ANIME_INFO_INSERT_ERROR',
          message: `Failed to import anime info record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'animeInfo',
          recordId: record.id,
          details: { malId: record.malId, title: record.title }
        });
      }
    }

    return processedCount;
  }

  /**
   * Import user watchlist records
   */
  private importUserWatchlist(
    records: ExportData['data']['userWatchlist'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    let processedCount = 0;
    const insertStmt = this.sqlite.prepare(`
      INSERT INTO user_watchlist (
        anime_info_id, priority, watch_status, user_rating, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.sqlite.prepare(`
      UPDATE user_watchlist SET
        priority = ?, watch_status = ?, user_rating = ?, notes = ?, updated_at = ?
      WHERE anime_info_id = ?
    `);

    const checkExistingStmt = this.sqlite.prepare('SELECT id FROM user_watchlist WHERE anime_info_id = ?');
    const getAnimeInfoIdStmt = this.sqlite.prepare('SELECT id FROM anime_info WHERE mal_id = ?');

    for (const record of records) {
      try {
        // Map animeInfoId to current database ID if needed
        let actualAnimeInfoId = record.animeInfoId;
        
        // In merge mode, we need to find the actual anime_info_id from the current database
        if (options.mode === 'merge') {
          // This is a simplified approach - in practice, you might need a mapping table
          // For now, we'll assume the animeInfoId corresponds to the anime with the same position
          // A more robust approach would maintain a mapping of old IDs to new IDs
          const animeInfoRecord = getAnimeInfoIdStmt.get(record.animeInfoId);
          if (animeInfoRecord) {
            actualAnimeInfoId = (animeInfoRecord as any).id;
          } else {
            errors.push({
              code: 'FOREIGN_KEY_VIOLATION',
              message: `Referenced anime_info_id ${record.animeInfoId} not found`,
              table: 'userWatchlist',
              recordId: record.id,
              details: { animeInfoId: record.animeInfoId }
            });
            continue;
          }
        }

        const existing = checkExistingStmt.get(actualAnimeInfoId);
        
        if (existing && options.mode === 'merge') {
          if (options.handleDuplicates === 'skip') {
            warnings.push({
              code: 'DUPLICATE_SKIPPED',
              message: `Skipped duplicate watchlist entry for anime_info_id ${actualAnimeInfoId}`,
              table: 'userWatchlist',
              recordId: record.id,
              details: { animeInfoId: actualAnimeInfoId }
            });
            continue;
          } else if (options.handleDuplicates === 'update') {
            updateStmt.run(
              record.priority,
              record.watchStatus,
              record.userRating,
              record.notes,
              new Date().toISOString(),
              actualAnimeInfoId
            );
            
            warnings.push({
              code: 'DUPLICATE_UPDATED',
              message: `Updated existing watchlist entry for anime_info_id ${actualAnimeInfoId}`,
              table: 'userWatchlist',
              recordId: record.id,
              details: { animeInfoId: actualAnimeInfoId }
            });
            processedCount++;
          }
        } else if (!existing) {
          insertStmt.run(
            actualAnimeInfoId,
            record.priority,
            record.watchStatus,
            record.userRating,
            record.notes,
            record.createdAt || new Date().toISOString(),
            record.updatedAt || new Date().toISOString()
          );
          processedCount++;
        }
      } catch (error) {
        errors.push({
          code: 'WATCHLIST_INSERT_ERROR',
          message: `Failed to import watchlist record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'userWatchlist',
          recordId: record.id,
          details: { animeInfoId: record.animeInfoId }
        });
      }
    }

    return processedCount;
  }

  /**
   * Import anime relationships records
   */
  private importAnimeRelationships(
    records: ExportData['data']['animeRelationships'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    let processedCount = 0;
    const insertStmt = this.sqlite.prepare(`
      INSERT OR IGNORE INTO anime_relationships (
        source_mal_id, target_mal_id, relationship_type, created_at
      ) VALUES (?, ?, ?, ?)
    `);

    const checkExistingStmt = this.sqlite.prepare(`
      SELECT id FROM anime_relationships 
      WHERE source_mal_id = ? AND target_mal_id = ? AND relationship_type = ?
    `);

    const validateMalIdStmt = this.sqlite.prepare('SELECT mal_id FROM anime_info WHERE mal_id = ?');

    for (const record of records) {
      try {
        // Validate foreign key references
        if (options.validateRelationships) {
          const sourceExists = validateMalIdStmt.get(record.sourceMalId);
          const targetExists = validateMalIdStmt.get(record.targetMalId);
          
          if (!sourceExists) {
            errors.push({
              code: 'FOREIGN_KEY_VIOLATION',
              message: `Source MAL ID ${record.sourceMalId} not found in anime_info`,
              table: 'animeRelationships',
              recordId: record.id,
              details: { sourceMalId: record.sourceMalId }
            });
            continue;
          }
          
          if (!targetExists) {
            errors.push({
              code: 'FOREIGN_KEY_VIOLATION',
              message: `Target MAL ID ${record.targetMalId} not found in anime_info`,
              table: 'animeRelationships',
              recordId: record.id,
              details: { targetMalId: record.targetMalId }
            });
            continue;
          }
        }

        const existing = checkExistingStmt.get(record.sourceMalId, record.targetMalId, record.relationshipType);
        
        if (existing && options.mode === 'merge') {
          if (options.handleDuplicates === 'skip') {
            warnings.push({
              code: 'DUPLICATE_SKIPPED',
              message: `Skipped duplicate relationship: ${record.sourceMalId} -> ${record.targetMalId} (${record.relationshipType})`,
              table: 'animeRelationships',
              recordId: record.id,
              details: { 
                sourceMalId: record.sourceMalId, 
                targetMalId: record.targetMalId, 
                relationshipType: record.relationshipType 
              }
            });
            continue;
          }
          // Note: We don't update relationships as they are immutable by nature
        } else if (!existing) {
          const result = insertStmt.run(
            record.sourceMalId,
            record.targetMalId,
            record.relationshipType,
            record.createdAt || new Date().toISOString()
          );
          
          if (result.changes > 0) {
            processedCount++;
          }
        }
      } catch (error) {
        errors.push({
          code: 'RELATIONSHIP_INSERT_ERROR',
          message: `Failed to import relationship record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'animeRelationships',
          recordId: record.id,
          details: { 
            sourceMalId: record.sourceMalId, 
            targetMalId: record.targetMalId, 
            relationshipType: record.relationshipType 
          }
        });
      }
    }

    return processedCount;
  }

  /**
   * Import timeline cache records
   */
  private importTimelineCache(
    records: ExportData['data']['timelineCache'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    let processedCount = 0;
    const insertStmt = this.sqlite.prepare(`
      INSERT OR REPLACE INTO timeline_cache (
        root_mal_id, timeline_data, cache_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const validateMalIdStmt = this.sqlite.prepare('SELECT mal_id FROM anime_info WHERE mal_id = ?');

    for (const record of records) {
      try {
        // Validate that the root MAL ID exists
        if (options.validateRelationships) {
          const rootExists = validateMalIdStmt.get(record.rootMalId);
          if (!rootExists) {
            warnings.push({
              code: 'MISSING_REFERENCE',
              message: `Timeline cache references non-existent MAL ID ${record.rootMalId}`,
              table: 'timelineCache',
              recordId: record.id,
              details: { rootMalId: record.rootMalId }
            });
            // Continue anyway as cache can be rebuilt
          }
        }

        // Validate timeline data is valid JSON
        try {
          JSON.parse(record.timelineData);
        } catch {
          errors.push({
            code: 'INVALID_JSON_DATA',
            message: `Timeline cache contains invalid JSON data`,
            table: 'timelineCache',
            recordId: record.id,
            details: { rootMalId: record.rootMalId }
          });
          continue;
        }

        // Insert or replace (cache can always be updated)
        const result = insertStmt.run(
          record.rootMalId,
          record.timelineData,
          record.cacheVersion,
          record.createdAt || new Date().toISOString(),
          record.updatedAt || new Date().toISOString()
        );
        
        if (result.changes > 0) {
          processedCount++;
        }
      } catch (error) {
        errors.push({
          code: 'TIMELINE_CACHE_INSERT_ERROR',
          message: `Failed to import timeline cache record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'timelineCache',
          recordId: record.id,
          details: { rootMalId: record.rootMalId }
        });
      }
    }

    return processedCount;
  }

  /**
   * Clear timeline cache
   */
  private clearTimelineCache(): void {
    try {
      this.sqlite.prepare('DELETE FROM timeline_cache').run();
    } catch (error) {
      throw new Error(`Failed to clear timeline cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a backup before destructive operations
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./data/backup-${timestamp}.db`;
      
      // Use SQLite VACUUM INTO to create a backup
      this.sqlite.prepare(`VACUUM INTO ?`).run(backupPath);
      
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate import data before execution
   */
  validateImportData(exportData: ExportData): ImportError[] {
    const errors: ImportError[] = [];

    try {
      // Check for required data sections
      if (!exportData.data) {
        errors.push({
          code: 'MISSING_DATA_SECTION',
          message: 'Import data is missing required data section'
        });
        return errors;
      }

      // Validate data arrays exist
      const requiredSections = ['animeInfo', 'userWatchlist', 'animeRelationships', 'timelineCache'];
      for (const section of requiredSections) {
        if (!Array.isArray(exportData.data[section as keyof typeof exportData.data])) {
          errors.push({
            code: 'INVALID_DATA_SECTION',
            message: `Data section '${section}' must be an array`,
            details: { section }
          });
        }
      }

      // Validate foreign key relationships within the import data
      const animeInfoIds = new Set(exportData.data.animeInfo.map(anime => anime.id));
      const malIds = new Set(exportData.data.animeInfo.map(anime => anime.malId));

      // Check watchlist references
      for (const entry of exportData.data.userWatchlist) {
        if (!animeInfoIds.has(entry.animeInfoId)) {
          errors.push({
            code: 'INVALID_FOREIGN_KEY',
            message: `Watchlist entry references non-existent anime_info_id ${entry.animeInfoId}`,
            table: 'userWatchlist',
            recordId: entry.id,
            details: { animeInfoId: entry.animeInfoId }
          });
        }
      }

      // Check relationship references
      for (const relationship of exportData.data.animeRelationships) {
        if (!malIds.has(relationship.sourceMalId)) {
          errors.push({
            code: 'INVALID_FOREIGN_KEY',
            message: `Relationship references non-existent source MAL ID ${relationship.sourceMalId}`,
            table: 'animeRelationships',
            recordId: relationship.id,
            details: { sourceMalId: relationship.sourceMalId }
          });
        }
        if (!malIds.has(relationship.targetMalId)) {
          errors.push({
            code: 'INVALID_FOREIGN_KEY',
            message: `Relationship references non-existent target MAL ID ${relationship.targetMalId}`,
            table: 'animeRelationships',
            recordId: relationship.id,
            details: { targetMalId: relationship.targetMalId }
          });
        }
      }

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Import data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return errors;
  }
}