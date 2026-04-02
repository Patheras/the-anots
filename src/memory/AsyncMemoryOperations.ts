/**
 * Async Memory Operations
 * 
 * Manages asynchronous memory operations during active dialogue phase.
 * Ensures main dialogue is not blocked by memory operations.
 * 
 * Requirements: 7.7, 8.6, 2.3
 * Whitepaper: Section 7.1 (Non-Blocking Memory Service)
 */

import { MemoryService } from './MemoryService';

/**
 * Async operation types
 */
export type AsyncOperationType = 
  | 'extract_truths'
  | 'index_truths'
  | 'inscribe_chronicle'
  | 'update_codex';

/**
 * Async operation
 */
export interface AsyncOperation {
  id: string;
  type: AsyncOperationType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  data?: any;
}

/**
 * Async Memory Operations Manager
 * 
 * Queues and executes memory operations asynchronously without blocking
 * the main dialogue flow.
 * 
 * Requirements: 7.7, 2.3
 */
export class AsyncMemoryOperations {
  private memoryService: MemoryService;
  private operations: Map<string, AsyncOperation>;
  private queue: string[];
  private isProcessing: boolean;
  private maxConcurrent: number;
  private runningCount: number;

  constructor(
    memoryService: MemoryService,
    maxConcurrent: number = 3
  ) {
    this.memoryService = memoryService;
    this.operations = new Map();
    this.queue = [];
    this.isProcessing = false;
    this.maxConcurrent = maxConcurrent;
    this.runningCount = 0;
  }

  /**
   * Queue truth extraction operation
   * 
   * Requirements: 7.7, 8.6
   */
  queueTruthExtraction(
    dialogue: string,
    options?: {
      sessionId?: string;
      userId?: string;
      agentId?: string;
    }
  ): string {
    const operation: AsyncOperation = {
      id: this.generateOperationId('extract'),
      type: 'extract_truths',
      status: 'pending',
      createdAt: new Date(),
      data: { dialogue, options },
    };

    this.operations.set(operation.id, operation);
    this.queue.push(operation.id);
    
    // Start processing if not already running
    this.processQueue();

    return operation.id;
  }

  /**
   * Queue truth indexing operation
   * 
   * Requirements: 7.7
   */
  queueTruthIndexing(
    truths: any[],
    options?: { batchSize?: number }
  ): string {
    const operation: AsyncOperation = {
      id: this.generateOperationId('index'),
      type: 'index_truths',
      status: 'pending',
      createdAt: new Date(),
      data: { truths, options },
    };

    this.operations.set(operation.id, operation);
    this.queue.push(operation.id);
    
    this.processQueue();

    return operation.id;
  }

  /**
   * Queue Chronicle inscription operation
   * 
   * Requirements: 7.7
   */
  queueChronicleInscription(session: any): string {
    const operation: AsyncOperation = {
      id: this.generateOperationId('inscribe'),
      type: 'inscribe_chronicle',
      status: 'pending',
      createdAt: new Date(),
      data: { session },
    };

    this.operations.set(operation.id, operation);
    this.queue.push(operation.id);
    
    this.processQueue();

    return operation.id;
  }

  /**
   * Get operation status
   */
  getOperation(id: string): AsyncOperation | undefined {
    return this.operations.get(id);
  }

  /**
   * Get all operations
   */
  getAllOperations(): AsyncOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): AsyncOperation[] {
    return this.getAllOperations().filter((op) => op.status === 'pending');
  }

  /**
   * Get running operations
   */
  getRunningOperations(): AsyncOperation[] {
    return this.getAllOperations().filter((op) => op.status === 'running');
  }

  /**
   * Get completed operations
   */
  getCompletedOperations(): AsyncOperation[] {
    return this.getAllOperations().filter((op) => op.status === 'completed');
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): AsyncOperation[] {
    return this.getAllOperations().filter((op) => op.status === 'failed');
  }

  /**
   * Wait for all pending operations to complete
   * 
   * Requirements: 7.7
   */
  async waitForPendingOperations(timeout?: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.hasPendingOperations() || this.runningCount > 0) {
      // Check timeout
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for pending operations');
      }
      
      // Wait a bit before checking again
      await this.sleep(100);
    }
  }

  /**
   * Check if has pending operations
   */
  hasPendingOperations(): boolean {
    return this.queue.length > 0 || this.runningCount > 0;
  }

  /**
   * Clear all operations
   */
  clear(): void {
    this.operations.clear();
    this.queue = [];
    this.runningCount = 0;
  }

  /**
   * Get operation count by status
   */
  getOperationCount(status?: AsyncOperation['status']): number {
    if (!status) {
      return this.operations.size;
    }
    
    return this.getAllOperations().filter((op) => op.status === status).length;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Process operation queue
   */
  private async processQueue(): Promise<void> {
    // Already processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.runningCount < this.maxConcurrent) {
        const operationId = this.queue.shift();
        if (!operationId) continue;

        const operation = this.operations.get(operationId);
        if (!operation) continue;

        // Increment BEFORE launching so maxConcurrent is respected immediately
        this.runningCount++;
        // Execute operation asynchronously (fire-and-forget with counter management)
        this.executeOperation(operation).catch(() => {/* errors handled inside */});
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute single operation
   */
  private async executeOperation(operation: AsyncOperation): Promise<void> {
    operation.status = 'running';
    operation.startedAt = new Date();
    // runningCount already incremented by processQueue

    try {
      if (operation.type === 'extract_truths') {
        const { dialogue, options } = operation.data;
        const truths = await this.memoryService.extractTruths(dialogue, options);
        operation.data.result = truths;
        
      } else if (operation.type === 'index_truths') {
        const { truths, options } = operation.data;
        await this.memoryService.indexToHiveMind(truths, options);
        
      } else if (operation.type === 'inscribe_chronicle') {
        const { session } = operation.data;
        await this.memoryService.inscribeChronicle(session);
      }

      operation.status = 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
      operation.completedAt = new Date();
      
      console.error(`[AsyncMemoryOperations] Operation ${operation.id} failed:`, error);
    } finally {
      this.runningCount--;
      
      // Continue processing queue if more items waiting
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create async memory operations manager
 */
export function createAsyncMemoryOperations(
  memoryService: MemoryService,
  maxConcurrent?: number
): AsyncMemoryOperations {
  return new AsyncMemoryOperations(memoryService, maxConcurrent);
}
