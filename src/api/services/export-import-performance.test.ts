import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExportService } from './export-service.js';
import { ImportExecutionService } from './import-execution-service.js';
import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import type { ExportData, ImportOptions } from '../../types/export-import.js';

describe('Export/Import Performance Tests', () => {
  let exportService: ExportService;
  let importService: ImportExecutionService;

  beforeEach(() => {
    exportService = new ExportService();
    importService = new ImportExecutionService();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(timelineCache);
    await db.delete(animeRelationships);
    await db.delete(userWatchlist);
    await db.delete(animeInfo);
  });

  describe('Large Dataset Export Performance', () => {
    it('should handle export of 3,000 anime records efficiently', async () => {
      // Generate large dataset
      const largeDataset = generateLargeAnimeDataset(3000);
      
      // Insert test data in batches to avoid SQLite variable limits
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      const startTime = Date.now();
      const exportData = await exportService.exportAllData();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      console.log(`Export of 3,000 records took ${executionTime}ms`);

      expect(exportData.data.animeInfo).toHaveLength(3000);
      expect(executionTime).toBeLessThan(20000); // Should complete within 20 seconds
    }, 60000); // 60 second timeout

    it('should use batch processing for large datasets', async () => {
      // Generate dataset larger than STREAM_THRESHOLD (5000)
      const largeDataset = generateLargeAnimeDataset(6000);
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      // Mock console.log to capture batch processing messages
      const consoleLogs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => {
        consoleLogs.push(message);
        originalLog(message);
      };

      try {
        await exportService.exportAllData();
        
        // Check that batch processing was used
        const batchMessages = consoleLogs.filter(log => 
          log.includes('batch') || log.includes('Batch extraction')
        );
        expect(batchMessages.length).toBeGreaterThan(0);
      } finally {
        console.log = originalLog;
      }
    }, 60000);

    it('should generate streaming export for very large datasets', async () => {
      // Generate dataset larger than STREAM_THRESHOLD
      const largeDataset = generateLargeAnimeDataset(6000);
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      const startTime = Date.now();
      const stream = await exportService.generateStreamingExport();
      
      // Consume the stream
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      const fullData = Buffer.concat(chunks).toString();
      const parsedData = JSON.parse(fullData);

      console.log(`Streaming export of 6,000 records took ${executionTime}ms`);
      
      expect(parsedData.data.animeInfo).toHaveLength(6000);
      expect(executionTime).toBeLessThan(45000); // Should complete within 45 seconds
    }, 90000);
  });

  describe('Large Dataset Import Performance', () => {
    it('should handle import of 5,000 anime records efficiently', async () => {
      // Generate large export data
      const largeDataset = generateLargeAnimeDataset(5000);
      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 5000,
          checksum: 'test-checksum',
          application: {
            name: 'Test',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: largeDataset,
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: false,
        clearCache: false
      };

      const startTime = Date.now();
      const result = await importService.executeImport(exportData, importOptions);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      console.log(`Import of 5,000 records took ${executionTime}ms`);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(5000);
      expect(executionTime).toBeLessThan(60000); // Should complete within 60 seconds
    }, 120000);

    it('should use batch processing for large import datasets', async () => {
      // Generate dataset larger than LARGE_DATASET_THRESHOLD (2000)
      const largeDataset = generateLargeAnimeDataset(3000);
      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 3000,
          checksum: 'test-checksum',
          application: {
            name: 'Test',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: largeDataset,
          userWatchlist: [],
          animeRelationships: [],
          timelineCache: []
        }
      };

      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: false,
        clearCache: false
      };

      // Mock console.log to capture batch processing messages
      const consoleLogs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => {
        consoleLogs.push(message);
        originalLog(message);
      };

      try {
        const result = await importService.executeImport(exportData, importOptions);
        
        expect(result.success).toBe(true);
        
        // Check that batch processing was used
        const batchMessages = consoleLogs.filter(log => 
          log.includes('batch processing') || log.includes('Processed anime info batch')
        );
        expect(batchMessages.length).toBeGreaterThan(0);
      } finally {
        console.log = originalLog;
      }
    }, 120000);

    it('should handle complex dataset with relationships efficiently', async () => {
      // Generate complex dataset with relationships
      const animeDataset = generateLargeAnimeDataset(2000);
      const relationshipDataset = generateAnimeRelationships(animeDataset, 1000);
      const watchlistDataset = generateUserWatchlist(animeDataset, 1500);

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 4500,
          checksum: 'test-checksum',
          application: {
            name: 'Test',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: animeDataset,
          userWatchlist: watchlistDataset,
          animeRelationships: relationshipDataset,
          timelineCache: []
        }
      };

      const importOptions: ImportOptions = {
        mode: 'replace',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const startTime = Date.now();
      const result = await importService.executeImport(exportData, importOptions);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      console.log(`Complex import of 4,500 records took ${executionTime}ms`);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.animeInfo).toBe(2000);
      expect(result.recordsProcessed.userWatchlist).toBe(1500);
      expect(result.recordsProcessed.animeRelationships).toBe(1000);
      expect(executionTime).toBeLessThan(90000); // Should complete within 90 seconds
    }, 180000);
  });

  describe('Memory Usage Optimization', () => {
    it('should not exceed memory limits during large export', async () => {
      // Generate large dataset
      const largeDataset = generateLargeAnimeDataset(4000);
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      // Monitor memory usage
      const initialMemory = process.memoryUsage();
      
      await exportService.exportAllData();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase during export: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      
      // Memory increase should be reasonable (less than 200MB for 4000 records)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    }, 120000);

    it('should handle streaming export with minimal memory footprint', async () => {
      // Generate very large dataset
      const largeDataset = generateLargeAnimeDataset(5000);
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      const initialMemory = process.memoryUsage();
      
      const stream = await exportService.generateStreamingExport();
      
      // Consume stream in chunks to simulate real usage
      let totalSize = 0;
      for await (const chunk of stream) {
        totalSize += chunk.length;
        
        // Check memory periodically
        const currentMemory = process.memoryUsage();
        const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory should not grow excessively during streaming
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
      
      console.log(`Streamed ${Math.round(totalSize / 1024 / 1024)}MB of data`);
      expect(totalSize).toBeGreaterThan(0);
    }, 180000);
  });

  describe('Database Query Optimization', () => {
    it('should use efficient queries for batch extraction', async () => {
      // Generate dataset that will trigger batch processing
      const largeDataset = generateLargeAnimeDataset(6000);
      await insertDataInBatches(largeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      // Time the extraction
      const startTime = Date.now();
      const data = await exportService.extractAllData();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      console.log(`Batch extraction of 6,000 records took ${executionTime}ms`);

      expect(data.animeInfo).toHaveLength(6000);
      // Should be faster than 15 seconds for 6000 records
      expect(executionTime).toBeLessThan(15000);
    }, 60000);

    it('should optimize foreign key validation during import', async () => {
      // Generate dataset with many relationships
      const animeDataset = generateLargeAnimeDataset(1000);
      const relationshipDataset = generateAnimeRelationships(animeDataset, 2000);

      // First import anime data in batches
      await insertDataInBatches(animeDataset, async (batch) => {
        await db.insert(animeInfo).values(batch);
      });

      const exportData: ExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          totalRecords: 2000,
          checksum: 'test-checksum',
          application: {
            name: 'Test',
            version: '1.0.0'
          }
        },
        data: {
          animeInfo: [],
          userWatchlist: [],
          animeRelationships: relationshipDataset,
          timelineCache: []
        }
      };

      const importOptions: ImportOptions = {
        mode: 'merge',
        handleDuplicates: 'update',
        validateRelationships: true,
        clearCache: false
      };

      const startTime = Date.now();
      const result = await importService.executeImport(exportData, importOptions);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      console.log(`Relationship import with validation took ${executionTime}ms`);

      expect(result.success).toBe(true);
      // Should complete validation efficiently
      expect(executionTime).toBeLessThan(20000);
    }, 90000);
  });
});

