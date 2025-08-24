/**
 * TimelineService - Main service for timeline generation
 * 
 * This service orchestrates timeline generation by integrating graph traversal
 * and chronological sorting. It provides the main interface for timeline 
 * operations in the application.
 */

import type { SeriesTimeline, AnimeInfo } from '../../types/timeline.js';
import { GraphTraversalEngine } from './graph-traversal-engine.js';
import { TimelineDatabase } from './timeline-database.js';

export class TimelineService {
  private graphTraversal: GraphTraversalEngine;
  private database: TimelineDatabase;

  constructor(database?: TimelineDatabase) {
    this.database = database || new TimelineDatabase();
    this.graphTraversal = new GraphTraversalEngine(this.database);
  }

  /**
   * Get complete timeline for an anime
   * Builds timeline fresh from database each time
   */
  async getAnimeTimeline(malId: number): Promise<SeriesTimeline> {
    try {
      console.log(`🔄 Building timeline for MAL ID ${malId}`);
      
      // Build timeline from database
      const timeline = await this.buildTimeline(malId);
      
      return timeline;
    } catch (error) {
      console.error(`Error getting timeline for MAL ID ${malId}:`, error);
      throw new Error(`Failed to generate timeline for anime ${malId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build timeline by traversing relationship graph
   * This is the core timeline generation logic
   */
  private async buildTimeline(rootMalId: number): Promise<SeriesTimeline> {
    try {
      // Verify the root anime exists
      const rootAnime = await this.database.getAnimeInfo(rootMalId);
      if (!rootAnime) {
        throw new Error(`Root anime with MAL ID ${rootMalId} not found in database`);
      }

      console.log(`🎯 Building timeline for: ${rootAnime.title}`);

      // Use graph traversal engine to generate complete timeline
      const timeline = await this.graphTraversal.generateTimeline(rootMalId);

      console.log(`✅ Generated timeline with ${timeline.totalEntries} entries (${timeline.mainTimelineCount} main entries)`);

      return timeline;
    } catch (error) {
      console.error(`Error building timeline for MAL ID ${rootMalId}:`, error);
      throw error;
    }
  }

  /**
   * No-op method for compatibility - timelines are always fresh from database
   */
  async invalidateTimeline(malId: number): Promise<void> {
    console.log(`ℹ️ Timeline invalidation not needed - timelines are always fresh from database for MAL ID ${malId}`);
  }

  /**
   * Refresh timeline - same as getAnimeTimeline since we always read from database
   */
  async refreshTimeline(malId: number): Promise<SeriesTimeline> {
    console.log(`🔄 Refreshing timeline for MAL ID ${malId}`);
    return this.getAnimeTimeline(malId);
  }

  /**
   * Get timeline status information
   * Checks if timeline can be generated for the anime
   */
  async getTimelineStatus(malId: number): Promise<{
    exists: boolean;
    cached: boolean;
    stale: boolean;
    lastUpdated: Date | null;
    entryCount: number;
    mainEntryCount: number;
  }> {
    try {
      // Check if the root anime exists in database
      const rootAnime = await this.database.getAnimeInfo(malId);
      if (!rootAnime) {
        return {
          exists: false,
          cached: false,
          stale: false,
          lastUpdated: null,
          entryCount: 0,
          mainEntryCount: 0
        };
      }

      // Generate timeline to get accurate counts
      const timeline = await this.buildTimeline(malId);
      
      return {
        exists: true,
        cached: false, // We don't cache anymore
        stale: false, // Always fresh
        lastUpdated: new Date(), // Always current
        entryCount: timeline.totalEntries,
        mainEntryCount: timeline.mainTimelineCount
      };
    } catch (error) {
      console.error(`Error getting timeline status for MAL ID ${malId}:`, error);
      return {
        exists: false,
        cached: false,
        stale: false,
        lastUpdated: null,
        entryCount: 0,
        mainEntryCount: 0
      };
    }
  }

  /**
   * Batch process multiple timelines
   * Generates timelines for multiple anime at once
   */
  async batchProcessTimelines(malIds: number[]): Promise<{
    successful: SeriesTimeline[];
    failed: { malId: number; error: string }[];
  }> {
    const successful: SeriesTimeline[] = [];
    const failed: { malId: number; error: string }[] = [];

    console.log(`📦 Batch processing ${malIds.length} timelines`);

    for (const malId of malIds) {
      try {
        const timeline = await this.getAnimeTimeline(malId);
        successful.push(timeline);
        console.log(`✅ Successfully processed timeline for MAL ID ${malId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ malId, error: errorMessage });
        console.error(`❌ Failed to process timeline for MAL ID ${malId}: ${errorMessage}`);
      }
    }

    console.log(`📊 Batch processing complete: ${successful.length} successful, ${failed.length} failed`);

    return { successful, failed };
  }

  /**
   * Get statistics - no caching so returns empty stats
   */
  async getCacheStatistics(): Promise<{
    totalCachedTimelines: number;
    staleTimelines: number;
    averageTimelineSize: number;
    oldestCache: Date | null;
    newestCache: Date | null;
  }> {
    return {
      totalCachedTimelines: 0,
      staleTimelines: 0,
      averageTimelineSize: 0,
      oldestCache: null,
      newestCache: null
    };
  }

  /**
   * No-op cleanup method for compatibility
   */
  async cleanupStaleCache(maxAgeHours: number = 24): Promise<number> {
    console.log(`ℹ️ No cache cleanup needed - timelines are always fresh from database`);
    return 0;
  }

  /**
   * Close database connections
   * Should be called when shutting down the service
   */
  close(): void {
    this.database.close();
  }
}