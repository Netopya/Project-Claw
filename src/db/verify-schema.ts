#!/usr/bin/env node

/**
 * Database Schema Verification Script
 * 
 * This script verifies that the database schema was created correctly.
 */

import Database from 'better-sqlite3';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/anime.db';

function verifyDatabaseSchema() {
  console.log('🔍 Verifying database schema...');
  console.log(`📁 Database path: ${DATABASE_PATH}`);
  
  try {
    const sqlite = new Database(DATABASE_PATH);
    
    // Get all tables
    const tables = sqlite.prepare(`
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('\n📋 Database Tables:');
    tables.forEach((table: any) => {
      console.log(`\n🔸 ${table.name}:`);
      console.log(table.sql);
    });
    
    // Get all indexes
    const indexes = sqlite.prepare(`
      SELECT name, sql FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('\n🔍 Database Indexes:');
    indexes.forEach((index: any) => {
      console.log(`\n🔹 ${index.name}:`);
      console.log(index.sql);
    });
    
    // Verify expected tables exist
    const expectedTables = ['anime_info', 'user_watchlist', 'anime_relationships', 'timeline_cache'];
    const actualTables = tables.map((t: any) => t.name);
    
    console.log('\n✅ Schema Verification:');
    expectedTables.forEach(tableName => {
      if (actualTables.includes(tableName)) {
        console.log(`✅ ${tableName} - EXISTS`);
      } else {
        console.log(`❌ ${tableName} - MISSING`);
      }
    });
    
    // Verify expected indexes exist
    const expectedIndexes = [
      'idx_anime_info_mal_id',
      'idx_user_watchlist_anime_info_id', 
      'idx_user_watchlist_priority',
      'idx_anime_relationships_source',
      'idx_anime_relationships_target',
      'idx_anime_relationships_type',
      'idx_timeline_cache_root'
    ];
    const actualIndexes = indexes.map((i: any) => i.name);
    
    console.log('\n🔍 Index Verification:');
    expectedIndexes.forEach(indexName => {
      if (actualIndexes.includes(indexName)) {
        console.log(`✅ ${indexName} - EXISTS`);
      } else {
        console.log(`❌ ${indexName} - MISSING`);
      }
    });
    
    sqlite.close();
    console.log('\n🎉 Schema verification completed!');
    
  } catch (error) {
    console.error('❌ Failed to verify database schema:', error);
    process.exit(1);
  }
}

// ES module equivalent of require.main === module
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  verifyDatabaseSchema();
}

export { verifyDatabaseSchema };