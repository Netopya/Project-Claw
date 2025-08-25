/**
 * GraphTraversalEngine - Handles anime relationship graph traversal and chronological sorting
 * 
 * This service implements breadth-first search with cycle detection to discover all related
 * anime in a series, then sorts them chronologically based on premiere dates, relationship
 * types, and episode counts.
 */

import type { 
  AnimeInfo, 
  AnimeRelationship, 
  TimelineEntry, 
  SeriesTimeline,
  RelationshipNode,
  GraphTraversalResult,
  ChronologicalSortCriteria,
  SortedTimelineEntry,
  RelationshipType,
  AnimeType
} from '../../types/timeline.js';
import { TimelineDatabase } from './timeline-database.js';

export class GraphTraversalEngine {
  private relationshipTypePriorities: Map<RelationshipType, number>;
  private animeTypePriorities: Map<AnimeType, number>;
  private database?: TimelineDatabase;

  constructor(database?: TimelineDatabase) {
    this.database = database;
    // Initialize relationship type priorities (lower number = higher priority)
    this.relationshipTypePriorities = new Map([
      ['prequel', 1],
      ['sequel', 2], 
      ['parent_story', 3],
      ['spin_off', 4],
      ['side_story', 5],
      ['alternative_version', 6],
      ['alternative_setting', 7],
      ['adaptation', 8],
      ['character', 9],
      ['summary', 10],
      ['full_story', 11],
      ['other', 12]
    ]);

    // Initialize anime type priorities for chronological sorting
    this.animeTypePriorities = new Map([
      ['tv', 1],
      ['movie', 2],
      ['ova', 3],
      ['special', 4],
      ['ona', 5],
      ['music', 6],
      ['unknown', 7]
    ]);
  }

  /**
   * Find all anime related to the given anime through relationship traversal
   * Uses breadth-first search with cycle detection
   */
  async findAllRelated(rootMalId: number): Promise<AnimeInfo[]> {
    const traversalResult = await this.performGraphTraversal(rootMalId);
    
    // Extract AnimeInfo from the traversal result
    const relatedAnime: AnimeInfo[] = [];
    for (const node of traversalResult.nodes.values()) {
      relatedAnime.push(node.animeInfo);
    }

    return relatedAnime;
  }

  /**
   * Perform complete graph traversal with cycle detection
   */
  async performGraphTraversal(rootMalId: number): Promise<GraphTraversalResult> {
    const visited = new Set<number>();
    const nodes = new Map<number, RelationshipNode>();
    const queue: number[] = [rootMalId];
    const visitedOrder: number[] = [];
    const cyclesDetected: number[][] = [];

    while (queue.length > 0) {
      const currentMalId = queue.shift()!;
      
      if (visited.has(currentMalId)) {
        continue; // Already processed
      }
      
      visited.add(currentMalId);
      visitedOrder.push(currentMalId);
      
      try {
        // Get anime info for current node
        const animeInfo = await this.getAnimeInfo(currentMalId);
        if (!animeInfo) {
          console.warn(`Could not find anime info for MAL ID: ${currentMalId}`);
          continue;
        }
        
        // Get all relationships for current anime
        const relationships = await this.getRelationships(currentMalId);
        
        // Create node
        const node: RelationshipNode = {
          malId: currentMalId,
          animeInfo,
          relationships
        };
        
        nodes.set(currentMalId, node);
        
        // Add related anime to queue for traversal (bidirectional)
        for (const relationship of relationships) {
          // Collect all connected anime IDs (both directions)
          const connectedIds: number[] = [];
          
          // If current anime is the source, add target
          if (relationship.sourceMalId === currentMalId) {
            connectedIds.push(relationship.targetMalId);
          }
          
          // If current anime is the target, add source
          if (relationship.targetMalId === currentMalId) {
            connectedIds.push(relationship.sourceMalId);
          }
          
          // Process each connected anime
          for (const connectedId of connectedIds) {
            if (visited.has(connectedId)) {
              // Back edge detected - this indicates a cycle
              // Find the cycle path by tracing back through visitedOrder
              const targetIndex = visitedOrder.indexOf(connectedId);
              const currentIndex = visitedOrder.indexOf(currentMalId);
              
              if (targetIndex !== -1 && currentIndex !== -1) {
                // Create cycle path: from target to current, then back to target
                const cyclePath = visitedOrder.slice(targetIndex, currentIndex + 1).concat([connectedId]);
                cyclesDetected.push(cyclePath);
              }
            } else if (!queue.includes(connectedId)) {
              queue.push(connectedId);
            }
          }
        }
        
      } catch (error) {
        console.error(`Error processing anime ${currentMalId}:`, error);
        // Continue with other anime even if one fails
      }
    }

    return {
      nodes,
      visitedOrder,
      cyclesDetected
    };
  }

  /**
   * Generate complete timeline with chronological sorting
   */
  async generateTimeline(rootMalId: number): Promise<SeriesTimeline> {
    // Get all related anime
    const relatedAnime = await this.findAllRelated(rootMalId);
    
    // Sort chronologically
    const sortedEntries = await this.chronologicalSort(relatedAnime, rootMalId);
    
    // Count main timeline entries (excluding side stories and alternatives)
    const mainTimelineCount = sortedEntries.filter(entry => entry.isMainEntry).length;
    
    return {
      rootMalId,
      entries: sortedEntries,
      totalEntries: sortedEntries.length,
      mainTimelineCount,
      lastUpdated: new Date()
    };
  }

