import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';

/**
 * Configuration for Ollama LLM client
 */
export interface OllamaClientConfig {
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  temperature?: number;
  timeout?: number;
}

/**
 * Ollama client wrapper for TCAM Memory System
 * 
 * Provides two clients:
 * - LLM client (Qwen 3.5) for fact extraction, Chronicle formatting
 * - Embedding client (nomic-embed-text) for semantic search
 */
export class OllamaClient {
  private llm: ChatOllama;
  private embeddings: OllamaEmbeddings;
  private config: Required<OllamaClientConfig>;

  constructor(config: OllamaClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'qwen3.5:latest',
      embeddingModel: config.embeddingModel || 'nomic-embed-text',
      temperature: config.temperature ?? 0.3,
      timeout: config.timeout || 30000,
    };

    // Initialize LLM client (Qwen 3.5)
    this.llm = new ChatOllama({
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      temperature: this.config.temperature,
    });

    // Initialize embedding client (Nomic)
    this.embeddings = new OllamaEmbeddings({
      baseUrl: this.config.baseUrl,
      model: this.config.embeddingModel,
    });
  }

  /**
   * Get LLM client for text generation tasks
   * Use for: fact extraction, Chronicle formatting, reasoning
   */
  getLLM(): ChatOllama {
    return this.llm;
  }

  /**
   * Get embedding client for vector generation
   * Use for: Hive Mind indexing, semantic search
   */
  getEmbeddings(): OllamaEmbeddings {
    return this.embeddings;
  }

  /**
   * Invoke LLM with a prompt
   * Automatically adds "Answer directly" prefix for memory tasks
   */
  async invoke(prompt: string, options?: { reasoning?: boolean }): Promise<string> {
    const reasoning = options?.reasoning ?? false;
    
    const finalPrompt = reasoning
      ? prompt
      : `Answer directly without showing thinking process.\n\n${prompt}`;

    const response = await this.llm.invoke(finalPrompt);
    return response.content.toString();
  }

  /**
   * Generate embeddings for a text
   * Returns 768-dimensional vector
   */
  async embed(text: string): Promise<number[]> {
    const vectors = await this.embeddings.embedQuery(text);
    return vectors;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const vectors = await this.embeddings.embedDocuments(texts);
    return vectors;
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.invoke('Hello', { reasoning: false });
      return true;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }
}