// Helper functions for generating test data
function generateLargeAnimeDataset(count: number) {
  const dataset = [];
  for (let i = 1; i <= count; i++) {
    dataset.push({
      malId: i,
      title: `Test Anime ${i}`,
      titleEnglish: `Test Anime ${i} (English)`,
      titleJapanese: `テストアニメ${i}`,
      imageUrl: `https://example.com/image${i}.jpg`,
      rating: Math.random() * 10,
      premiereDate: '2023-01-01',
      numEpisodes: Math.floor(Math.random() * 50) + 1,
      episodeDuration: 24,
      animeType: 'TV',
      status: 'finished_airing',
      source: 'manga',
      studios: JSON.stringify([`Studio ${i % 10}`]),
      genres: JSON.stringify(['Action', 'Adventure']),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return dataset;
}

// Helper function to insert data in batches to avoid SQLite variable limits
async function insertDataInBatches<T>(data: T[], insertFn: (batch: T[]) => Promise<any>, batchSize = 500) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await insertFn(batch);
  }
}

function generateAnimeRelationships(animeDataset: any[], count: number) {
  const relationships = [];
  for (let i = 0; i < count; i++) {
    const sourceIndex = Math.floor(Math.random() * animeDataset.length);
    let targetIndex = Math.floor(Math.random() * animeDataset.length);
    
    // Ensure source and target are different
    while (targetIndex === sourceIndex) {
      targetIndex = Math.floor(Math.random() * animeDataset.length);
    }

    relationships.push({
      id: i + 1,
      sourceMalId: animeDataset[sourceIndex].malId,
      targetMalId: animeDataset[targetIndex].malId,
      relationshipType: ['sequel', 'prequel', 'side_story', 'alternative_version'][Math.floor(Math.random() * 4)],
      createdAt: new Date().toISOString()
    });
  }
  return relationships;
}

function generateUserWatchlist(animeDataset: any[], count: number) {
  const watchlist = [];
  const usedAnimeIds = new Set();
  
  for (let i = 0; i < count && i < animeDataset.length; i++) {
    let animeIndex = Math.floor(Math.random() * animeDataset.length);
    
    // Ensure no duplicates in watchlist
    while (usedAnimeIds.has(animeIndex)) {
      animeIndex = Math.floor(Math.random() * animeDataset.length);
    }
    usedAnimeIds.add(animeIndex);

    watchlist.push({
      id: i + 1,
      animeInfoId: animeDataset[animeIndex].malId, // Using malId as reference for simplicity
      priority: Math.floor(Math.random() * 10) + 1,
      watchStatus: ['plan_to_watch', 'watching', 'completed', 'dropped', 'on_hold'][Math.floor(Math.random() * 5)],
      userRating: Math.random() * 10,
      notes: `Test notes for anime ${i + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return watchlist;
}