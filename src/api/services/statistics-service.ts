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
      console.log('Starting database statistics collection...');
      
      // Count records in each table using efficient SQL COUNT queries
      console.log('Executing parallel table count queries...');
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

      console.log('All table counts retrieved successfully');
      const total = animeInfoCount + userWatchlistCount + animeRelationshipsCount + timelineCacheCount;

      const stats = {
        animeInfo: animeInfoCount,
        userWatchlist: userWatchlistCount,
        animeRelationships: animeRelationshipsCount,
        timelineCache: timelineCacheCount,
        total,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('Database statistics:', stats);
      return stats;
    } catch (error: any) {
      console.error('Error getting database statistics:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      throw new Error(`Failed to retrieve database statistics: ${error?.message}`);
    }
  }

  /**
   * Get count of records in a specific table
   */
  private async getTableCount(tableName: string): Promise<number> {
    try {
      console.log(`Getting count for table: ${tableName}`);
      let result: any[];
      
      switch (tableName) {
        case 'anime_info':
          console.log('Querying anime_info table...');
          result = await db.select({ count: sql`count(*)` }).from(animeInfo);
          console.log('anime_info result:', result);
          break;
        case 'user_watchlist':
          console.log('Querying user_watchlist table...');
          result = await db.select({ count: sql`count(*)` }).from(userWatchlist);
          console.log('user_watchlist result:', result);
          break;
        case 'anime_relationships':
          console.log('Querying anime_relationships table...');
          result = await db.select({ count: sql`count(*)` }).from(animeRelationships);
          console.log('anime_relationships result:', result);
          break;
        case 'timeline_cache':
          console.log('Querying timeline_cache table...');
          result = await db.select({ count: sql`count(*)` }).from(timelineCache);
          console.log('timeline_cache result:', result);
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }
      
      const count = Number(result[0]?.count) || 0;
      console.log(`Table ${tableName} count: ${count}`);
      return count;
    } catch (error: any) {
      console.error(`Error counting records in table ${tableName}:`, error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      throw new Error(`Failed to count records in ${tableName}: ${error?.message}`);
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
          count: sql`count(*)`
        })
        .from(userWatchlist)
        .groupBy(userWatchlist.watchStatus);

      const watchlistByStatus: Record<string, number> = {};
      for (const row of watchlistByStatusResult) {
        watchlistByStatus[row.watchStatus] = Number(row.count);
      }

      // Get relationships breakdown by type
      const relationshipsByTypeResult = await db
        .select({
          relationshipType: animeRelationships.relationshipType,
          count: sql`count(*)`
        })
        .from(animeRelationships)
        .groupBy(animeRelationships.relationshipType);

      const relationshipsByType: Record<string, number> = {};
      for (const row of relationshipsByTypeResult) {
        relationshipsByType[row.relationshipType] = Number(row.count);
      }

      return {
        ...baseStats,
        breakdown: {
          watchlistByStatus,
          relationshipsByType
        }
      };
    } catch (error: any) {
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
        db.select({ count: sql`count(*)` }).from(animeInfo).then((r: any) => Number(r[0].count)),
        db.select({ count: sql`count(*)` }).from(userWatchlist).then((r: any) => Number(r[0].count)),
        db.select({ count: sql`count(*)` }).from(animeRelationships).then((r: any) => Number(r[0].count)),
        db.select({ count: sql`count(*)` }).from(timelineCache).then((r: any) => Number(r[0].count))
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
    } catch (error: any) {
      console.error('Error validating statistics accuracy:', error);
      throw new Error('Failed to validate statistics accuracy');
    }
  }
}