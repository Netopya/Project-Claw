/**
 * Integration Tests for Export-Import API Endpoints
 * 
 * Tests the complete API workflow including:
 * - Export API endpoints with real data
 * - Import API endpoints with file handling
 * - Error scenarios and recovery
 * - Performance with large datasets
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { exportRoutes } from '../routes/export.js';
import { importRoutes } from '../routes/import.js';
import { createTestDatabase } from '../../test-utils/database-setup.js';
import type { 
  ExportStatsResponse,
  ImportValidateResponse,
  ImportPreviewResponse,
  ImportExecuteResponse 
} from '../../types/export-import.js';
import Database from 'better-sqlite3';

describe('Export-Import API Integration Tests', () => {
  let app: Hono;
  let testDb: Database.Database;

  beforeEach(async () => {
    // Create test database
    testDb = createTestDatabase();
    
    // Mock the database connection
    (global as any).mockDatabase = testDb;
    
    // Create Hono app with routes
    app = new Hono();
    app.route('/api/export', exportRoutes);
    app.route('/api/import', importRoutes);
    
    // Populate test data
    await populateTestData(testDb);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    (global as any).mockDatabase = undefined;
  });

  describe('Export API Endpoints', () => {
    it('should get database statistics', async () => {
      const response = await app.request('/api/export/stats');
      
      expect(response.status).toBe(200);
      
      const data: ExportStatsResponse = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data!.animeInfo).toBeGreaterThan(0);
      expect(data.data!.totalRecords).toBeGreaterThan(0);
      expect(data.data!.lastUpdated).toBeDefined();
    });

    it('should get detailed database statistics', async () => {
      const response = await app.request('/api/export/stats/detailed');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.tables).toBeDefined();
      expect(data.data.relationships).toBeDefined();
    });

    it('should validate statistics accuracy', async () => {
      const response = await app.request('/api/export/stats/validate');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.isAccurate).toBe(true);
      expect(data.data.discrepancies).toHaveLength(0);
    });

    it('should generate export file', async () => {
      const response = await app.request('/api/export/generate', {
        method: 'POST'
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      
      const exportData = await response.text();
      const parsedData = JSON.parse(exportData);
      
      expect(parsedData.metadata).toBeDefined();
      expect(parsedData.metadata.version).toBe('1.0.0');
      expect(parsedData.data).toBeDefined();
      expect(parsedData.data.animeInfo).toBeInstanceOf(Array);
    });

    it('should get export metadata without generating file', async () => {
      const response = await app.request('/api/export/metadata');
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.estimatedSize).toBeGreaterThan(0);
      expect(data.data.recordCounts).toBeDefined();
      expect(data.data.schemaVersion).toBe('1.0.0');
    });

    it('should handle export errors gracefully', async () => {
      // Close database to simulate error
      testDb.close();
      
      const response = await app.request('/api/export/stats');
      
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
    });
  });

  describe('Import API Endpoints', () => {
    let validExportFile: File;

    beforeEach(async () => {
      // Generate a valid export file for testing
      const exportResponse = await app.request('/api/export/generate', {
        method: 'POST'
      });
      
      const exportData = await exportResponse.text();
      validExportFile = new File([exportData], 'test-export.json', {
        type: 'application/json'
      });
    });

    it('should validate import file successfully', async () => {
      const formData = new FormData();
      formData.append('file', validExportFile);
      
      const response = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data: ImportValidateResponse = await response.json();
      expect(data.success).toBe(true);
      expect(data.data!.isValid).toBe(true);
      expect(data.data!.errors).toHaveLength(0);
      expect(data.data!.metadata).toBeDefined();
    });

    it('should reject invalid file format', async () => {
      const invalidFile = new File(['invalid content'], 'test.txt', {
        type: 'text/plain'
      });
      
      const formData = new FormData();
      formData.append('file', invalidFile);
      
      const response = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const data: ImportValidateResponse = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should reject oversized files', async () => {
      // Create a file larger than 50MB
      const largeContent = 'x'.repeat(51 * 1024 * 1024);
      const largeFile = new File([largeContent], 'large.json', {
        type: 'application/json'
      });
      
      const formData = new FormData();
      formData.append('file', largeFile);
      
      const response = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(413);
      
      const data: ImportValidateResponse = await response.json();
      expect(data.success).toBe(false);
      expect(data.error!.code).toBe('VALIDATION_FILE_TOO_LARGE');
    });

    it('should create import preview', async () => {
      const formData = new FormData();
      formData.append('file', validExportFile);
      
      const response = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data: ImportPreviewResponse = await response.json();
      expect(data.success).toBe(true);
      expect(data.data!.metadata).toBeDefined();
      expect(data.data!.summary).toBeDefined();
      expect(data.data!.conflicts).toBeDefined();
      expect(data.data!.estimatedProcessingTime).toBeGreaterThan(0);
    });

    it('should execute import successfully', async () => {
      // Clear database first
      clearTestDatabase(testDb);
      
      const formData = new FormData();
      formData.append('file', validExportFile);
      formData.append('options', JSON.stringify({
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      }));
      
      const response = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data: ImportExecuteResponse = await response.json();
      expect(data.success).toBe(true);
      expect(data.data!.success).toBe(true);
      expect(data.data!.recordsProcessed).toBeDefined();
      expect(data.data!.recordsProcessed.animeInfo).toBeGreaterThan(0);
    });

    it('should handle import with merge mode', async () => {
      const formData = new FormData();
      formData.append('file', validExportFile);
      formData.append('options', JSON.stringify({
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      }));
      
      const response = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBe(200);
      
      const data: ImportExecuteResponse = await response.json();
      expect(data.success).toBe(true);
      expect(data.data!.warnings.length).toBeGreaterThan(0); // Should have duplicate warnings
    });

    it('should handle invalid import options', async () => {
      const formData = new FormData();
      formData.append('file', validExportFile);
      formData.append('options', 'invalid json');
      
      const response = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const data: ImportExecuteResponse = await response.json();
      expect(data.success).toBe(false);
      expect(data.error!.code).toBe('VALIDATION_INVALID_JSON');
    });

    it('should handle missing file in requests', async () => {
      const formData = new FormData();
      // Don't append file
      
      const response = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const data: ImportValidateResponse = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('End-to-End API Workflow', () => {
    it('should complete full export-import cycle via API', async () => {
      // Step 1: Get initial statistics
      const initialStatsResponse = await app.request('/api/export/stats');
      const initialStats = await initialStatsResponse.json();
      
      expect(initialStats.success).toBe(true);
      const initialCount = initialStats.data.totalRecords;
      
      // Step 2: Export data
      const exportResponse = await app.request('/api/export/generate', {
        method: 'POST'
      });
      
      expect(exportResponse.status).toBe(200);
      const exportData = await exportResponse.text();
      
      // Step 3: Clear database
      clearTestDatabase(testDb);
      
      // Step 4: Verify database is empty
      const emptyStatsResponse = await app.request('/api/export/stats');
      const emptyStats = await emptyStatsResponse.json();
      expect(emptyStats.data.totalRecords).toBe(0);
      
      // Step 5: Import data back
      const importFile = new File([exportData], 'export.json', {
        type: 'application/json'
      });
      
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('options', JSON.stringify({
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      }));
      
      const importResponse = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      expect(importResponse.status).toBe(200);
      const importResult = await importResponse.json();
      expect(importResult.success).toBe(true);
      
      // Step 6: Verify data is restored
      const finalStatsResponse = await app.request('/api/export/stats');
      const finalStats = await finalStatsResponse.json();
      
      expect(finalStats.data.totalRecords).toBe(initialCount);
    });

    it('should handle validation-preview-import workflow', async () => {
      // Generate export file
      const exportResponse = await app.request('/api/export/generate', {
        method: 'POST'
      });
      const exportData = await exportResponse.text();
      const exportFile = new File([exportData], 'export.json', {
        type: 'application/json'
      });
      
      // Step 1: Validate file
      let formData = new FormData();
      formData.append('file', exportFile);
      
      const validateResponse = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(validateResponse.status).toBe(200);
      const validateResult = await validateResponse.json();
      expect(validateResult.data.isValid).toBe(true);
      
      // Step 2: Preview import
      formData = new FormData();
      formData.append('file', exportFile);
      
      const previewResponse = await app.request('/api/import/preview', {
        method: 'POST',
        body: formData
      });
      
      expect(previewResponse.status).toBe(200);
      const previewResult = await previewResponse.json();
      expect(previewResult.data.summary).toBeDefined();
      
      // Step 3: Execute import
      formData = new FormData();
      formData.append('file', exportFile);
      formData.append('options', JSON.stringify({
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      }));
      
      const executeResponse = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      expect(executeResponse.status).toBe(200);
      const executeResult = await executeResponse.json();
      expect(executeResult.data.success).toBe(true);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent export requests', async () => {
      const concurrentRequests = 5;
      const promises = Array(concurrentRequests).fill(null).map(() =>
        app.request('/api/export/stats')
      );
      
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large export file generation', async () => {
      // Populate with more data
      await populateLargeTestData(testDb, 500);
      
      const startTime = Date.now();
      
      const response = await app.request('/api/export/generate', {
        method: 'POST'
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      const exportData = await response.text();
      const parsedData = JSON.parse(exportData);
      expect(parsedData.data.animeInfo.length).toBeGreaterThan(500);
    });

    it('should handle import timeout scenarios', async () => {
      // This test would require mocking slow database operations
      // For now, we'll test that the endpoint responds appropriately
      
      const exportResponse = await app.request('/api/export/generate', {
        method: 'POST'
      });
      const exportData = await exportResponse.text();
      const exportFile = new File([exportData], 'export.json', {
        type: 'application/json'
      });
      
      const formData = new FormData();
      formData.append('file', exportFile);
      formData.append('options', JSON.stringify({
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      }));
      
      const response = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      // Should complete successfully under normal conditions
      expect(response.status).toBe(200);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle database connection failures during export', async () => {
      // Close database to simulate connection failure
      testDb.close();
      
      const response = await app.request('/api/export/generate', {
        method: 'POST'
      });
      
      expect(response.status).toBeGreaterThanOrEqual(500);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBeDefined();
    });

    it('should handle corrupted import files', async () => {
      const corruptedFile = new File(['{ "corrupted": json }'], 'corrupt.json', {
        type: 'application/json'
      });
      
      const formData = new FormData();
      formData.append('file', corruptedFile);
      
      const response = await app.request('/api/import/validate', {
        method: 'POST',
        body: formData
      });
      
      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toContain('JSON');
    });

    it('should handle import rollback scenarios', async () => {
      // Create export data with intentional conflicts
      const validExportResponse = await app.request('/api/export/generate', {
        method: 'POST'
      });
      const validExportData = await validExportResponse.text();
      const exportData = JSON.parse(validExportData);
      
      // Add conflicting data
      exportData.data.animeInfo.push({
        id: 999,
        malId: exportData.data.animeInfo[0].malId, // Duplicate MAL ID
        title: 'Conflicting Anime',
        titleEnglish: null,
        titleJapanese: null,
        imageUrl: null,
        rating: null,
        premiereDate: null,
        numEpisodes: null,
        episodeDuration: null,
        animeType: 'tv',
        status: null,
        source: null,
        studios: null,
        genres: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      const conflictFile = new File([JSON.stringify(exportData)], 'conflict.json', {
        type: 'application/json'
      });
      
      const formData = new FormData();
      formData.append('file', conflictFile);
      formData.append('options', JSON.stringify({
        mode: 'merge',
        handleDuplicates: 'skip',
        validateRelationships: true,
        clearCache: false
      }));
      
      const response = await app.request('/api/import/execute', {
        method: 'POST',
        body: formData
      });
      
      // Should handle conflicts gracefully
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.data.warnings.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions

async function populateTestData(db: Database.Database): Promise<void> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertWatchlist = db.prepare(`
    INSERT INTO user_watchlist (anime_info_id, priority, watch_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const insertRelationship = db.prepare(`
    INSERT INTO anime_relationships (source_mal_id, target_mal_id, relationship_type, created_at)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertCache = db.prepare(`
    INSERT INTO timeline_cache (root_mal_id, timeline_data, cache_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  // Insert test anime
  const animeData = [
    { malId: 1, title: 'Test Anime 1' },
    { malId: 2, title: 'Test Anime 2' },
    { malId: 3, title: 'Test Anime 3' },
    { malId: 4, title: 'Test Anime 4' },
    { malId: 5, title: 'Test Anime 5' }
  ];
  
  animeData.forEach(anime => {
    insertAnime.run(anime.malId, anime.title, 'tv', now, now);
  });
  
  // Insert watchlist entries
  const watchlistData = [
    { animeInfoId: 1, priority: 1, status: 'watching' },
    { animeInfoId: 2, priority: 2, status: 'completed' },
    { animeInfoId: 3, priority: 3, status: 'plan_to_watch' }
  ];
  
  watchlistData.forEach(entry => {
    insertWatchlist.run(entry.animeInfoId, entry.priority, entry.status, now, now);
  });
  
  // Insert relationships
  const relationshipData = [
    { source: 1, target: 2, type: 'sequel' },
    { source: 2, target: 3, type: 'sequel' }
  ];
  
  relationshipData.forEach(rel => {
    insertRelationship.run(rel.source, rel.target, rel.type, now);
  });
  
  // Insert cache
  const cacheData = [
    { rootMalId: 1, data: JSON.stringify({ timeline: [1, 2, 3] }) }
  ];
  
  cacheData.forEach(cache => {
    insertCache.run(cache.rootMalId, cache.data, 1, now, now);
  });
}

async function populateLargeTestData(db: Database.Database, count: number): Promise<void> {
  const insertAnime = db.prepare(`
    INSERT INTO anime_info (mal_id, title, anime_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  
  const transaction = db.transaction(() => {
    for (let i = 100; i < 100 + count; i++) {
      insertAnime.run(i, `Large Test Anime ${i}`, 'tv', now, now);
    }
  });
  
  transaction();
}

function clearTestDatabase(db: Database.Database): void {
  db.exec('DELETE FROM timeline_cache');
  db.exec('DELETE FROM anime_relationships');
  db.exec('DELETE FROM user_watchlist');
  db.exec('DELETE FROM anime_info');
  db.exec('DELETE FROM sqlite_sequence');
}