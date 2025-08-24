/**
 * Database access layer for timeline-related operations
 * 
 * This service provides database queries for anime_info, anime_relationships,
 * and timeline_cache tables used by the GraphTraversalEngine.
 */

import Database from 'better-sqlite3';
import type { 
  AnimeInfo, 
  AnimeRelationship, 
  SeriesTimeline,
  AnimeType,
  AnimeStatus,
  RelationshipType 
} from '../../types/timeline.js';

export class TimelineDatabase {
  private db: Database.Database;

  constructor(databasePathOrInstance: string | Database.Database = process.env.DATABASE_PATH || './data/anime.db') {
    if (typeof databasePathOrInstance === 'string') {
      this.db = new Database(databasePathOrInstance);
      this.db.pragma('journal_mode = WAL');
    } else {
      this.db = databasePathOrInstance;
    }
  }

  /**
   * Get anime information by MAL ID
   */
  async getAnimeInfo(malId: number): Promise<AnimeInfo | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM anime_info WHERE mal_id = ?
      `);
      
      const row = stmt.get(malId) as any;
      
      if (!row) {
        return null;
      }

      return this.transformAnimeInfoFromDb(row);
    } catch (error) {
      console.error(`Error fetching anime info for MAL ID ${malId}:`, error);
      return null;
    }
  }

  /**
   * Get all relationships for an anime by MAL ID
   */
  async getRelationships(malId: number): Promise<AnimeRelationship[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM anime_relationships 
        WHERE source_mal_id = ? OR target_mal_id = ?
      `);
      
      const rows = stmt.all(malId, malId) as any[];
      
      return rows.map(row => this.transformRelationshipFromDb(row));
    } catch (error) {
      console.error(`Error fetching relationships for MAL ID ${malId}:`, error);
      return [];
    }
  }

  /**
   * Store anime information
   */
  async storeAnimeInfo(animeInfo: Omit<AnimeInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnimeInfo> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO anime_info (
          mal_id, title, title_english, title_japanese, image_url, rating,
          premiere_date, num_episodes, episode_duration, anime_type, status,
          source, studios, genres, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(
        animeInfo.malId,
        animeInfo.title,
        animeInfo.titleEnglish,
        animeInfo.titleJapanese,
        animeInfo.imageUrl,
        animeInfo.rating,
        animeInfo.premiereDate?.toISOString(),
        animeInfo.numEpisodes,
        animeInfo.episodeDuration,
        animeInfo.animeType,
        animeInfo.status,
        animeInfo.source,
        JSON.stringify(animeInfo.studios),
        JSON.stringify(animeInfo.genres)
      );

      // Fetch the inserted/updated record
      const insertedAnime = await this.getAnimeInfo(animeInfo.malId);
      if (!insertedAnime) {
        throw new Error('Failed to retrieve stored anime info');
      }

      return insertedAnime;
    } catch (error) {
      console.error(`Error storing anime info for MAL ID ${animeInfo.malId}:`, error);
      throw error;
    }
  }

  /**
   * Store anime relationship
   */
  async storeRelationship(relationship: Omit<AnimeRelationship, 'id' | 'createdAt'>): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO anime_relationships (
          source_mal_id, target_mal_id, relationship_type
        ) VALUES (?, ?, ?)
      `);

      stmt.run(
        relationship.sourceMalId,
        relationship.targetMalId,
        relationship.relationshipType
      );
    } catch (error) {
      console.error(`Error storing relationship:`, error);
      throw error;
    }
  }



  /**
   * Transform database row to AnimeInfo
   */
  private transformAnimeInfoFromDb(row: any): AnimeInfo {
    return {
      id: row.id,
      malId: row.mal_id,
      title: row.title,
      titleEnglish: row.title_english,
      titleJapanese: row.title_japanese,
      imageUrl: row.image_url,
      rating: row.rating,
      premiereDate: row.premiere_date ? new Date(row.premiere_date) : null,
      numEpisodes: row.num_episodes,
      episodeDuration: row.episode_duration,
      animeType: row.anime_type as AnimeType,
      status: row.status as AnimeStatus,
      source: row.source,
      studios: row.studios ? JSON.parse(row.studios) : [],
      genres: row.genres ? JSON.parse(row.genres) : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Transform database row to AnimeRelationship
   */
  private transformRelationshipFromDb(row: any): AnimeRelationship {
    return {
      id: row.id,
      sourceMalId: row.source_mal_id,
      targetMalId: row.target_mal_id,
      relationshipType: row.relationship_type as RelationshipType,
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}