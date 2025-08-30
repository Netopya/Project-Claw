import type { 
  ExportData, 
  VersionHandler, 
  MigrationResult, 
  ImportError 
} from '../../types/export-import.js';

/**
 * Schema Migration Service
 * Handles backward compatibility for different export data versions
 */
export class SchemaMigrationService {
  private readonly CURRENT_VERSION = '1.0.0';
  private readonly versionHandlers: Map<string, VersionHandler>;

  constructor() {
    this.versionHandlers = new Map();
    this.initializeVersionHandlers();
  }

  /**
   * Initialize version handlers for different schema versions
   */
  private initializeVersionHandlers(): void {
    // Version 1.0.0 handler (current version - no migration needed)
    this.versionHandlers.set('1.0.0', new Version100Handler());
    
    // Future version handlers would be added here
    // this.versionHandlers.set('0.9.0', new Version090Handler());
    // this.versionHandlers.set('0.8.0', new Version080Handler());
  }

  /**
   * Migrate export data to current schema version
   */
  async migrateToCurrentVersion(data: any): Promise<MigrationResult> {
    const errors: ImportError[] = [];
    const changes: string[] = [];

    try {
      // Extract version from metadata
      const sourceVersion = this.extractVersion(data);
      
      if (!sourceVersion) {
        errors.push({
          code: 'MISSING_VERSION',
          message: 'Cannot determine source schema version from export data'
        });
        return {
          success: false,
          fromVersion: 'unknown',
          toVersion: this.CURRENT_VERSION,
          changes: [],
          errors
        };
      }

      // If already current version, still validate the data structure
      if (sourceVersion === this.CURRENT_VERSION) {
        const handler = this.versionHandlers.get(sourceVersion);
        
        if (!handler) {
          errors.push({
            code: 'MISSING_VERSION_HANDLER',
            message: `No version handler found for version ${sourceVersion}`
          });
          return {
            success: false,
            fromVersion: sourceVersion,
            toVersion: this.CURRENT_VERSION,
            changes: [],
            errors
          };
        }

        // Validate data structure even for current version
        if (!handler.validate(data)) {
          errors.push({
            code: 'VALIDATION_FAILED',
            message: `Data validation failed for version ${sourceVersion}`
          });
          return {
            success: false,
            fromVersion: sourceVersion,
            toVersion: this.CURRENT_VERSION,
            changes: [],
            errors
          };
        }

        return {
          success: true,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes: ['No migration required - data is already current version'],
          errors: [],
          migratedData: data as ExportData
        };
      }

      // Check if source version is supported
      if (!this.versionHandlers.has(sourceVersion)) {
        errors.push({
          code: 'NO_MIGRATION_PATH',
          message: `No migration path available from version ${sourceVersion} to ${this.CURRENT_VERSION}`
        });
        return {
          success: false,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes: [],
          errors
        };
      }

      // Get the handler for the source version
      const handler = this.versionHandlers.get(sourceVersion);
      
      if (!handler) {
        errors.push({
          code: 'MISSING_VERSION_HANDLER',
          message: `No version handler found for version ${sourceVersion}`
        });
        return {
          success: false,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes: [],
          errors
        };
      }

      // Validate data before migration
      if (!handler.validate(data)) {
        errors.push({
          code: 'VALIDATION_FAILED',
          message: `Data validation failed for version ${sourceVersion}`
        });
        return {
          success: false,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes,
          errors
        };
      }

      // Perform migration
      try {
        const migratedData = await handler.migrate(data);
        changes.push(`Migrated from ${sourceVersion} to ${this.CURRENT_VERSION}`);
        
        return {
          success: true,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes,
          errors: [],
          migratedData: migratedData
        };
      } catch (migrationError) {
        errors.push({
          code: 'MIGRATION_FAILED',
          message: `Migration from ${sourceVersion} to ${this.CURRENT_VERSION} failed: ${
            migrationError instanceof Error ? migrationError.message : 'Unknown error'
          }`
        });
        return {
          success: false,
          fromVersion: sourceVersion,
          toVersion: this.CURRENT_VERSION,
          changes,
          errors
        };
      }

      return {
        success: true,
        fromVersion: sourceVersion,
        toVersion: this.CURRENT_VERSION,
        changes,
        errors: []
      };

    } catch (error) {
      errors.push({
        code: 'MIGRATION_SERVICE_ERROR',
        message: `Schema migration service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return {
        success: false,
        fromVersion: 'unknown',
        toVersion: this.CURRENT_VERSION,
        changes,
        errors
      };
    }
  }

  /**
   * Extract version from export data
   */
  private extractVersion(data: any): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    if (!data.metadata || typeof data.metadata !== 'object') {
      return null;
    }

    return data.metadata.version || null;
  }



  /**
   * Check if a version is supported for migration
   */
  isVersionSupported(version: string): boolean {
    return this.versionHandlers.has(version) || version === this.CURRENT_VERSION;
  }

  /**
   * Get all supported versions
   */
  getSupportedVersions(): string[] {
    return Array.from(this.versionHandlers.keys()).sort(this.compareVersions);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): string {
    return this.CURRENT_VERSION;
  }

  /**
   * Compare two version strings (semantic versioning)
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  /**
   * Validate migrated data structure
   */
  async validateMigratedData(data: ExportData): Promise<{
    isValid: boolean;
    errors: ImportError[];
  }> {
    const errors: ImportError[] = [];

    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push({
          code: 'INVALID_STRUCTURE',
          message: 'Migrated data is not a valid object'
        });
        return { isValid: false, errors };
      }

      if (!data.metadata) {
        errors.push({
          code: 'MISSING_METADATA',
          message: 'Migrated data is missing metadata section'
        });
      }

      if (!data.data) {
        errors.push({
          code: 'MISSING_DATA',
          message: 'Migrated data is missing data section'
        });
      }

      // Validate metadata structure
      if (data.metadata) {
        if (!data.metadata.version) {
          errors.push({
            code: 'MISSING_VERSION',
            message: 'Migrated data metadata is missing version'
          });
        } else if (data.metadata.version !== this.CURRENT_VERSION) {
          errors.push({
            code: 'INCORRECT_VERSION',
            message: `Migrated data version ${data.metadata.version} does not match current version ${this.CURRENT_VERSION}`
          });
        }

        if (!data.metadata.exportDate) {
          errors.push({
            code: 'MISSING_EXPORT_DATE',
            message: 'Migrated data metadata is missing export date'
          });
        }

        if (typeof data.metadata.totalRecords !== 'number') {
          errors.push({
            code: 'INVALID_TOTAL_RECORDS',
            message: 'Migrated data metadata has invalid total records count'
          });
        }
      }

      // Validate data structure
      if (data.data) {
        const requiredTables = ['animeInfo', 'userWatchlist', 'animeRelationships', 'timelineCache'];
        
        for (const table of requiredTables) {
          if (!Array.isArray(data.data[table as keyof typeof data.data])) {
            errors.push({
              code: 'INVALID_TABLE_STRUCTURE',
              message: `Migrated data table '${table}' is not an array`,
              table
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Migrated data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { isValid: false, errors };
    }
  }
}

/**
 * Version 1.0.0 Handler (Current Version)
 * No migration needed, just validation
 */
class Version100Handler implements VersionHandler {
  version = '1.0.0';

  async migrate(data: any): Promise<ExportData> {
    // No migration needed for current version, just return as-is
    return data as ExportData;
  }

  validate(data: any): boolean {
    // Basic validation for version 1.0.0 structure
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!data.metadata || !data.data) {
      return false;
    }

    if (typeof data.data !== 'object') {
      return false;
    }

    // Check required tables exist and are arrays
    const requiredTables = ['animeInfo', 'userWatchlist', 'animeRelationships', 'timelineCache'];
    for (const table of requiredTables) {
      if (!data.data[table] || !Array.isArray(data.data[table])) {
        return false;
      }
    }

    return true;
  }
}

// Example of how future version handlers would be implemented:
/*
class Version090Handler implements VersionHandler {
  version = '0.9.0';

  async migrate(data: any): Promise<ExportData> {
    // Example migration from 0.9.0 to 1.0.0
    const migratedData = { ...data };
    
    // Add new fields that were introduced in 1.0.0
    if (migratedData.data.animeInfo) {
      migratedData.data.animeInfo = migratedData.data.animeInfo.map((anime: any) => ({
        ...anime,
        // Add new field with default value
        animeType: anime.animeType || 'unknown'
      }));
    }
    
    // Update metadata version
    migratedData.metadata.version = '1.0.0';
    
    return migratedData;
  }

  validate(data: any): boolean {
    // Validation logic for 0.9.0 format
    return data && data.metadata && data.data;
  }
}
*/