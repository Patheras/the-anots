/**
 * Response Cache
 *
 * Stores the last successful ChatCompletion per task type.
 * Used as the last-resort fallback when all live providers are unavailable.
 *
 * Requirements: 6.3, 6.5
 */

import { TaskType, ChatCompletion } from './types';

export class ResponseCache {
  private readonly cache = new Map<TaskType, ChatCompletion>();

  /** Store the last successful response for a task type */
  store(taskType: TaskType, response: ChatCompletion): void {
    this.cache.set(taskType, response);
  }

  /** Retrieve the cached response for a task type, or null if none */
  get(taskType: TaskType): ChatCompletion | null {
    return this.cache.get(taskType) ?? null;
  }

  /** Clear all cached responses */
  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
