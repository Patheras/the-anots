import * as fs from 'fs/promises';
import { simpleGit, SimpleGit } from 'simple-git';
import {
  AgentNode,
  CodexFile,
  CodexUpdate,
  CodexOperation,
  getCodexDirectory,
  getCodexFilePath,
} from './types';

/**
 * Codex Updater
 * 
 * Supports three operations:
 * - append: Add content to end of file
 * - replace: Replace entire file content
 * - update: Update specific section in file
 * 
 * Features:
 * - Git commit on each update
 * - Disk full error handling (cache in memory)
 * - Graceful error handling (never crashes)
 */

/**
 * In-memory cache for updates when disk is full
 */
const inMemoryCodexCache = new Map<string, CodexUpdate>();

/**
 * Initialize Git repository in Codex directory
 */
async function initGitRepo(directory: string): Promise<SimpleGit> {
  const git = simpleGit(directory);
  
  try {
    // Check if already a git repo
    await git.status();
  } catch {
    // Not a git repo, initialize it
    await git.init();
    await git.addConfig('user.name', 'TCAM Memory System');
    await git.addConfig('user.email', 'memory@tcam.local');
    
    console.log(`Git repository initialized: ${directory}`);
  }
  
  return git;
}

/**
 * Append content to end of file
 */
async function appendToFile(filePath: string, content: string): Promise<void> {
  const currentContent = await fs.readFile(filePath, 'utf-8');
  
  // Add newline if file doesn't end with one
  const separator = currentContent.endsWith('\n') ? '' : '\n';
  
  // Append content
  const newContent = currentContent + separator + content;
  
  await fs.writeFile(filePath, newContent, 'utf-8');
}

/**
 * Replace entire file content
 */
async function replaceFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Update specific section in file
 * 
 * Finds section by markdown header (e.g., "## Section Name")
 * Replaces content until next header of same or higher level
 */
async function updateSection(
  filePath: string,
  sectionName: string,
  content: string
): Promise<void> {
  const currentContent = await fs.readFile(filePath, 'utf-8');
  const lines = currentContent.split('\n');
  
  // Find section header
  const sectionRegex = new RegExp(`^##\\s+${sectionName}\\s*$`, 'i');
  const sectionIndex = lines.findIndex(line => sectionRegex.test(line));
  
  if (sectionIndex === -1) {
    throw new Error(`Section "${sectionName}" not found in file`);
  }
  
  // Find next section header of same or higher level
  const nextSectionIndex = lines.findIndex((line, index) => {
    if (index <= sectionIndex) return false;
    return /^##?\s+/.test(line); // Match ## or #
  });
  
  // Build new content
  const before = lines.slice(0, sectionIndex + 1);
  const after = nextSectionIndex === -1 ? [] : lines.slice(nextSectionIndex);
  
  const newContent = [
    ...before,
    '',
    content,
    '',
    ...after,
  ].join('\n');
  
  await fs.writeFile(filePath, newContent, 'utf-8');
}

/**
 * Update Agent Codex
 * 
 * Supports three operations:
 * - append: Add content to end of file
 * - replace: Replace entire file content
 * - update: Update specific section in file
 * 
 * @param update - Codex update request
 * @returns Promise<void> - Resolves on success, logs error on failure
 */
export async function updateAgentCodex(update: CodexUpdate): Promise<void> {
  try {
    const filePath = getCodexFilePath(update.node, update.file);
    
    // Perform operation
    switch (update.operation) {
      case 'append':
        await appendToFile(filePath, update.content);
        break;
      
      case 'replace':
        await replaceFile(filePath, update.content);
        break;
      
      case 'update':
        if (!update.section) {
          throw new Error('Section name required for update operation');
        }
        await updateSection(filePath, update.section, update.content);
        break;
      
      default:
        throw new Error(`Unknown operation: ${update.operation}`);
    }
    
    // Git commit
    const directory = getCodexDirectory(update.node);
    const git = await initGitRepo(directory);
    await git.add(update.file);
    await git.commit(`Update ${update.node} codex: ${update.summary}`);
    
    console.log(`✅ Codex updated: ${update.node}/${update.file} (${update.operation})`);
    
  } catch (error) {
    handleUpdateError(error, update);
  }
}

/**
 * Handle update errors gracefully
 */
function handleUpdateError(error: unknown, update: CodexUpdate): void {
  const err = error as NodeJS.ErrnoException;
  
  if (err.code === 'ENOSPC') {
    // Disk full - cache in memory
    const cacheKey = `${update.node}/${update.file}`;
    inMemoryCodexCache.set(cacheKey, update);
    
    console.warn('Codex update cached in memory (disk full):', {
      node: update.node,
      file: update.file,
      operation: update.operation,
    });
    
    // TODO: Send to remote backup or retry later
    
  } else {
    // Other error - log and continue
    console.error('Codex update failed:', {
      node: update.node,
      file: update.file,
      operation: update.operation,
      error: err.message,
    });
  }
  
  // Never throw - main dialogue continues
}

/**
 * Get cached updates (for disk full recovery)
 */
export function getCachedUpdates(): Map<string, CodexUpdate> {
  return new Map(inMemoryCodexCache);
}

/**
 * Clear cached updates
 */
export function clearCachedUpdates(): void {
  inMemoryCodexCache.clear();
}

/**
 * Flush cached updates to disk
 * 
 * Attempts to write all cached updates to disk
 * Useful after disk space is freed
 */
export async function flushCachedUpdates(): Promise<void> {
  const updates = Array.from(inMemoryCodexCache.values());
  
  for (const update of updates) {
    try {
      await updateAgentCodex(update);
      
      // Remove from cache if successful
      const cacheKey = `${update.node}/${update.file}`;
      inMemoryCodexCache.delete(cacheKey);
      
    } catch (error) {
      // Keep in cache if still failing
      console.warn('Failed to flush cached update:', {
        node: update.node,
        file: update.file,
      });
    }
  }
  
  console.log(`Flushed ${updates.length - inMemoryCodexCache.size}/${updates.length} cached updates`);
}

/**
 * Batch update multiple Codex files
 * 
 * Performs multiple updates and commits them together
 */
export async function batchUpdateCodex(
  node: AgentNode,
  updates: Array<Omit<CodexUpdate, 'node'>>,
  commitMessage: string
): Promise<void> {
  try {
    // Perform all updates
    for (const update of updates) {
      const filePath = getCodexFilePath(node, update.file);
      
      switch (update.operation) {
        case 'append':
          await appendToFile(filePath, update.content);
          break;
        
        case 'replace':
          await replaceFile(filePath, update.content);
          break;
        
        case 'update':
          if (!update.section) {
            throw new Error('Section name required for update operation');
          }
          await updateSection(filePath, update.section, update.content);
          break;
      }
    }
    
    // Single Git commit for all updates
    const directory = getCodexDirectory(node);
    const git = await initGitRepo(directory);
    await git.add('.');
    await git.commit(commitMessage);
    
    console.log(`✅ Batch update completed: ${node} (${updates.length} files)`);
    
  } catch (error) {
    console.error('Batch update failed:', {
      node,
      updateCount: updates.length,
      error: (error as Error).message,
    });
    
    // Never throw - main dialogue continues
  }
}
