import * as fs from 'fs/promises';
import {
  AgentNode,
  AgentCodex,
  CodexFile,
  getCodexDirectory,
  getCodexFilePath,
} from './types';

/**
 * Load Agent Codex from file system
 * 
 * Reads all Codex files for a given node and returns structured object
 * Handles missing files gracefully (returns empty string)
 */

/**
 * Load complete Agent Codex for a node
 */
export async function loadAgentCodex(node: AgentNode): Promise<AgentCodex> {
  try {
    const directory = getCodexDirectory(node);
    
    // Read all Codex files
    const [identity, tasks, diary, notes, context, tools] = await Promise.all([
      readCodexFile(node, 'README.md'),
      readCodexFile(node, 'TASKS.md'),
      readCodexFile(node, 'SYNTHETIC-DIARY.md'),
      readCodexFile(node, 'NOTES.md'),
      readCodexFile(node, 'CONTEXT.md'),
      readCodexFile(node, 'TOOLS.md'),
    ]);
    
    // Get last updated time from directory
    const stats = await fs.stat(directory);
    
    return {
      node,
      identity,
      tasks,
      diary,
      notes,
      context,
      tools,
      lastUpdated: stats.mtime,
    };
  } catch (error) {
    console.error(`Failed to load ${node} Codex:`, error);
    throw error;
  }
}

/**
 * Read a single Codex file
 * Returns empty string if file doesn't exist
 */
async function readCodexFile(node: AgentNode, file: CodexFile): Promise<string> {
  try {
    const filePath = getCodexFilePath(node, file);
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // File doesn't exist - return empty string
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Codex file not found: ${node}/${file}`);
      return '';
    }
    
    // Other error - rethrow
    throw error;
  }
}

/**
 * Load specific Codex file
 */
export async function loadCodexFile(node: AgentNode, file: CodexFile): Promise<string> {
  return readCodexFile(node, file);
}

/**
 * Check if a specific Codex file exists
 */
export async function codexFileExists(node: AgentNode, file: CodexFile): Promise<boolean> {
  try {
    const filePath = getCodexFilePath(node, file);
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
