/**
 * Hive Mind Collections Configuration
 * 
 * Defines the 5 collections for TCAM Hive Mind (L3):
 * - tcam_hive_truths: Extracted facts and truths
 * - tcam_hive_wisdom: High-level insights and patterns
 * - tcam_hive_patterns: Recurring patterns and behaviors
 * - tcam_hive_whispers: Subtle observations and hunches
 * - tcam_hive_tools: Autopoietic tool registry
 */

import { QdrantClient, CollectionConfig } from './QdrantClient';

/**
 * Hive Mind collection names
 */
export const HIVE_COLLECTIONS = {
  TRUTHS: 'tcam_hive_truths',
  WISDOM: 'tcam_hive_wisdom',
  PATTERNS: 'tcam_hive_patterns',
  WHISPERS: 'tcam_hive_whispers',
  TOOLS: 'tcam_hive_tools',
} as const;

/**
 * Collection configurations
 * All use 768-dimensional vectors (nomic-embed-text)
 * All use Cosine distance for semantic similarity
 */
export const HIVE_COLLECTION_CONFIGS: CollectionConfig[] = [
  {
    name: HIVE_COLLECTIONS.TRUTHS,
    vectorSize: 768,
    distance: 'Cosine',
  },
  {
    name: HIVE_COLLECTIONS.WISDOM,
    vectorSize: 768,
    distance: 'Cosine',
  },
  {
    name: HIVE_COLLECTIONS.PATTERNS,
    vectorSize: 768,
    distance: 'Cosine',
  },
  {
    name: HIVE_COLLECTIONS.WHISPERS,
    vectorSize: 768,
    distance: 'Cosine',
  },
  {
    name: HIVE_COLLECTIONS.TOOLS,
    vectorSize: 768,
    distance: 'Cosine',
  },
];

/**
 * Initialize all Hive Mind collections
 */
export async function initializeHiveMind(client: QdrantClient): Promise<void> {
  console.log('🧠 Initializing Hive Mind collections...');

  for (const config of HIVE_COLLECTION_CONFIGS) {
    try {
      await client.createCollection(config);
    } catch (error) {
      console.error(`Failed to create collection ${config.name}:`, error);
      throw error;
    }
  }

  console.log('✅ All Hive Mind collections initialized');
}

/**
 * Check if all Hive Mind collections exist
 */
export async function checkHiveMindCollections(client: QdrantClient): Promise<boolean> {
  for (const config of HIVE_COLLECTION_CONFIGS) {
    const exists = await client.collectionExists(config.name);
    if (!exists) {
      console.warn(`Collection missing: ${config.name}`);
      return false;
    }
  }
  return true;
}

/**
 * Delete all Hive Mind collections (for testing/cleanup)
 */
export async function deleteHiveMindCollections(client: QdrantClient): Promise<void> {
  console.log('🗑️  Deleting Hive Mind collections...');

  for (const config of HIVE_COLLECTION_CONFIGS) {
    try {
      await client.deleteCollection(config.name);
    } catch (error) {
      // Ignore if collection doesn't exist
      console.warn(`Could not delete ${config.name}:`, (error as Error).message);
    }
  }

  console.log('✅ Hive Mind collections deleted');
}

/**
 * Get collection stats for all Hive Mind collections
 */
export async function getHiveMindStats(client: QdrantClient): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};

  for (const config of HIVE_COLLECTION_CONFIGS) {
    try {
      const count = await client.countPoints(config.name);
      stats[config.name] = count;
    } catch (error) {
      stats[config.name] = 0;
    }
  }

  return stats;
}