  /**
   * Sort anime chronologically with intelligent prioritization
   */
  async chronologicalSort(animeList: AnimeInfo[], rootMalId: number): Promise<TimelineEntry[]> {
    // Create timeline entries with sort criteria
    const entriesWithCriteria: SortedTimelineEntry[] = animeList.map(anime => {
      const sortCriteria = this.calculateSortCriteria(anime);
      
      return {
        malId: anime.malId,
        title: anime.title,
        titleEnglish: anime.titleEnglish,
        animeType: anime.animeType,
        premiereDate: anime.premiereDate,
        numEpisodes: anime.numEpisodes,
        episodeDuration: anime.episodeDuration,
        chronologicalOrder: 0, // Will be set after sorting
        isMainEntry: this.isMainTimelineEntry(anime),
        relationshipPath: [], // TODO: Implement relationship path tracking
        sortCriteria
      };
    });

    // Sort using multiple criteria
    entriesWithCriteria.sort((a, b) => {
      // Primary sort: premiere date (earlier first)
      if (a.sortCriteria.premiereDate && b.sortCriteria.premiereDate) {
        const dateCompare = a.sortCriteria.premiereDate.getTime() - b.sortCriteria.premiereDate.getTime();
        if (dateCompare !== 0) return dateCompare;
      } else if (a.sortCriteria.premiereDate && !b.sortCriteria.premiereDate) {
        return -1; // Known date comes before unknown
      } else if (!a.sortCriteria.premiereDate && b.sortCriteria.premiereDate) {
        return 1; // Unknown date comes after known
      }
      
      // Secondary sort: relationship type priority (main story first)
      const relationshipCompare = a.sortCriteria.relationshipTypePriority - b.sortCriteria.relationshipTypePriority;
      if (relationshipCompare !== 0) return relationshipCompare;
      
      // Tertiary sort: main timeline entries first
      if (a.sortCriteria.isMainTimeline !== b.sortCriteria.isMainTimeline) {
        return a.sortCriteria.isMainTimeline ? -1 : 1;
      }
      
      // Quaternary sort: anime type priority (TV > Movie > OVA, etc.)
      const animeTypeA = this.animeTypePriorities.get(a.animeType) || 999;
      const animeTypeB = this.animeTypePriorities.get(b.animeType) || 999;
      const typeCompare = animeTypeA - animeTypeB;
      if (typeCompare !== 0) return typeCompare;
      
      // Final sort: episode count (longer series first for same date/type)
      const episodesA = a.sortCriteria.episodeCount;
      const episodesB = b.sortCriteria.episodeCount;
      return episodesB - episodesA;
    });

    // Assign chronological order and return as TimelineEntry[]
    return entriesWithCriteria.map((entry, index) => ({
      malId: entry.malId,
      title: entry.title,
      titleEnglish: entry.titleEnglish,
      animeType: entry.animeType,
      premiereDate: entry.premiereDate,
      numEpisodes: entry.numEpisodes,
      episodeDuration: entry.episodeDuration,
      chronologicalOrder: index + 1,
      isMainEntry: entry.isMainEntry,
      relationshipPath: entry.relationshipPath
    }));
  }

  /**
   * Calculate sort criteria for an anime
   */
  private calculateSortCriteria(anime: AnimeInfo): ChronologicalSortCriteria {
    return {
      premiereDate: anime.premiereDate,
      relationshipTypePriority: this.getRelationshipTypePriority(anime),
      episodeCount: anime.numEpisodes || 0,
      animeType: anime.animeType,
      isMainTimeline: this.isMainTimelineEntry(anime)
    };
  }

  /**
   * Determine if an anime is a main timeline entry vs side story
   */
  private isMainTimelineEntry(anime: AnimeInfo): boolean {
    // Main timeline entries are typically TV series and movies
    const mainTypes: AnimeType[] = ['tv', 'movie'];
    return mainTypes.includes(anime.animeType);
  }

  /**
   * Get relationship type priority for sorting
   * This is a simplified version - in a full implementation, this would
   * analyze the actual relationships to determine priority
   */
  private getRelationshipTypePriority(anime: AnimeInfo): number {
    // For now, prioritize based on anime type
    // In full implementation, this would analyze actual relationship data
    switch (anime.animeType) {
      case 'tv': return 1;
      case 'movie': return 2;
      case 'ova': return 3;
      case 'special': return 4;
      default: return 5;
    }
  }

  /**
   * Get anime information by MAL ID
   */
  private async getAnimeInfo(malId: number): Promise<AnimeInfo | null> {
    if (this.database) {
      return await this.database.getAnimeInfo(malId);
    }
    
    // Fallback for testing or when no database is provided
    console.warn(`No database provided for getAnimeInfo MAL ID: ${malId}`);
    return null;
  }

  /**
   * Get relationships for an anime by MAL ID
   */
  private async getRelationships(malId: number): Promise<AnimeRelationship[]> {
    if (this.database) {
      return await this.database.getRelationships(malId);
    }
    
    // Fallback for testing or when no database is provided
    console.warn(`No database provided for getRelationships MAL ID: ${malId}`);
    return [];
  }

  /**
   * Detect cycles in the relationship graph
   */
  detectCycles(traversalResult: GraphTraversalResult): number[][] {
    return traversalResult.cyclesDetected;
  }

  /**
   * Filter relationships by type
   */
  filterRelationshipsByType(
    relationships: AnimeRelationship[], 
    types: RelationshipType[]
  ): AnimeRelationship[] {
    return relationships.filter(rel => types.includes(rel.relationshipType));
  }

  /**
   * Get relationship type priority for sorting
   */
  getRelationshipTypePriorityValue(type: RelationshipType): number {
    return this.relationshipTypePriorities.get(type) || 999;
  }
}