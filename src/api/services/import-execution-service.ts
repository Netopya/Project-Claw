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
  private readonly BATCH_SIZE = 500; // Smaller batch size for imports to avoid memory issues
  private readonly LARGE_DATASET_THRESHOLD = 2000; // Use batch processing for datasets larger than this

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
          exportData,
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
   * Import anime info records with batch processing optimization
   */
  private importAnimeInfo(
    records: ExportData['data']['animeInfo'], 
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    console.log(`Importing ${records.length} anime info records...`);

    // Use batch processing for large datasets
    if (records.length > this.LARGE_DATASET_THRESHOLD) {
      return this.importAnimeInfoBatch(records, options, errors, warnings);
    }

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
   * Import anime info records in batches for better performance
   */
  private importAnimeInfoBatch(
    records: ExportData['data']['animeInfo'], 
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    console.log(`Using batch processing for ${records.length} anime info records...`);

    let processedCount = 0;
    
    // Prepare batch insert statement
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

    // Get existing MAL IDs in batches to optimize lookups
    const existingMalIds = new Set<number>();
    if (options.mode === 'merge') {
      const existing = this.sqlite.prepare('SELECT mal_id FROM anime_info').all() as { mal_id: number }[];
      existing.forEach(row => existingMalIds.add(row.mal_id));
    }

    // Process records in batches
    for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
      const batch = records.slice(i, i + this.BATCH_SIZE);
      const batchTransaction = this.sqlite.transaction(() => {
        let batchProcessed = 0;

        for (const record of batch) {
          try {
            const exists = existingMalIds.has(record.malId);
            
            if (exists && options.mode === 'merge') {
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
                batchProcessed++;
              }
            } else if (!exists) {
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
              existingMalIds.add(record.malId); // Update our cache
              batchProcessed++;
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

        return batchProcessed;
      });

      try {
        const batchResult = batchTransaction();
        processedCount += batchResult;
        console.log(`Processed anime info batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batchResult} records (${processedCount}/${records.length} total)`);
      } catch (error) {
        console.error(`Error processing anime info batch ${Math.floor(i / this.BATCH_SIZE) + 1}:`, error);
        errors.push({
          code: 'BATCH_PROCESSING_ERROR',
          message: `Failed to process anime info batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'animeInfo',
          details: { batchStart: i, batchSize: batch.length }
        });
      }
    }

    console.log(`Completed batch import of anime info: ${processedCount} records processed`);
    return processedCount;
  }

  /**
   * Import user watchlist records with batch processing optimization
   */
  private importUserWatchlist(
    records: ExportData['data']['userWatchlist'],
    exportData: ExportData,
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    console.log(`Importing ${records.length} user watchlist records...`);
    console.log('Watchlist records to import:', records.map(r => ({ id: r.id, animeInfoId: r.animeInfoId })));

    // Use batch processing for large datasets
    if (records.length > this.LARGE_DATASET_THRESHOLD) {
      return this.importUserWatchlistBatch(records, exportData, options, errors, warnings);
    }

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
        
        // In both merge and replace modes, we need to find the actual anime_info_id from the current database
        // because the anime_info table gets new auto-incremented IDs
        if (options.mode === 'merge' || options.mode === 'replace') {
          // The exported animeInfoId is the old database's internal ID
          // We need to find the corresponding anime in the current database
          // Since we don't have the MAL ID directly, we need to look it up from the exported anime data
          
          // Find the corresponding anime info record from the export data
          const exportedAnimeInfo = exportData.data.animeInfo.find(anime => anime.id === record.animeInfoId);
          console.log(`Processing watchlist record ${record.id}: animeInfoId=${record.animeInfoId}, found exported anime:`, exportedAnimeInfo ? `MAL ID ${exportedAnimeInfo.malId}` : 'NOT FOUND');
          if (exportedAnimeInfo) {
            // Now find the anime in the current database by MAL ID
            const animeInfoRecord = getAnimeInfoIdStmt.get(exportedAnimeInfo.malId);
            console.log(`MAL ID ${exportedAnimeInfo.malId} maps to current DB record:`, animeInfoRecord);
            if (animeInfoRecord) {
              actualAnimeInfoId = (animeInfoRecord as any).id;
            } else {
              console.error(`FOREIGN_KEY_VIOLATION: Referenced anime with MAL ID ${exportedAnimeInfo.malId} not found in current database`);
              errors.push({
                code: 'FOREIGN_KEY_VIOLATION',
                message: `Referenced anime with MAL ID ${exportedAnimeInfo.malId} not found in current database`,
                table: 'userWatchlist',
                recordId: record.id,
                details: { animeInfoId: record.animeInfoId, malId: exportedAnimeInfo.malId }
              });
              continue;
            }
          } else {
            console.error(`FOREIGN_KEY_VIOLATION: Referenced anime_info_id ${record.animeInfoId} not found in export data`);
            errors.push({
              code: 'FOREIGN_KEY_VIOLATION',
              message: `Referenced anime_info_id ${record.animeInfoId} not found in export data`,
              table: 'userWatchlist',
              recordId: record.id,
              details: { animeInfoId: record.animeInfoId }
            });
            continue;
          }
        }

        if (options.mode === 'replace') {
          // In replace mode, just insert all records since we cleared the table
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
        } else {
          // Merge mode - check for existing entries
          const existing = checkExistingStmt.get(actualAnimeInfoId);
          
          if (existing) {
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
          } else {
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
   * Import user watchlist records in batches for better performance
   */
  private importUserWatchlistBatch(
    records: ExportData['data']['userWatchlist'],
    exportData: ExportData,
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    console.log(`Using batch processing for ${records.length} user watchlist records...`);
    console.log('Watchlist records to import:', records.map(r => ({ id: r.id, animeInfoId: r.animeInfoId })));

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

    // Build anime_info_id mapping for efficient lookups
    const animeInfoMapping = new Map<number, number>(); // MAL ID -> current database ID
    const existingWatchlist = new Set<number>();
    
    // Get all anime info mappings (MAL ID -> current database ID) for both merge and replace modes
    const animeInfoRecords = this.sqlite.prepare('SELECT id, mal_id FROM anime_info').all() as { id: number, mal_id: number }[];
    animeInfoRecords.forEach(row => animeInfoMapping.set(row.mal_id, row.id));
    
    if (options.mode === 'merge') {
      // Get existing watchlist entries only for merge mode
      const existingEntries = this.sqlite.prepare('SELECT anime_info_id FROM user_watchlist').all() as { anime_info_id: number }[];
      existingEntries.forEach(row => existingWatchlist.add(row.anime_info_id));
    }

    // Build export data mapping for efficient lookups (old anime_info_id -> MAL ID)
    const exportAnimeMapping = new Map<number, number>();
    exportData.data.animeInfo.forEach(anime => {
      exportAnimeMapping.set(anime.id, anime.malId);
    });

    // Process records in batches
    for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
      const batch = records.slice(i, i + this.BATCH_SIZE);
      const batchTransaction = this.sqlite.transaction(() => {
        let batchProcessed = 0;

        for (const record of batch) {
          try {
            let actualAnimeInfoId = record.animeInfoId;
            
            // Map to current database ID (needed for both merge and replace modes)
            if (options.mode === 'merge' || options.mode === 'replace') {
              // First, find the MAL ID from the export data
              const malId = exportAnimeMapping.get(record.animeInfoId);
              console.log(`Processing watchlist record ${record.id}: animeInfoId=${record.animeInfoId}, malId=${malId}`);
              if (malId) {
                // Then find the current database ID using the MAL ID
                const currentDbId = animeInfoMapping.get(malId);
                console.log(`MAL ID ${malId} maps to current DB ID: ${currentDbId}`);
                if (currentDbId) {
                  actualAnimeInfoId = currentDbId;
                } else {
                  console.error(`FOREIGN_KEY_VIOLATION: Referenced anime with MAL ID ${malId} not found in current database`);
                  errors.push({
                    code: 'FOREIGN_KEY_VIOLATION',
                    message: `Referenced anime with MAL ID ${malId} not found in current database`,
                    table: 'userWatchlist',
                    recordId: record.id,
                    details: { animeInfoId: record.animeInfoId, malId }
                  });
                  continue;
                }
              } else {
                console.error(`FOREIGN_KEY_VIOLATION: Referenced anime_info_id ${record.animeInfoId} not found in export data`);
                errors.push({
                  code: 'FOREIGN_KEY_VIOLATION',
                  message: `Referenced anime_info_id ${record.animeInfoId} not found in export data`,
                  table: 'userWatchlist',
                  recordId: record.id,
                  details: { animeInfoId: record.animeInfoId }
                });
                continue;
              }
            }

            if (options.mode === 'replace') {
              // In replace mode, just insert all records since we cleared the table
              insertStmt.run(
                actualAnimeInfoId,
                record.priority,
                record.watchStatus,
                record.userRating,
                record.notes,
                record.createdAt || new Date().toISOString(),
                record.updatedAt || new Date().toISOString()
              );
              batchProcessed++;
            } else {
              // Merge mode - check for existing entries
              const exists = existingWatchlist.has(actualAnimeInfoId);
              
              if (exists) {
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
                  batchProcessed++;
                }
              } else {
                insertStmt.run(
                  actualAnimeInfoId,
                  record.priority,
                  record.watchStatus,
                  record.userRating,
                  record.notes,
                  record.createdAt || new Date().toISOString(),
                  record.updatedAt || new Date().toISOString()
                );
                existingWatchlist.add(actualAnimeInfoId); // Update our cache
                batchProcessed++;
              }
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

        return batchProcessed;
      });

      try {
        const batchResult = batchTransaction();
        processedCount += batchResult;
        console.log(`Processed watchlist batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batchResult} records (${processedCount}/${records.length} total)`);
      } catch (error) {
        console.error(`Error processing watchlist batch ${Math.floor(i / this.BATCH_SIZE) + 1}:`, error);
        errors.push({
          code: 'BATCH_PROCESSING_ERROR',
          message: `Failed to process watchlist batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'userWatchlist',
          details: { batchStart: i, batchSize: batch.length }
        });
      }
    }

    console.log(`Completed batch import of user watchlist: ${processedCount} records processed`);
    return processedCount;
  }

  /**
   * Import anime relationships records with batch processing optimization
   */
  private importAnimeRelationships(
    records: ExportData['data']['animeRelationships'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    console.log(`Importing ${records.length} anime relationship records...`);

    // Use batch processing for large datasets
    if (records.length > this.LARGE_DATASET_THRESHOLD) {
      return this.importAnimeRelationshipsBatch(records, options, errors, warnings);
    }

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
   * Import anime relationships records in batches for better performance
   */
  private importAnimeRelationshipsBatch(
    records: ExportData['data']['animeRelationships'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    console.log(`Using batch processing for ${records.length} anime relationship records...`);

    let processedCount = 0;
    
    const insertStmt = this.sqlite.prepare(`
      INSERT OR IGNORE INTO anime_relationships (
        source_mal_id, target_mal_id, relationship_type, created_at
      ) VALUES (?, ?, ?, ?)
    `);

    // Build validation sets for efficient lookups
    const validMalIds = new Set<number>();
    const existingRelationships = new Set<string>();
    
    if (options.validateRelationships || options.mode === 'merge') {
      // Get all valid MAL IDs
      const malIdRecords = this.sqlite.prepare('SELECT mal_id FROM anime_info').all() as { mal_id: number }[];
      malIdRecords.forEach(row => validMalIds.add(row.mal_id));
      
      // Get existing relationships
      if (options.mode === 'merge') {
        const existingRecords = this.sqlite.prepare(`
          SELECT source_mal_id, target_mal_id, relationship_type 
          FROM anime_relationships
        `).all() as { source_mal_id: number, target_mal_id: number, relationship_type: string }[];
        
        existingRecords.forEach(row => {
          const key = `${row.source_mal_id}-${row.target_mal_id}-${row.relationship_type}`;
          existingRelationships.add(key);
        });
      }
    }

    // Process records in batches
    for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
      const batch = records.slice(i, i + this.BATCH_SIZE);
      const batchTransaction = this.sqlite.transaction(() => {
        let batchProcessed = 0;

        for (const record of batch) {
          try {
            // Validate foreign key references
            if (options.validateRelationships) {
              if (!validMalIds.has(record.sourceMalId)) {
                errors.push({
                  code: 'FOREIGN_KEY_VIOLATION',
                  message: `Source MAL ID ${record.sourceMalId} not found in anime_info`,
                  table: 'animeRelationships',
                  recordId: record.id,
                  details: { sourceMalId: record.sourceMalId }
                });
                continue;
              }
              
              if (!validMalIds.has(record.targetMalId)) {
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

            const relationshipKey = `${record.sourceMalId}-${record.targetMalId}-${record.relationshipType}`;
            const exists = existingRelationships.has(relationshipKey);
            
            if (exists && options.mode === 'merge') {
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
            } else if (!exists) {
              const result = insertStmt.run(
                record.sourceMalId,
                record.targetMalId,
                record.relationshipType,
                record.createdAt || new Date().toISOString()
              );
              
              if (result.changes > 0) {
                existingRelationships.add(relationshipKey); // Update our cache
                batchProcessed++;
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

        return batchProcessed;
      });

      try {
        const batchResult = batchTransaction();
        processedCount += batchResult;
        console.log(`Processed relationships batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batchResult} records (${processedCount}/${records.length} total)`);
      } catch (error) {
        console.error(`Error processing relationships batch ${Math.floor(i / this.BATCH_SIZE) + 1}:`, error);
        errors.push({
          code: 'BATCH_PROCESSING_ERROR',
          message: `Failed to process relationships batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'animeRelationships',
          details: { batchStart: i, batchSize: batch.length }
        });
      }
    }

    console.log(`Completed batch import of anime relationships: ${processedCount} records processed`);
    return processedCount;
  }

  /**
   * Import timeline cache records with batch processing optimization
   */
  private importTimelineCache(
    records: ExportData['data']['timelineCache'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    if (records.length === 0) return 0;

    console.log(`Importing ${records.length} timeline cache records...`);

    // Use batch processing for large datasets
    if (records.length > this.LARGE_DATASET_THRESHOLD) {
      return this.importTimelineCacheBatch(records, options, errors, warnings);
    }

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
   * Import timeline cache records in batches for better performance
   */
  private importTimelineCacheBatch(
    records: ExportData['data']['timelineCache'],
    options: ImportOptions,
    errors: ImportError[],
    warnings: ImportWarning[]
  ): number {
    console.log(`Using batch processing for ${records.length} timeline cache records...`);

    let processedCount = 0;
    
    const insertStmt = this.sqlite.prepare(`
      INSERT OR REPLACE INTO timeline_cache (
        root_mal_id, timeline_data, cache_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    // Build validation set for efficient lookups
    const validMalIds = new Set<number>();
    
    if (options.validateRelationships) {
      const malIdRecords = this.sqlite.prepare('SELECT mal_id FROM anime_info').all() as { mal_id: number }[];
      malIdRecords.forEach(row => validMalIds.add(row.mal_id));
    }

    // Process records in batches
    for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
      const batch = records.slice(i, i + this.BATCH_SIZE);
      const batchTransaction = this.sqlite.transaction(() => {
        let batchProcessed = 0;

        for (const record of batch) {
          try {
            // Validate that the root MAL ID exists
            if (options.validateRelationships && !validMalIds.has(record.rootMalId)) {
              warnings.push({
                code: 'MISSING_REFERENCE',
                message: `Timeline cache references non-existent MAL ID ${record.rootMalId}`,
                table: 'timelineCache',
                recordId: record.id,
                details: { rootMalId: record.rootMalId }
              });
              // Continue anyway as cache can be rebuilt
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
              batchProcessed++;
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

        return batchProcessed;
      });

      try {
        const batchResult = batchTransaction();
        processedCount += batchResult;
        console.log(`Processed timeline cache batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batchResult} records (${processedCount}/${records.length} total)`);
      } catch (error) {
        console.error(`Error processing timeline cache batch ${Math.floor(i / this.BATCH_SIZE) + 1}:`, error);
        errors.push({
          code: 'BATCH_PROCESSING_ERROR',
          message: `Failed to process timeline cache batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          table: 'timelineCache',
          details: { batchStart: i, batchSize: batch.length }
        });
      }
    }

    console.log(`Completed batch import of timeline cache: ${processedCount} records processed`);
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