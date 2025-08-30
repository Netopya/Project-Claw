import { z } from 'zod';
import type { AnimeInfo, UserWatchlistEntry, AnimeRelationship, TimelineCache } from '../db/schema.js';

// Export Data Format Types
export interface ExportMetadata {
  version: string;
  exportDate: string;
  totalRecords: number;
  checksum: string;
  application: {
    name: string;
    version: string;
  };
}

export interface ExportData {
  metadata: ExportMetadata;
  data: {
    animeInfo: AnimeInfo[];
    userWatchlist: UserWatchlistEntry[];
    animeRelationships: AnimeRelationship[];
    timelineCache: TimelineCache[];
  };
}

// Import Options Types
export type ImportMode = 'merge' | 'replace';
export type DuplicateHandling = 'skip' | 'update' | 'prompt';

export interface ImportOptions {
  mode: ImportMode;
  handleDuplicates: DuplicateHandling;
  validateRelationships: boolean;
  clearCache: boolean;
}

// Import Result Types
export interface ImportError {
  code: string;
  message: string;
  details?: any;
  table?: string;
  recordId?: number | string;
}

export interface ImportWarning {
  code: string;
  message: string;
  details?: any;
  table?: string;
  recordId?: number | string;
}

export interface ImportResult {
  success: boolean;
  recordsProcessed: {
    animeInfo: number;
    userWatchlist: number;
    animeRelationships: number;
    timelineCache: number;
  };
  errors: ImportError[];
  warnings: ImportWarning[];
}

// Validation Result Types
export interface ValidationResult {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
  metadata?: ExportMetadata;
}

// Import Preview Types
export interface ImportPreview {
  metadata: ExportMetadata;
  summary: {
    animeInfo: number;
    userWatchlist: number;
    animeRelationships: number;
    timelineCache: number;
  };
  conflicts: {
    duplicateAnime: Array<{
      malId: number;
      title: string;
      existingTitle?: string;
    }>;
    duplicateWatchlistEntries: Array<{
      animeInfoId: number;
      title: string;
    }>;
  };
  schemaMigrationRequired: boolean;
  estimatedProcessingTime: number; // in seconds
}

// Database Statistics Types
export interface DatabaseStats {
  animeInfo: number;
  userWatchlist: number;
  animeRelationships: number;
  timelineCache: number;
  totalRecords: number;
  lastUpdated: string;
}

// API Response Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Export API Response Types
export type ExportStatsResponse = ApiResponse<DatabaseStats>;
export type ExportGenerateResponse = ApiResponse<{
  filename: string;
  size: number;
  checksum: string;
}>;

// Import API Response Types
export type ImportValidateResponse = ApiResponse<ValidationResult>;
export type ImportPreviewResponse = ApiResponse<ImportPreview>;
export type ImportExecuteResponse = ApiResponse<ImportResult>;

// Schema Migration Types
export interface VersionHandler {
  version: string;
  migrate(data: any): Promise<ExportData>;
  validate(data: any): boolean;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  changes: string[];
  errors: ImportError[];
}