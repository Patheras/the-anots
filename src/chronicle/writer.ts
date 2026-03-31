import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import { ChronicleChapter, getChronicleFilePath, getChronicleDirectory } from './types';
import { serializeChronicle } from './serializer';

/**
 * Chronicle Writer Error
 */
export class ChronicleWriterError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ChronicleWriterError';
  }
}

/**
 * Write Chronicle chapter to file system (append-only, immutable)
 * 
 * Features:
 * - Append-only: Never modifies existing files
 * - Exclusive write: Uses 'wx' flag to prevent overwrites
 * - Read-only: Sets file permissions to 0o444 after creation
 * - Git versioning: Auto-commits each chapter
 * - Graceful error handling: Logs errors, doesn't crash
 * 
 * @param chapter - Chronicle chapter to write
 * @returns Promise<void> - Resolves on success, logs error on failure
 */
export async function writeChronicle(chapter: ChronicleChapter): Promise<void> {
  try {
    // Ensure directory exists
    const directory = getChronicleDirectory(chapter.metadata.sessionType);
    await ensureDirectory(directory);
    
    // Get file path
    const filePath = getChronicleFilePath(
      chapter.metadata.chapterId,
      chapter.metadata.sessionType
    );
    
    // Serialize chapter to markdown
    const markdown = serializeChronicle(chapter);
    
    // Write file with exclusive flag (wx) - fails if file exists
    await fs.writeFile(filePath, markdown, {
      flag: 'wx', // Exclusive write - prevents overwrites
      encoding: 'utf-8',
    });
    
    // Set file to read-only (0o444) - immutable
    await fs.chmod(filePath, 0o444);
    
    // Git commit
    await gitCommitChapter(filePath, chapter.metadata.chapterId);
    
    console.log(`Chronicle chapter written: ${filePath}`);
    
  } catch (error) {
    handleWriteError(error, chapter);
  }
}

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
 * Handle write errors gracefully
 */
function handleWriteError(error: unknown, chapter: ChronicleChapter): void {
  const err = error as NodeJS.ErrnoException;
  
  if (err.code === 'ENOSPC') {
    // Disk full - log to stderr, don't crash
    console.error('CRITICAL: Disk full, Chronicle not saved:', {
      chapterId: chapter.metadata.chapterId,
      sessionType: chapter.metadata.sessionType,
      error: err.message,
    });
    // TODO: Send to remote backup or cache in memory
    
  } else if (err.code === 'EEXIST') {
    // File already exists - this is expected for append-only
    console.warn('Chronicle chapter already exists (append-only):', {
      chapterId: chapter.metadata.chapterId,
      sessionType: chapter.metadata.sessionType,
    });
    
  } else {
    // Other error - log and continue
    console.error('Chronicle inscription failed:', {
      chapterId: chapter.metadata.chapterId,
      sessionType: chapter.metadata.sessionType,
      error: err.message,
    });
  }
  
  // Never throw - main dialogue continues
}

/**
 * Check if Chronicle chapter exists
 */
export async function chronicleExists(
  chapterId: string,
  sessionType: 'general' | 'ubik' | 'axiom'
): Promise<boolean> {
  try {
    const filePath = getChronicleFilePath(chapterId, sessionType);
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get next available chapter ID for a given date
 * 
 * Scans existing chapters and returns the next sequence number
 */
export async function getNextChapterId(
  date: string,
  sessionType: 'general' | 'ubik' | 'axiom'
): Promise<string> {
  const directory = getChronicleDirectory(sessionType);
  
  try {
    // Ensure directory exists
    await ensureDirectory(directory);
    
    // Read directory contents
    const files = await fs.readdir(directory);
    
    // Filter files for the given date
    const datePrefix = `${date}-chapter-`;
    const matchingFiles = files.filter(file => file.startsWith(datePrefix));
    
    // Extract sequence numbers
    const sequenceNumbers = matchingFiles
      .map(file => {
        const match = file.match(/chapter-(\d{3})\.md$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);
    
    // Get next sequence number
    const nextSequence = sequenceNumbers.length > 0
      ? Math.max(...sequenceNumbers) + 1
      : 1;
    
    // Format chapter ID
    const paddedNumber = nextSequence.toString().padStart(3, '0');
    return `${date}-chapter-${paddedNumber}`;
    
  } catch (error) {
    // If directory doesn't exist or can't be read, start from 001
    return `${date}-chapter-001`;
  }
}

/**
 * List all Chronicle chapters for a session type
 */
export async function listChronicles(
  sessionType: 'general' | 'ubik' | 'axiom'
): Promise<string[]> {
  const directory = getChronicleDirectory(sessionType);
  
  try {
    const files = await fs.readdir(directory);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''))
      .sort();
  } catch (error) {
    // Directory doesn't exist or can't be read
    return [];
  }
}

/**
 * Get Chronicle file stats (size, creation time, permissions)
 */
export async function getChronicleStats(
  chapterId: string,
  sessionType: 'general' | 'ubik' | 'axiom'
): Promise<{
  size: number;
  created: Date;
  modified: Date;
  isReadOnly: boolean;
} | null> {
  try {
    const filePath = getChronicleFilePath(chapterId, sessionType);
    const stats = await fs.stat(filePath);
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isReadOnly: (stats.mode & 0o222) === 0, // Check if writable bits are off
    };
  } catch {
    return null;
  }
}

/**
 * Initialize Git repository in Chronicle directory
 * 
 * Creates .git directory if it doesn't exist
 * Configures basic Git settings
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
 * Commit Chronicle chapter to Git
 * 
 * Auto-commits each chapter with descriptive message
 * Gracefully handles Git errors (logs, doesn't throw)
 */
async function gitCommitChapter(filePath: string, chapterId: string): Promise<void> {
  try {
    // Get directory containing the file
    const directory = path.dirname(filePath);
    
    // Initialize Git repo if needed
    const git = await initGitRepo(directory);
    
    // Get relative path for git add
    const relativePath = path.basename(filePath);
    
    // Stage the file
    await git.add(relativePath);
    
    // Commit with descriptive message
    const commitMessage = `Add chapter ${chapterId}`;
    await git.commit(commitMessage);
    
    console.log(`Git commit: ${commitMessage}`);
    
  } catch (error) {
    // Git errors are non-critical - log and continue
    console.warn('Git commit failed (non-critical):', {
      chapterId,
      error: (error as Error).message,
    });
  }
}
