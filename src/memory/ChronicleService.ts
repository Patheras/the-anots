/**
 * ChronicleService - L1 Memory Layer
 * 
 * File-based immutable storage with Git versioning
 * Zero external dependencies (only file system)
 * 
 * Features:
 * - Append-only writes (immutable)
 * - YAML frontmatter + Markdown content
 * - Git auto-commit on write
 * - Search by date, participants, session type
 * - Read-only file permissions
 */

import * as fs from 'fs/promises';
import { Service, ChronicleEntry, ChronicleMetadata } from '../core/types';
import { parseChronicle } from '../chronicle/parser';
import { serializeChronicle } from '../chronicle/serializer';
import {
  writeChronicle,
  chronicleExists,
  getNextChapterId,
  listChronicles,
  getChronicleStats,
} from '../chronicle/writer';
import {
  ChronicleChapter,
  ChronicleContent,
  getChronicleFilePath,
  getChronicleDirectory,
} from '../chronicle/types';

export class ChronicleService implements Service {
  name = 'ChronicleService';
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure Chronicle directories exist
    await this.ensureDirectories();

    this.initialized = true;
    console.log('✓ ChronicleService initialized');
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    console.log('✓ ChronicleService shutdown');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Check if we can access Chronicle directories
      const sessionTypes: Array<'general' | 'ubik' | 'axiom'> = ['general', 'ubik', 'axiom'];
      
      for (const sessionType of sessionTypes) {
        const directory = getChronicleDirectory(sessionType);
        await fs.access(directory, fs.constants.R_OK | fs.constants.W_OK);
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write a new Chronicle chapter
   */
  async write(entry: ChronicleEntry): Promise<void> {
    this.ensureInitialized();

    // Generate chapter ID if not provided
    const chapterId = entry.chapterId || await getNextChapterId(
      entry.date,
      entry.sessionType as 'general' | 'ubik' | 'axiom'
    );

    // Create Chronicle chapter
    const chapter: ChronicleChapter = {
      metadata: {
        date: entry.date,
        chapterId,
        participants: entry.participants,
        sessionType: entry.sessionType as 'general' | 'ubik' | 'axiom',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        messageCount: entry.metadata?.messageCount,
        tags: entry.metadata?.tags,
        summary: entry.metadata?.summary,
      },
      content: {
        summary: entry.metadata?.summary || 'No summary provided',
        dialogue: entry.content,
        truths: entry.metadata?.truths || [],
        insights: entry.metadata?.insights || [],
        toolsCreated: entry.metadata?.toolsCreated || [],
        decisions: entry.metadata?.decisions || [],
      },
    };

    // Write to file system
    await writeChronicle(chapter);
  }

  /**
   * Read a Chronicle chapter by ID
   */
  async read(chapterId: string, sessionType: 'general' | 'ubik' | 'axiom'): Promise<ChronicleEntry | null> {
    this.ensureInitialized();

    try {
      const filePath = getChronicleFilePath(chapterId, sessionType);
      const markdown = await fs.readFile(filePath, 'utf-8');
      const chapter = parseChronicle(markdown);

      return this.chapterToEntry(chapter);
    } catch (error) {
      console.warn(`Chronicle chapter not found: ${chapterId}`, error);
      return null;
    }
  }

  /**
   * List all Chronicle chapters for a session type
   */
  async list(sessionType?: 'general' | 'ubik' | 'axiom'): Promise<ChronicleEntry[]> {
    this.ensureInitialized();

    const sessionTypes = sessionType ? [sessionType] : ['general', 'ubik', 'axiom'] as const;
    const entries: ChronicleEntry[] = [];

    for (const type of sessionTypes) {
      const chapterIds = await listChronicles(type);
      
      for (const chapterId of chapterIds) {
        const entry = await this.read(chapterId, type);
        if (entry) {
          entries.push(entry);
        }
      }
    }

    // Sort by date (newest first)
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Search Chronicle chapters
   */
  async search(query: {
    date?: string;
    participants?: string[];
    sessionType?: 'general' | 'ubik' | 'axiom';
    content?: string;
  }): Promise<ChronicleEntry[]> {
    this.ensureInitialized();

    // Get all chapters (filtered by session type if specified)
    const allEntries = await this.list(query.sessionType);

    // Filter by criteria
    return allEntries.filter(entry => {
      // Filter by date
      if (query.date && entry.date !== query.date) {
        return false;
      }

      // Filter by participants
      if (query.participants && query.participants.length > 0) {
        const hasParticipant = query.participants.some(p =>
          entry.participants.includes(p)
        );
        if (!hasParticipant) {
          return false;
        }
      }

      // Filter by content (case-insensitive)
      if (query.content) {
        const searchTerm = query.content.toLowerCase();
        const contentMatch = entry.content.toLowerCase().includes(searchTerm);
        const summaryMatch = entry.metadata?.summary?.toLowerCase().includes(searchTerm);
        
        if (!contentMatch && !summaryMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if a Chronicle chapter exists
   */
  async exists(chapterId: string, sessionType: 'general' | 'ubik' | 'axiom'): Promise<boolean> {
    this.ensureInitialized();
    return chronicleExists(chapterId, sessionType);
  }

  /**
   * Get Chronicle chapter statistics
   */
  async getStats(chapterId: string, sessionType: 'general' | 'ubik' | 'axiom') {
    this.ensureInitialized();
    return getChronicleStats(chapterId, sessionType);
  }

  /**
   * Ensure Chronicle directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const sessionTypes: Array<'general' | 'ubik' | 'axiom'> = ['general', 'ubik', 'axiom'];
    
    for (const sessionType of sessionTypes) {
      const directory = getChronicleDirectory(sessionType);
      await fs.mkdir(directory, { recursive: true });
    }
  }

  /**
   * Convert Chronicle chapter to ChronicleEntry
   */
  private chapterToEntry(chapter: ChronicleChapter): ChronicleEntry {
    return {
      chapterId: chapter.metadata.chapterId,
      date: chapter.metadata.date,
      participants: chapter.metadata.participants,
      sessionType: chapter.metadata.sessionType,
      content: chapter.content.dialogue,
      metadata: {
        summary: chapter.content.summary,
        messageCount: chapter.metadata.messageCount,
        truthsCount: chapter.content.truths.length,
        durationMinutes: this.calculateDuration(
          chapter.metadata.startTime,
          chapter.metadata.endTime
        ),
        tags: chapter.metadata.tags,
        truths: chapter.content.truths,
        insights: chapter.content.insights,
        toolsCreated: chapter.content.toolsCreated,
        decisions: chapter.content.decisions,
      },
    };
  }

  /**
   * Calculate duration in minutes between two ISO timestamps
   */
  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Math.round((end - start) / 1000 / 60);
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ChronicleService not initialized');
    }
  }
}
