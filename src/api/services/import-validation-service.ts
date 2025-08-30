import { ExportDataSchema } from '../../types/export-validation.js';
import type { 
  ExportData, 
  ValidationResult, 
  ImportPreview, 
  ImportError, 
  ImportWarning,
  ExportMetadata 
} from '../../types/export-import.js';
import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';
import { SchemaMigrationService } from './schema-migration-service.js';

export class ImportValidationService {
  private readonly CURRENT_SCHEMA_VERSION = '1.0.0';
  private readonly SUPPORTED_VERSIONS = ['1.0.0'];
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly schemaMigrationService: SchemaMigrationService;

  constructor() {
    this.schemaMigrationService = new SchemaMigrationService();
  }

  /**
   * Validate import file format and structure
   */
  async validateImportFile(fileBuffer: Buffer): Promise<ValidationResult> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    try {
      // Check file size
      if (fileBuffer.length > this.MAX_FILE_SIZE) {
        errors.push({
          code: 'FILE_TOO_LARGE',
          message: `File size ${fileBuffer.length} bytes exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`
        });
        return { isValid: false, errors, warnings };
      }

      // Check if file is empty
      if (fileBuffer.length === 0) {
        errors.push({
          code: 'EMPTY_FILE',
          message: 'Import file is empty'
        });
        return { isValid: false, errors, warnings };
      }

      // Parse JSON
      let parsedData: any;
      try {
        const jsonString = fileBuffer.toString('utf-8');
        parsedData = JSON.parse(jsonString);
      } catch (parseError) {
        errors.push({
          code: 'INVALID_JSON',
          message: `File contains invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
        });
        return { isValid: false, errors, warnings };
      }

      // Validate basic structure
      if (!parsedData || typeof parsedData !== 'object') {
        errors.push({
          code: 'INVALID_STRUCTURE',
          message: 'File must contain a valid JSON object'
        });
        return { isValid: false, errors, warnings };
      }

      // Check for required top-level properties
      if (!parsedData.metadata) {
        errors.push({
          code: 'MISSING_METADATA',
          message: 'Import file is missing required metadata section'
        });
      }

      if (!parsedData.data) {
        errors.push({
          code: 'MISSING_DATA',
          message: 'Import file is missing required data section'
        });
      }

      if (errors.length > 0) {
        return { isValid: false, errors, warnings };
      }

      // Validate schema version and perform migration if needed
      const versionValidation = this.validateSchemaVersion(parsedData.metadata);
      errors.push(...versionValidation.errors);
      warnings.push(...versionValidation.warnings);

      if (!versionValidation.isSupported) {
        return { isValid: false, errors, warnings, metadata: parsedData.metadata };
      }

      // Perform schema migration if needed
      if (parsedData.metadata.version !== this.CURRENT_SCHEMA_VERSION) {
        const migrationResult = await this.schemaMigrationService.migrateToCurrentVersion(parsedData);
        
        if (!migrationResult.success) {
          errors.push(...migrationResult.errors);
          return { isValid: false, errors, warnings, metadata: parsedData.metadata };
        }

        // Use the migrated data for further validation
        if (migrationResult.migratedData) {
          parsedData = migrationResult.migratedData;
        }

        // Add migration info to warnings
        for (const change of migrationResult.changes) {
          warnings.push({
            code: 'SCHEMA_MIGRATED',
            message: change
          });
        }
      }

      // Validate against Zod schema
      const schemaValidation = ExportDataSchema.safeParse(parsedData);
      if (!schemaValidation.success) {
        for (const error of schemaValidation.error.errors) {
          errors.push({
            code: 'SCHEMA_VALIDATION_ERROR',
            message: `Schema validation failed: ${error.message}`,
            details: {
              path: error.path.join('.'),
              code: error.code,
              expected: error.expected,
              received: error.received
            }
          });
        }
      }

      // Validate data integrity
      const integrityValidation = await this.validateDataIntegrity(parsedData);
      errors.push(...integrityValidation.errors);
      warnings.push(...integrityValidation.warnings);

      // Validate checksum
      const checksumValidation = this.validateChecksum(parsedData);
      if (!checksumValidation.isValid) {
        errors.push(...checksumValidation.errors);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: parsedData.metadata
      };

    } catch (error) {
      console.error('Error during file validation:', error);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate schema version and compatibility
   */
  private validateSchemaVersion(metadata: any): {
    isSupported: boolean;
    errors: ImportError[];
    warnings: ImportWarning[];
  } {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    if (!metadata || !metadata.version) {
      errors.push({
        code: 'MISSING_SCHEMA_VERSION',
        message: 'Import file metadata is missing schema version'
      });
      return { isSupported: false, errors, warnings };
    }

    const fileVersion = metadata.version;

    // Use migration service to check if version is supported
    if (!this.schemaMigrationService.isVersionSupported(fileVersion)) {
      // Check if it's a newer version
      if (this.isNewerVersion(fileVersion, this.CURRENT_SCHEMA_VERSION)) {
        errors.push({
          code: 'UNSUPPORTED_NEWER_VERSION',
          message: `Import file uses newer schema version ${fileVersion}. Current application supports up to version ${this.CURRENT_SCHEMA_VERSION}. Please update the application to import this file.`
        });
        return { isSupported: false, errors, warnings };
      }

      errors.push({
        code: 'UNSUPPORTED_VERSION',
        message: `Unsupported schema version: ${fileVersion}. Supported versions: ${this.schemaMigrationService.getSupportedVersions().join(', ')}`
      });
      return { isSupported: false, errors, warnings };
    }

    // If it's an older version that needs migration
    if (this.isOlderVersion(fileVersion, this.CURRENT_SCHEMA_VERSION)) {
      warnings.push({
        code: 'OLDER_SCHEMA_VERSION',
        message: `Import file uses older schema version ${fileVersion}. Automatic migration to version ${this.CURRENT_SCHEMA_VERSION} will be performed.`
      });
    }

    return { isSupported: true, errors, warnings };
  }

  /**
   * Compare version strings to determine if first is newer than second
   */
  private isNewerVersion(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }
    
    return false;
  }

  /**
   * Compare version strings to determine if first is older than second
   */
  private isOlderVersion(version1: string, version2: string): boolean {
    return this.isNewerVersion(version2, version1);
  }

  /**
   * Validate data integrity and relationships
   */
  private async validateDataIntegrity(exportData: ExportData): Promise<{
    errors: ImportError[];
    warnings: ImportWarning[];
  }> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    try {
      const { data } = exportData;

      // Validate foreign key relationships
      const animeInfoIds = new Set(data.animeInfo.map(anime => anime.id));
      const malIds = new Set(data.animeInfo.map(anime => anime.malId));

      // Check user watchlist references
      for (const entry of data.userWatchlist) {
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

      // Check anime relationships references
      for (const relationship of data.animeRelationships) {
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

      // Check timeline cache references
      for (const cache of data.timelineCache) {
        if (!malIds.has(cache.rootMalId)) {
          warnings.push({
            code: 'MISSING_REFERENCE',
            message: `Timeline cache references MAL ID ${cache.rootMalId} that doesn't exist in import data`,
            table: 'timelineCache',
            recordId: cache.id,
            details: { rootMalId: cache.rootMalId }
          });
        }

        // Validate timeline data is valid JSON
        try {
          JSON.parse(cache.timelineData);
        } catch {
          errors.push({
            code: 'INVALID_JSON_DATA',
            message: `Timeline cache contains invalid JSON data`,
            table: 'timelineCache',
            recordId: cache.id
          });
        }
      }

