/**
 * Qdrant Vector Database Client
 * 
 * Wrapper for Qdrant operations with graceful error handling
 * Supports semantic search, indexing, and collection management
 */

import { QdrantClient as QdrantSDK } from '@qdrant/js-client-rest';

/**
 * Qdrant configuration
 */
export interface QdrantConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Vector point for indexing
 */
export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

/**
 * Search result
 */
export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

/**
 * Collection configuration
 */
export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

/**
 * Qdrant Client Wrapper
 * 
 * Features:
 * - Connection management
 * - Collection creation and management
 * - Vector indexing (single and batch)
 * - Semantic search
 * - Graceful error handling
 */
export class QdrantClient {
  private client: QdrantSDK;
  private config: QdrantConfig;
  private isConnected: boolean = false;

  constructor(config: QdrantConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      ...config,
    };

    this.client = new QdrantSDK({
      url: this.config.url,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
    });
  }

  /**
   * Check if Qdrant is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.getCollections();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      console.warn('Qdrant health check failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Create a collection
   */
  async createCollection(config: CollectionConfig): Promise<void> {
    try {
      // Check if collection already exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === config.name);

      if (exists) {
        console.log(`Collection already exists: ${config.name}`);
        return;
      }

      // Create collection
      await this.client.createCollection(config.name, {
        vectors: {
          size: config.vectorSize,
          distance: config.distance,
        },
      });

      console.log(`✅ Collection created: ${config.name}`);
    } catch (error) {
      console.error(`Failed to create collection ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection(collectionName);
      console.log(`Collection deleted: ${collectionName}`);
    } catch (error) {
      console.error(`Failed to delete collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some((c) => c.name === collectionName);
    } catch (error) {
      console.error('Failed to check collection existence:', error);
      return false;
    }
  }

  /**
   * Index a single vector point
   */
  async indexPoint(
    collectionName: string,
    point: VectorPoint
  ): Promise<void> {
    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector,
            payload: point.payload || {},
          },
        ],
      });
    } catch (error) {
      console.error('Failed to index point:', error);
      throw error;
    }
  }

  /**
   * Index multiple vector points (batch)
   */
  async indexPoints(
    collectionName: string,
    points: VectorPoint[]
  ): Promise<void> {
    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload || {},
        })),
      });

      console.log(`✅ Indexed ${points.length} points to ${collectionName}`);
    } catch (error) {
      console.error('Failed to index points:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(
    collectionName: string,
    queryVector: number[],
    limit: number = 20,
    scoreThreshold?: number
  ): Promise<SearchResult[]> {
    try {
      const results = await this.client.search(collectionName, {
        vector: queryVector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
      });

      return results.map((r) => ({
        id: r.id,
        score: r.score,
        payload: r.payload || undefined,
      }));
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName: string): Promise<any> {
    try {
      return await this.client.getCollection(collectionName);
    } catch (error) {
      console.error('Failed to get collection info:', error);
      throw error;
    }
  }

  /**
   * Count points in collection
   */
  async countPoints(collectionName: string): Promise<number> {
    try {
      const info = await this.client.getCollection(collectionName);
      return info.points_count || 0;
    } catch (error) {
      console.error('Failed to count points:', error);
      return 0;
    }
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(
    collectionName: string,
    pointIds: (string | number)[]
  ): Promise<void> {
    try {
      await this.client.delete(collectionName, {
        wait: true,
        points: pointIds,
      });

      console.log(`Deleted ${pointIds.length} points from ${collectionName}`);
    } catch (error) {
      console.error('Failed to delete points:', error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  close(): void {
    // Qdrant client doesn't require explicit closing
    this.isConnected = false;
  }
}

/**
 * Create Qdrant client with default configuration
 */
export function createQdrantClient(config?: Partial<QdrantConfig>): QdrantClient {
  const defaultConfig: QdrantConfig = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    timeout: 30000,
  };

  return new QdrantClient({ ...defaultConfig, ...config });
}
