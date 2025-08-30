import { db } from '../../db/connection.js';
import { animeInfo, userWatchlist, animeRelationships, timelineCache } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export interface DatabaseStats {
  animeInfo: number;
  userWatchlist: number;
  animeRelationships: number;
  timelineCache: number;
  total: number;
  lastUpdated: string;
}

export class StatisticsService {
  /**
   * Get comprehensive database statistics
   */
  async getDatabaseStatistics(): Promise<DatabaseStats> {
    try {
      // Count records in each table using efficient SQL COUNT queries
      const [
        animeInfoCount,
        userWatchlistCount,
        animeRelationshipsCount,
        timelineCacheCount
      ] = await Promise.all([
        this.getTableCount('anime_info'),
        this.getTableCount('user_watchlist'),
        this.getTableCount('anime_relationships'),
        this.getTableCount('timeline_cache')
      ]);

      const total = animeInfoCount + userWatchlistCount + animeRelationshipsCount + timelineCacheCount;

      return {
        animeInfo: animeInfoCount,
        userWatchlist: userWatchlistCount,
        animeRelationships: animeRelationshipsCount,
        timelineCache: timelineCacheCount,
        total,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting database statistics:', error);
      throw new Error('Failed to retrieve database statistics');
    }
  }

  /**
   * Get count of records in a specific table
   */
  private async getTableCount(tableName: string): Promise<number> {
    try {
      let result;
      switch (tableName) {
        case 'anime_info':
          result = await db.select({ count: sql<number>`count(*)` }).from(animeInfo);
          break;
        case 'user_watchlist':
          result = await db.select({ count: sql<number>`count(*)` }).from(userWatchlist);
          break;
        case 'anime_relationships':
          result = await db.select({ count: sql<number>`count(*)` }).from(animeRelationships);
          break;
        case 'timeline_cache':
          result = await db.select({ count: sql<number>`count(*)` }).from(timelineCache);
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }
      return result[0]?.count || 0;
    } catch (error) {
      console.error(`Error counting records in table ${tableName}:`, error);
      throw new Error(`Failed to count records in ${tableName}`);
    }
  }

  /**
   * Get detailed statistics with additional metadata
   */
  async getDetailedStatistics(): Promise<DatabaseStats & {
    breakdown: {
      watchlistByStatus: Record<string, number>;
      relationshipsByType: Record<string, number>;
    };
  }> {
    try {
      const baseStats = await this.getDatabaseStatistics();

      // Get watchlist breakdown by status
      const watchlistByStatusResult = await db
        .select({
          watchStatus: userWatchlist.watchStatus,
          count: sql<number>`count(*)`
        })
        .from(userWatchlist)
        .groupBy(userWatchlist.watchStatus);

      const watchlistByStatus: Record<string, number> = {};
      for (const row of watchlistByStatusResult) {
        watchlistByStatus[row.watchStatus] = row.count;
      }

      // Get relationships breakdown by type
      const relationshipsByTypeResult = await db
        .select({
          relationshipType: animeRelationships.relationshipType,
          count: sql<number>`count(*)`
        })
        .from(animeRelationships)
        .groupBy(animeRelationships.relationshipType);

      const relationshipsByType: Record<string, number> = {};
      for (const row of relationshipsByTypeResult) {
        relationshipsByType[row.relationshipType] = row.count;
      }

      return {
        ...baseStats,
        breakdown: {
          watchlistByStatus,
          relationshipsByType
        }
      };
    } catch (error) {
      console.error('Error getting detailed statistics:', error);
      throw new Error('Failed to retrieve detailed statistics');
    }
  }

  /**
   * Validate statistics accuracy by cross-checking with Drizzle ORM queries
   */
  async validateStatisticsAccuracy(): Promise<{
    isAccurate: boolean;
    discrepancies: string[];
  }> {
    try {
      const discrepancies: string[] = [];

      // Get statistics using raw SQL
      const rawStats = await this.getDatabaseStatistics();

      // Get counts using Drizzle ORM for validation
      const [
        drizzleAnimeInfoCount,
        drizzleUserWatchlistCount,
        drizzleAnimeRelationshipsCount,
        drizzleTimelineCacheCount
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(animeInfo).then(r => r[0].count),
        db.select({ count: sql<number>`count(*)` }).from(userWatchlist).then(r => r[0].count),
        db.select({ count: sql<number>`count(*)` }).from(animeRelationships).then(r => r[0].count),
        db.select({ count: sql<number>`count(*)` }).from(timelineCache).then(r => r[0].count)
      ]);

      // Compare counts
      if (rawStats.animeInfo !== drizzleAnimeInfoCount) {
        discrepancies.push(`anime_info: raw=${rawStats.animeInfo}, drizzle=${drizzleAnimeInfoCount}`);
      }
      if (rawStats.userWatchlist !== drizzleUserWatchlistCount) {
        discrepancies.push(`user_watchlist: raw=${rawStats.userWatchlist}, drizzle=${drizzleUserWatchlistCount}`);
      }
      if (rawStats.animeRelationships !== drizzleAnimeRelationshipsCount) {
        discrepancies.push(`anime_relationships: raw=${rawStats.animeRelationships}, drizzle=${drizzleAnimeRelationshipsCount}`);
      }
      if (rawStats.timelineCache !== drizzleTimelineCacheCount) {
        discrepancies.push(`timeline_cache: raw=${rawStats.timelineCache}, drizzle=${drizzleTimelineCacheCount}`);
      }

      return {
        isAccurate: discrepancies.length === 0,
        discrepancies
      };
    } catch (error) {
      console.error('Error validating statistics accuracy:', error);
      throw new Error('Failed to validate statistics accuracy');
    }
  }
}