      // Check for duplicate MAL IDs
      const malIdCounts = new Map<number, number>();
      for (const anime of data.animeInfo) {
        malIdCounts.set(anime.malId, (malIdCounts.get(anime.malId) || 0) + 1);
      }
      for (const [malId, count] of malIdCounts) {
        if (count > 1) {
          errors.push({
            code: 'DUPLICATE_RECORD',
            message: `Duplicate MAL ID ${malId} found ${count} times in anime data`,
            table: 'animeInfo',
            details: { malId, count }
          });
        }
      }

      // Check for duplicate IDs within each table
      this.validateUniqueIds(data.animeInfo, 'animeInfo', 'id', errors);
      this.validateUniqueIds(data.userWatchlist, 'userWatchlist', 'id', errors);
      this.validateUniqueIds(data.animeRelationships, 'animeRelationships', 'id', errors);
      this.validateUniqueIds(data.timelineCache, 'timelineCache', 'id', errors);

    } catch (error) {
      errors.push({
        code: 'INTEGRITY_VALIDATION_ERROR',
        message: `Data integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate unique IDs within a dataset
   */
  private validateUniqueIds(
    records: any[], 
    tableName: string, 
    idField: string, 
    errors: ImportError[]
  ): void {
    const idCounts = new Map<any, number>();
    
    for (const record of records) {
      const id = record[idField];
      if (id !== undefined && id !== null) {
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      }
    }

    for (const [id, count] of idCounts) {
      if (count > 1) {
        errors.push({
          code: 'DUPLICATE_ID',
          message: `Duplicate ${idField} ${id} found ${count} times in ${tableName}`,
          table: tableName,
          details: { [idField]: id, count }
        });
      }
    }
  }

  /**
   * Validate checksum for data integrity
   */
  private validateChecksum(exportData: ExportData): {
    isValid: boolean;
    errors: ImportError[];
  } {
    const errors: ImportError[] = [];

    try {
      if (!exportData.metadata.checksum) {
        errors.push({
          code: 'MISSING_CHECKSUM',
          message: 'Import file is missing data integrity checksum'
        });
        return { isValid: false, errors };
      }

      // Calculate checksum of the data
      const dataString = JSON.stringify(exportData.data, Object.keys(exportData.data).sort());
      const calculatedChecksum = createHash('sha256').update(dataString).digest('hex');

      if (calculatedChecksum !== exportData.metadata.checksum) {
        errors.push({
          code: 'CHECKSUM_MISMATCH',
          message: `Data integrity checksum mismatch. Expected: ${exportData.metadata.checksum}, Calculated: ${calculatedChecksum}`,
          details: {
            expected: exportData.metadata.checksum,
            calculated: calculatedChecksum
          }
        });
        return { isValid: false, errors };
      }

      return { isValid: true, errors };
    } catch (error) {
      errors.push({
        code: 'CHECKSUM_VALIDATION_ERROR',
        message: `Checksum validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { isValid: false, errors };
    }
  }

  /**
   * Create import preview with conflict detection
   */
  async createImportPreview(exportData: ExportData): Promise<ImportPreview> {
    try {
      const { metadata, data } = exportData;

      // Get summary of records to import
      const summary = {
        animeInfo: data.animeInfo.length,
        userWatchlist: data.userWatchlist.length,
        animeRelationships: data.animeRelationships.length,
        timelineCache: data.timelineCache.length
      };

      // Detect conflicts with existing data
      const conflicts = await this.detectConflicts(data);

      // Check if schema migration is required
      const schemaMigrationRequired = metadata.version !== this.CURRENT_SCHEMA_VERSION;

      // Estimate processing time (rough calculation based on record count)
      const totalRecords = summary.animeInfo + summary.userWatchlist + 
                          summary.animeRelationships + summary.timelineCache;
      const estimatedProcessingTime = Math.max(1, Math.ceil(totalRecords / 1000)); // ~1 second per 1000 records

      return {
        metadata,
        summary,
        conflicts,
        schemaMigrationRequired,
        estimatedProcessingTime
      };
    } catch (error) {
      console.error('Error creating import preview:', error);
      throw new Error(`Failed to create import preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect conflicts with existing database data
   */
  private async detectConflicts(importData: ExportData['data']): Promise<ImportPreview['conflicts']> {
    try {
      const duplicateAnime: ImportPreview['conflicts']['duplicateAnime'] = [];
      const duplicateWatchlistEntries: ImportPreview['conflicts']['duplicateWatchlistEntries'] = [];

      // Check for duplicate anime by MAL ID
      const importMalIds = importData.animeInfo.map(anime => anime.malId);
      if (importMalIds.length > 0) {
        const existingAnime = await db
          .select({ malId: animeInfo.malId, title: animeInfo.title })
          .from(animeInfo)
          .where(inArray(animeInfo.malId, importMalIds));

        // For each import anime, check if it exists
        for (const importAnime of importData.animeInfo) {
          const existing = existingAnime.find(e => e.malId === importAnime.malId);
          if (existing) {
            duplicateAnime.push({
              malId: importAnime.malId,
              title: importAnime.title,
              existingTitle: existing.title
            });
          }
        }
      }

      // Check for duplicate watchlist entries
      const importAnimeInfoIds = importData.userWatchlist.map(entry => entry.animeInfoId);
      if (importAnimeInfoIds.length > 0) {
        const existingWatchlistEntries = await db
          .select({ 
            animeInfoId: userWatchlist.animeInfoId,
            title: animeInfo.title 
          })
          .from(userWatchlist)
          .innerJoin(animeInfo, eq(userWatchlist.animeInfoId, animeInfo.id))
          .where(inArray(userWatchlist.animeInfoId, importAnimeInfoIds));

        for (const importEntry of importData.userWatchlist) {
          const existing = existingWatchlistEntries.find(e => e.animeInfoId === importEntry.animeInfoId);
          if (existing) {
            duplicateWatchlistEntries.push({
              animeInfoId: importEntry.animeInfoId,
              title: existing.title
            });
          }
        }
      }

      return {
        duplicateAnime,
        duplicateWatchlistEntries
      };
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      // Return empty conflicts if detection fails
      return {
        duplicateAnime: [],
        duplicateWatchlistEntries: []
      };
    }
  }

  /**
   * Validate file format by checking file extension and MIME type
   */
  validateFileFormat(filename: string, mimeType?: string): {
    isValid: boolean;
    errors: ImportError[];
  } {
    const errors: ImportError[] = [];

    // Check file extension
    if (!filename.toLowerCase().endsWith('.json')) {
      errors.push({
        code: 'INVALID_FILE_EXTENSION',
        message: 'Import file must have .json extension',
        details: { filename, expectedExtension: '.json' }
      });
    }

    // Check MIME type if provided
    if (mimeType && !['application/json', 'text/json', 'text/plain'].includes(mimeType)) {
      errors.push({
        code: 'INVALID_MIME_TYPE',
        message: 'Import file must be a JSON file',
        details: { mimeType, expectedTypes: ['application/json', 'text/json'] }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported schema versions
   */
  getSupportedVersions(): string[] {
    return this.schemaMigrationService.getSupportedVersions();
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): string {
    return this.schemaMigrationService.getCurrentVersion();
  }
}