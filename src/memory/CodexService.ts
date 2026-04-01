/**
 * CodexService - L4 Memory Layer
 * 
 * Agent Codex (Personal Knowledge Base)
 * Each agent (Ubik, Axiom) has its own private knowledge base
 * 
 * Features:
 * - Per-agent directory structure
 * - Standard files: README, TASKS, DIARY, NOTES, CONTEXT, TOOLS
 * - Agent isolation (agents can only access their own codex)
 * - Git versioning for all updates
 * - Graceful error handling
 */

import { Service } from '../core/types';
import {
  AgentNode,
  CodexFile,
  CodexUpdate,
  AgentCodex,
} from '../codex/types';
import {
  initializeNodeCodex,
  initializeAllCodex,
  isCodexInitialized,
} from '../codex/initializer';
import {
  loadAgentCodex,
  loadCodexFile,
  codexFileExists,
} from '../codex/loader';
import {
  updateAgentCodex,
  batchUpdateCodex,
  getCachedUpdates,
  clearCachedUpdates,
  flushCachedUpdates,
} from '../codex/updater';

export interface CodexServiceConfig {
  autoInitialize?: boolean;
}

export class CodexService implements Service {
  name = 'CodexService';
  private initialized = false;
  private config: CodexServiceConfig;

  constructor(config?: CodexServiceConfig) {
    this.config = {
      autoInitialize: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.autoInitialize) {
      // Check if codex directories exist
      const ubikInitialized = await isCodexInitialized('ubik');
      const axiomInitialized = await isCodexInitialized('axiom');

      if (!ubikInitialized || !axiomInitialized) {
        console.log('Initializing Agent Codex directories...');
        await initializeAllCodex();
      }
    }

    this.initialized = true;
    console.log('✓ CodexService initialized');
  }

  async shutdown(): Promise<void> {
    // Flush any cached updates before shutdown
    const cachedCount = getCachedUpdates().size;
    if (cachedCount > 0) {
      console.log(`Flushing ${cachedCount} cached Codex updates...`);
      await flushCachedUpdates();
    }

    this.initialized = false;
    console.log('✓ CodexService shutdown');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Check if both agent codex directories are initialized
      const ubikInitialized = await isCodexInitialized('ubik');
      const axiomInitialized = await isCodexInitialized('axiom');

      return ubikInitialized && axiomInitialized;
    } catch {
      return false;
    }
  }

  /**
   * Initialize codex for a specific agent
   */
  async init(node: AgentNode): Promise<void> {
    this.ensureInitialized();

    const alreadyInitialized = await isCodexInitialized(node);
    if (alreadyInitialized) {
      console.log(`Codex already initialized for ${node}`);
      return;
    }

    await initializeNodeCodex(node);
  }

  /**
   * Read entire codex for an agent
   */
  async read(node: AgentNode): Promise<AgentCodex> {
    this.ensureInitialized();
    return await loadAgentCodex(node);
  }

  /**
   * Read specific codex file
   */
  async readFile(node: AgentNode, file: CodexFile): Promise<string> {
    this.ensureInitialized();
    return await loadCodexFile(node, file);
  }

  /**
   * Write/update codex file
   */
  async write(update: CodexUpdate): Promise<void> {
    this.ensureInitialized();
    await updateAgentCodex(update);
  }

  /**
   * Batch update multiple codex files
   */
  async batchWrite(
    node: AgentNode,
    updates: Array<Omit<CodexUpdate, 'node'>>,
    commitMessage: string
  ): Promise<void> {
    this.ensureInitialized();
    await batchUpdateCodex(node, updates, commitMessage);
  }

  /**
   * List all codex files for an agent
   */
  async list(node: AgentNode): Promise<CodexFile[]> {
    this.ensureInitialized();

    const files: CodexFile[] = [
      'README.md',
      'TASKS.md',
      'SYNTHETIC-DIARY.md',
      'NOTES.md',
      'CONTEXT.md',
      'TOOLS.md',
    ];

    // Filter to only existing files
    const existingFiles: CodexFile[] = [];
    for (const file of files) {
      const exists = await codexFileExists(node, file);
      if (exists) {
        existingFiles.push(file);
      }
    }

    return existingFiles;
  }

  /**
   * Check if codex is initialized for an agent
   */
  async isInitialized(node: AgentNode): Promise<boolean> {
    return await isCodexInitialized(node);
  }

  /**
   * Get cached updates (for disk full recovery)
   */
  getCachedUpdates(): Map<string, CodexUpdate> {
    return getCachedUpdates();
  }

  /**
   * Clear cached updates
   */
  clearCachedUpdates(): void {
    clearCachedUpdates();
  }

  /**
   * Flush cached updates to disk
   */
  async flushCachedUpdates(): Promise<void> {
    await flushCachedUpdates();
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CodexService not initialized');
    }
  }
}
