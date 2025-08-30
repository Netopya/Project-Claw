import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { ExportData, ExportMetadata } from '../../types/export-import.js';
import { ExportDataSchema } from '../../types/export-validation.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ExportService {
  private readonly CURRENT_SCHEMA_VERSION = '1.0.0';
  private readonly APPLICATION_NAME = 'Project Claw';

  /**
   * Extract all data from database tables
   */
  async extractAllData(): Promise<ExportData['data']> {
    try {
      console.log('Starting data extraction from all database tables...');

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