import * as fs from 'fs/promises';
import { simpleGit, SimpleGit } from 'simple-git';
import {
  AgentNode,
  CodexFile,
  getCodexDirectory,
  getCodexFilePath,
  DEFAULT_CODEX_CONTENT,
} from './types';

/**
 * Initialize Agent Codex directory structure
 * 
 * Creates directory structure and template files for both Ubik and Axiom
 * Initializes Git repository for versioning
 */

/**
 * Ensure directory exists (create if needed)
 */
async function ensureDirectory(directory: string): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

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
 * Create a single Codex file with default content
 */
async function createCodexFile(
  node: AgentNode,
  file: CodexFile
): Promise<void> {
  const filePath = getCodexFilePath(node, file);
  const content = DEFAULT_CODEX_CONTENT[file](node);
  
  try {
    // Check if file already exists
    await fs.access(filePath, fs.constants.F_OK);
    console.log(`Codex file already exists: ${filePath}`);
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Created Codex file: ${filePath}`);
  }
}

/**
 * Initialize Codex for a single node
 */
export async function initializeNodeCodex(node: AgentNode): Promise<void> {
  try {
    // Ensure directory exists
    const directory = getCodexDirectory(node);
    await ensureDirectory(directory);
    
    // Create all Codex files
    const files: CodexFile[] = [
      'README.md',
      'TASKS.md',
      'SYNTHETIC-DIARY.md',
      'NOTES.md',
      'CONTEXT.md',
      'TOOLS.md',
    ];
    
    for (const file of files) {
      await createCodexFile(node, file);
    }
    
    // Initialize Git repository
    const git = await initGitRepo(directory);
    
    // Add all files and commit
    await git.add('.');
    await git.commit(`Initialize ${node} Codex`);
    
    console.log(`✅ ${node} Codex initialized successfully`);
    
  } catch (error) {
    console.error(`Failed to initialize ${node} Codex:`, error);
    throw error;
  }
}

/**
 * Initialize all Agent Codex directories
 */
export async function initializeAllCodex(): Promise<void> {
  try {
    // Initialize Ubik Codex
    await initializeNodeCodex('ubik');
    
    // Initialize Axiom Codex
    await initializeNodeCodex('axiom');
    
    console.log('✅ All Agent Codex directories initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize Agent Codex:', error);
    throw error;
  }
}

/**
 * Check if Codex is initialized for a node
 */
export async function isCodexInitialized(node: AgentNode): Promise<boolean> {
  try {
    const directory = getCodexDirectory(node);
    await fs.access(directory, fs.constants.F_OK);
    
    // Check if all required files exist
    const files: CodexFile[] = [
      'README.md',
      'TASKS.md',
      'SYNTHETIC-DIARY.md',
      'NOTES.md',
      'CONTEXT.md',
      'TOOLS.md',
    ];
    
    for (const file of files) {
      const filePath = getCodexFilePath(node, file);
      await fs.access(filePath, fs.constants.F_OK);
    }
    
    return true;
  } catch {
    return false;
  }
}
