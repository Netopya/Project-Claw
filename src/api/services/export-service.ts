import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { ExportData, ExportMetadata } from '../../types/export-import.js';
import { ExportDataSchema } from '../../types/export-validation.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { gt, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ExportService {
  private readonly CURRENT_SCHEMA_VERSION = '1.0.0';
  private readonly APPLICATION_NAME = 'Project Claw';
  private readonly BATCH_SIZE = 1000; // Process records in batches for memory efficiency
  private readonly STREAM_THRESHOLD = 5000; // Use streaming for datasets larger than this

  /**
   * Extract all data from database tables with optimized batch processing
   */
  async extractAllData(): Promise<ExportData['data']> {
    try {
      console.log('Starting optimized data extraction from all database tables...');

      // Get record counts first to determine if we need streaming
      const counts = await this.getTableCounts();
      const totalRecords = counts.animeInfo + counts.userWatchlist + counts.animeRelationships + counts.timelineCache;
      
      console.log(`Total records to extract: ${totalRecords}`);

      // Use batch extraction for large datasets
      if (totalRecords > this.STREAM_THRESHOLD) {
        console.log('Using batch extraction for large dataset...');
        return await this.extractDataInBatches();
      }

      // Extract data from all tables in parallel for better performance
      const [
        animeInfoRecords,
        userWatchlistRecords,
        animeRelationshipsRecords,
        timelineCacheRecords
      ] = await Promise.all([
        db.select().from(animeInfo),
        db.select().from(userWatchlist),
        db.select().from(animeRelationships),
        db.select().from(timelineCache)
      ]);

      console.log(`Extracted data: ${animeInfoRecords.length} anime, ${userWatchlistRecords.length} watchlist entries, ${animeRelationshipsRecords.length} relationships, ${timelineCacheRecords.length} timeline cache entries`);

      return {
        animeInfo: animeInfoRecords,
        userWatchlist: userWatchlistRecords,
        animeRelationships: animeRelationshipsRecords,
        timelineCache: timelineCacheRecords
      };
    } catch (error) {
      console.error('Error extracting data from database:', error);
      throw new Error(`Failed to extract database data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get record counts for all tables
   */
  private async getTableCounts(): Promise<{
    animeInfo: number;
    userWatchlist: number;
    animeRelationships: number;
    timelineCache: number;
  }> {
    const [
      animeInfoCount,
      userWatchlistCount,
      animeRelationshipsCount,
      timelineCacheCount
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(animeInfo),
      db.select({ count: sql<number>`count(*)` }).from(userWatchlist),
      db.select({ count: sql<number>`count(*)` }).from(animeRelationships),
      db.select({ count: sql<number>`count(*)` }).from(timelineCache)
    ]);

    return {
      animeInfo: animeInfoCount[0]?.count || 0,
      userWatchlist: userWatchlistCount[0]?.count || 0,
      animeRelationships: animeRelationshipsCount[0]?.count || 0,
      timelineCache: timelineCacheCount[0]?.count || 0
    };
  }

  /**
   * Extract data in batches for memory efficiency
   */
  private async extractDataInBatches(): Promise<ExportData['data']> {
    const result: ExportData['data'] = {
      animeInfo: [],
      userWatchlist: [],
      animeRelationships: [],
      timelineCache: []
    };

    // Extract anime info in batches
    let lastId = 0;
    let hasMore = true;
    while (hasMore) {
      const batch = await db.select()
        .from(animeInfo)
        .where(gt(animeInfo.id, lastId))
        .orderBy(animeInfo.id)
        .limit(this.BATCH_SIZE);
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        result.animeInfo.push(...batch);
        lastId = batch[batch.length - 1].id;
        console.log(`Extracted anime info batch: ${result.animeInfo.length} total records`);
      }
    }

    // Extract user watchlist in batches
    lastId = 0;
    hasMore = true;
    while (hasMore) {
      const batch = await db.select()
        .from(userWatchlist)
        .where(gt(userWatchlist.id, lastId))
        .orderBy(userWatchlist.id)
        .limit(this.BATCH_SIZE);
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        result.userWatchlist.push(...batch);
        lastId = batch[batch.length - 1].id;
        console.log(`Extracted watchlist batch: ${result.userWatchlist.length} total records`);
      }
    }

    // Extract anime relationships in batches
    lastId = 0;
    hasMore = true;
    while (hasMore) {
      const batch = await db.select()
        .from(animeRelationships)
        .where(gt(animeRelationships.id, lastId))
        .orderBy(animeRelationships.id)
        .limit(this.BATCH_SIZE);
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        result.animeRelationships.push(...batch);
        lastId = batch[batch.length - 1].id;
        console.log(`Extracted relationships batch: ${result.animeRelationships.length} total records`);
      }
    }

    // Extract timeline cache in batches
    lastId = 0;
    hasMore = true;
    while (hasMore) {
      const batch = await db.select()
        .from(timelineCache)
        .where(gt(timelineCache.id, lastId))
        .orderBy(timelineCache.id)
        .limit(this.BATCH_SIZE);
      
      if (batch.length === 0) {
        hasMore = false;
      } else {
        result.timelineCache.push(...batch);
        lastId = batch[batch.length - 1].id;
        console.log(`Extracted timeline cache batch: ${result.timelineCache.length} total records`);
      }
    }

    console.log(`Batch extraction completed: ${result.animeInfo.length} anime, ${result.userWatchlist.length} watchlist entries, ${result.animeRelationships.length} relationships, ${result.timelineCache.length} timeline cache entries`);

    return result;
  }

  /**
   * Validate data integrity before export
   */
  async validateDataIntegrity(data: ExportData['data']): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('Validating data integrity...');

      // Validate foreign key relationships
      const animeInfoIds = new Set(data.animeInfo.map(anime => anime.id));
      const malIds = new Set(data.animeInfo.map(anime => anime.malId));

      // Check user watchlist references
      for (const entry of data.userWatchlist) {
        if (!animeInfoIds.has(entry.animeInfoId)) {
          errors.push(`Watchlist entry ${entry.id} references non-existent anime_info_id ${entry.animeInfoId}`);
        }
      }

      // Check anime relationships references
      for (const relationship of data.animeRelationships) {
        if (!malIds.has(relationship.sourceMalId)) {
          errors.push(`Relationship ${relationship.id} references non-existent source MAL ID ${relationship.sourceMalId}`);
        }
        if (!malIds.has(relationship.targetMalId)) {
          errors.push(`Relationship ${relationship.id} references non-existent target MAL ID ${relationship.targetMalId}`);
        }
      }

      // Check timeline cache references
      for (const cache of data.timelineCache) {
        if (!malIds.has(cache.rootMalId)) {
          warnings.push(`Timeline cache ${cache.id} references MAL ID ${cache.rootMalId} that may not exist in current dataset`);
        }

        // Validate timeline data is valid JSON
        try {
          JSON.parse(cache.timelineData);
        } catch {
          errors.push(`Timeline cache ${cache.id} contains invalid JSON data`);
        }
      }

      // Check for duplicate MAL IDs
      const malIdCounts = new Map<number, number>();
      for (const anime of data.animeInfo) {
        malIdCounts.set(anime.malId, (malIdCounts.get(anime.malId) || 0) + 1);
      }
      for (const [malId, count] of malIdCounts) {
        if (count > 1) {
          errors.push(`Duplicate MAL ID ${malId} found ${count} times in anime_info`);
        }
      }

      // Check for orphaned watchlist entries
      const watchlistAnimeIds = new Set(data.userWatchlist.map(entry => entry.animeInfoId));
      const orphanedAnimeIds = [...watchlistAnimeIds].filter(id => !animeInfoIds.has(id));
      if (orphanedAnimeIds.length > 0) {
        errors.push(`Found ${orphanedAnimeIds.length} orphaned watchlist entries referencing non-existent anime`);
      }

      console.log(`Data integrity validation completed: ${errors.length} errors, ${warnings.length} warnings`);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      console.error('Error during data integrity validation:', error);
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings
      };
    }
  }

  /**
   * Generate checksum for data integrity verification
   */
  private generateChecksum(data: ExportData['data']): string {
    try {
      // Create a deterministic string representation of the data
      const dataString = JSON.stringify(data, Object.keys(data).sort());
      return createHash('sha256').update(dataString).digest('hex');
    } catch (error) {
      console.error('Error generating checksum:', error);
      throw new Error('Failed to generate data checksum');
    }
  }

  /**
   * Get application version from package.json
   */
  private getApplicationVersion(): string {
    try {
      const packageJsonPath = join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version || '1.0.0';
    } catch (error) {
      console.warn('Could not read application version from package.json:', error);
      return '1.0.0';
    }
  }

  /**
   * Create export metadata
   */
  private createExportMetadata(data: ExportData['data'], checksum: string): ExportMetadata {
    const totalRecords = data.animeInfo.length + 
                        data.userWatchlist.length + 
                        data.animeRelationships.length + 
                        data.timelineCache.length;

    return {
      version: this.CURRENT_SCHEMA_VERSION,
      exportDate: new Date().toISOString(),
      totalRecords,
      checksum,
      application: {
        name: this.APPLICATION_NAME,
        version: this.getApplicationVersion()
      }
    };
  }

  /**
   * Generate complete export data with metadata and validation
   */
  async exportAllData(): Promise<ExportData> {
    try {
      console.log('Starting complete data export process...');

      // Extract all data
      const data = await this.extractAllData();

      // Validate data integrity
      const validation = await this.validateDataIntegrity(data);
      if (!validation.isValid) {
        throw new Error(`Data integrity validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('Data integrity warnings:', validation.warnings);
      }

      // Generate checksum
      const checksum = this.generateChecksum(data);

      // Create metadata
      const metadata = this.createExportMetadata(data, checksum);

      // Create complete export data
      const exportData: ExportData = {
        metadata,
        data
      };

      // Validate against schema
      const schemaValidation = ExportDataSchema.safeParse(exportData);
      if (!schemaValidation.success) {
        console.error('Schema validation errors:', schemaValidation.error.errors);
        throw new Error(`Export data does not match expected schema: ${schemaValidation.error.errors.map(e => e.message).join(', ')}`);
      }

      console.log(`Export completed successfully: ${metadata.totalRecords} total records with checksum ${checksum.substring(0, 8)}...`);

      return exportData;
    } catch (error) {
      console.error('Error during data export:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate export file as Buffer
   */
  async generateExportFile(): Promise<Buffer> {
    try {
      console.log('Generating export file...');

      const exportData = await this.exportAllData();
      const jsonString = JSON.stringify(exportData, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');

      console.log(`Export file generated: ${buffer.length} bytes`);

      return buffer;
    } catch (error) {
      console.error('Error generating export file:', error);
      throw new Error(`Failed to generate export file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate streaming export for large datasets
   */
  async generateStreamingExport(): Promise<Readable> {
    try {
      console.log('Generating streaming export...');

      const counts = await this.getTableCounts();
      const totalRecords = counts.animeInfo + counts.userWatchlist + counts.animeRelationships + counts.timelineCache;

      if (totalRecords <= this.STREAM_THRESHOLD) {
        // For small datasets, use regular export and convert to stream
        const buffer = await this.generateExportFile();
        return Readable.from(buffer);
      }

      // Create streaming export for large datasets
      return this.createStreamingExport();
    } catch (error) {
      console.error('Error generating streaming export:', error);
      throw new Error(`Failed to generate streaming export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a streaming export that processes data in chunks
   */
  private createStreamingExport(): Readable {
    let currentTable = 0;
    let currentBatch = 0;
    let lastId = 0;
    let metadataWritten = false;
    let tablesStarted = false;
    let currentTableName = '';
    
    const tables = [
      { name: 'animeInfo', schema: animeInfo },
      { name: 'userWatchlist', schema: userWatchlist },
      { name: 'animeRelationships', schema: animeRelationships },
      { name: 'timelineCache', schema: timelineCache }
    ];

    // Bind methods to preserve context
    const extractAllData = this.extractAllData.bind(this);
    const generateChecksum = this.generateChecksum.bind(this);
    const createExportMetadata = this.createExportMetadata.bind(this);

    return new Readable({
      objectMode: false,
      async read() {
        try {
          // Write metadata first
          if (!metadataWritten) {
            const data = await extractAllData();
            const checksum = generateChecksum(data);
            const metadata = createExportMetadata(data, checksum);
            
            this.push('{\n  "metadata": ');
            this.push(JSON.stringify(metadata, null, 2));
            this.push(',\n  "data": {\n');
            metadataWritten = true;
            tablesStarted = false;
            return;
          }

          // Process tables one by one
          if (currentTable < tables.length) {
            const table = tables[currentTable];
            
            // Start new table
            if (!tablesStarted) {
              if (currentTable > 0) {
                this.push(',\n');
              }
              this.push(`    "${table.name}": [\n`);
              tablesStarted = true;
              currentBatch = 0;
              lastId = 0;
              currentTableName = table.name;
            }

            // Get batch of records
            const batch = await db.select()
              .from(table.schema)
              .where(gt((table.schema as any).id, lastId))
              .orderBy((table.schema as any).id)
              .limit(this.BATCH_SIZE);

            if (batch.length === 0) {
              // End current table and move to next
              this.push('\n    ]');
              currentTable++;
              tablesStarted = false;
              console.log(`Completed streaming table: ${currentTableName}`);
              return; // Return immediately to avoid continuing processing
            } else {
              // Write batch records
              for (let i = 0; i < batch.length; i++) {
                if (currentBatch > 0 || i > 0) {
                  this.push(',\n');
                }
                this.push('      ');
                this.push(JSON.stringify(batch[i], null, 0));
              }
              
              lastId = batch[batch.length - 1].id;
              currentBatch++;
              console.log(`Streamed batch ${currentBatch} for ${currentTableName}: ${batch.length} records`);
            }
          } else {
            // End of all tables
            this.push('\n  }\n}');
            this.push(null); // End stream
          }
        } catch (error) {
          console.error('Error in streaming export:', error);
          this.destroy(error instanceof Error ? error : new Error('Unknown streaming error'));
        }
      }
    });
  }

  /**
   * Get export file metadata without generating the full file
   */
  async getExportMetadata(): Promise<{
    estimatedSize: number;
    recordCounts: {
      animeInfo: number;
      userWatchlist: number;
      animeRelationships: number;
      timelineCache: number;
      total: number;
    };
    schemaVersion: string;
  }> {
    try {
      const data = await this.extractAllData();
      
      // Estimate file size (rough calculation)
      const estimatedSize = JSON.stringify(data).length * 1.2; // Add 20% for metadata and formatting

      const recordCounts = {
        animeInfo: data.animeInfo.length,
        userWatchlist: data.userWatchlist.length,
        animeRelationships: data.animeRelationships.length,
        timelineCache: data.timelineCache.length,
        total: data.animeInfo.length + data.userWatchlist.length + data.animeRelationships.length + data.timelineCache.length
      };

      return {
        estimatedSize: Math.round(estimatedSize),
        recordCounts,
        schemaVersion: this.CURRENT_SCHEMA_VERSION
      };
    } catch (error) {
      console.error('Error getting export metadata:', error);
      throw new Error(`Failed to get export metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify export data integrity by re-validating
   */
  async verifyExportData(exportData: ExportData): Promise<{
    isValid: boolean;
    errors: string[];
    checksumValid: boolean;
  }> {
    try {
      const errors: string[] = [];

      // Validate schema
      const schemaValidation = ExportDataSchema.safeParse(exportData);
      if (!schemaValidation.success) {
        errors.push(...schemaValidation.error.errors.map(e => `Schema error: ${e.message} at ${e.path.join('.')}`));
      }

      // Validate checksum
      const calculatedChecksum = this.generateChecksum(exportData.data);
      const checksumValid = calculatedChecksum === exportData.metadata.checksum;
      if (!checksumValid) {
        errors.push(`Checksum mismatch: expected ${exportData.metadata.checksum}, got ${calculatedChecksum}`);
      }

      // Validate data integrity
      const integrityValidation = await this.validateDataIntegrity(exportData.data);
      if (!integrityValidation.isValid) {
        errors.push(...integrityValidation.errors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        checksumValid
      };
    } catch (error) {
      console.error('Error verifying export data:', error);
      return {
        isValid: false,
        errors: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        checksumValid: false
      };
    }
  }
}