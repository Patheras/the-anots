/**
 * Import Service
 * 
 * Imports conversation files (JSON/Markdown) into ANOTS memory system:
 * - Chronicle: Conversation history with metadata
 * - Hive Mind: Semantic indexing for search
 * - Codex: Key insights and learnings
 * 
 * Can be used programmatically or via CLI
 */

import { ChronicleChapter } from '../chronicle/types';
import { writeChronicle, getNextChapterId } from '../chronicle/writer';
import { HiveMindService } from '../memory/HiveMindService';
import { updateAgentCodex } from '../codex/updater';
import { AgentNode } from '../codex/types';
import {
  ConversationFile,
  ConversationMessage,
  ImportOptions,
  ImportStats,
  ImportProgressCallback,
} from './types';
import { parseConversationFile, validateConversationFile } from './parsers';
import {
  extractTruths,
  extractInsights,
  extractDecisions,
  generateChapterSummary,
  messagesToDialogue,
  chunkMessages,
} from './extractors';

/**
 * Import Service Class
 * 
 * Handles conversation import with progress tracking
 */
export class ImportService {
  private hiveMind: HiveMindService | null = null;
  private progressCallback?: ImportProgressCallback;

  constructor(progressCallback?: ImportProgressCallback) {
    this.progressCallback = progressCallback;
  }

  /**
   * Import conversation file
   */
  async import(options: ImportOptions): Promise<ImportStats> {
    const stats: ImportStats = {
      totalMessages: 0,
      chaptersCreated: 0,
      hiveMindEntries: 0,
      codexUpdates: 0,
      errors: 0,
      startTime: new Date(),
    };

    // Set defaults
    const opts = {
      dryRun: false,
      chunkSize: 50,
      verbose: false,
      ...options,
    };

    try {
      // Phase 1: Parse
      this.reportProgress('parsing', 0, 1, 'Parsing conversation file...');
      const conversation = await parseConversationFile(opts.filePath);
      validateConversationFile(conversation);
      stats.totalMessages = conversation.messages.length;
      this.reportProgress('parsing', 1, 1, `Parsed ${stats.totalMessages} messages`);

      // Initialize Hive Mind
      this.hiveMind = new HiveMindService();
      await this.hiveMind.initialize();

      // Chunk messages
      const chunks = chunkMessages(conversation.messages, opts.chunkSize);

      // Phase 2: Chronicle
      this.reportProgress('chronicle', 0, chunks.length, 'Importing to Chronicle...');
      const date = conversation.metadata?.date || new Date().toISOString().split('T')[0];
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          await this.importChapter(chunks[i], opts.sessionType, date, i, chunks.length, opts.dryRun);
          stats.chaptersCreated++;
          this.reportProgress('chronicle', i + 1, chunks.length, `Chapter ${i + 1}/${chunks.length} imported`);
        } catch (error) {
          console.error(`Failed to import chunk ${i + 1}:`, error);
          stats.errors++;
        }
      }

      // Phase 3: Hive Mind
      this.reportProgress('hivemind', 0, conversation.messages.length, 'Indexing to Hive Mind...');
      stats.hiveMindEntries = await this.indexToHiveMind(
        conversation.messages,
        opts.sessionType,
        opts.dryRun
      );
      this.reportProgress('hivemind', stats.hiveMindEntries, conversation.messages.length, 'Indexing complete');

      // Phase 4: Codex
      this.reportProgress('codex', 0, 1, 'Updating Codex...');
      stats.codexUpdates = await this.updateCodex(conversation, opts.sessionType, opts.dryRun);
      this.reportProgress('codex', 1, 1, 'Codex updated');

      // Shutdown
      await this.hiveMind.shutdown();

      stats.endTime = new Date();
      this.reportProgress('complete', 1, 1, 'Import complete');
      
      return stats;

    } catch (error) {
      console.error('Import failed:', error);
      stats.errors++;
      stats.endTime = new Date();
      
      if (this.hiveMind) {
        await this.hiveMind.shutdown();
      }
      
      throw error;
    }
  }

  /**
   * Import single chapter
   */
  private async importChapter(
    messages: ConversationMessage[],
    sessionType: 'general' | 'ubik' | 'axiom',
    date: string,
    chunkIndex: number,
    totalChunks: number,
    dryRun: boolean
  ): Promise<void> {
    const chapterId = await getNextChapterId(date, sessionType);

    const chapter: ChronicleChapter = {
      metadata: {
        date,
        chapterId,
        participants: sessionType === 'ubik' ? ['chip', 'ubik'] : 
                     sessionType === 'axiom' ? ['chip', 'axiom'] : 
                     ['chip'],
        sessionType,
        startTime: messages[0]?.timestamp || new Date().toISOString(),
        endTime: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
        tags: ['import', 'historical'],
        summary: generateChapterSummary(messages, chunkIndex, totalChunks),
        messageCount: messages.length,
      },
      content: {
        summary: generateChapterSummary(messages, chunkIndex, totalChunks),
        dialogue: messagesToDialogue(messages),
        truths: extractTruths(messages),
        insights: extractInsights(messages),
        toolsCreated: [],
        decisions: extractDecisions(messages),
      },
    };

    if (!dryRun) {
      await writeChronicle(chapter);
    }
  }

  /**
   * Index to Hive Mind
   */
  private async indexToHiveMind(
    messages: ConversationMessage[],
    sessionType: string,
    dryRun: boolean
  ): Promise<number> {
    if (!this.hiveMind) {
      throw new Error('Hive Mind not initialized');
    }

    let indexed = 0;

    for (const msg of messages) {
      // Skip very short messages
      if (msg.content.length < 50) continue;

      const metadata = {
        role: msg.role,
        sessionType,
        timestamp: msg.timestamp || new Date().toISOString(),
        source: 'import',
      };

      if (!dryRun) {
        await this.hiveMind.store(msg.content, metadata);
      }
      indexed++;
    }

    return indexed;
  }

  /**
   * Update Codex
   */
  private async updateCodex(
    conversation: ConversationFile,
    sessionType: 'general' | 'ubik' | 'axiom',
    dryRun: boolean
  ): Promise<number> {
    const node: AgentNode = sessionType === 'ubik' ? 'ubik' : 
                           sessionType === 'axiom' ? 'axiom' : 
                           'axiom';

    const allTruths = extractTruths(conversation.messages);
    const allInsights = extractInsights(conversation.messages);

    if (allTruths.length === 0 && allInsights.length === 0) {
      return 0;
    }

    const updateContent = [
      '## Imported Learnings',
      '',
      `Imported from conversation on ${new Date().toISOString().split('T')[0]}`,
      '',
      '### Key Truths',
      ...allTruths.map(t => `- ${t}`),
      '',
      '### Insights',
      ...allInsights.map(i => `- ${i}`),
    ].join('\n');

    if (!dryRun) {
      await updateAgentCodex({
        node,
        file: 'NOTES.md',
        operation: 'append',
        content: updateContent,
        summary: 'Import historical conversation learnings',
      });
    }

    return allTruths.length + allInsights.length;
  }

  /**
   * Report progress
   */
  private reportProgress(
    phase: 'parsing' | 'chronicle' | 'hivemind' | 'codex' | 'complete',
    current: number,
    total: number,
    message: string
  ): void {
    if (this.progressCallback) {
      this.progressCallback({ phase, current, total, message });
    }
  }
}

/**
 * Print import summary
 */
export function printImportSummary(stats: ImportStats): void {
  const duration = stats.endTime 
    ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000 
    : 0;

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 IMPORT SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Messages:     ${stats.totalMessages}`);
  console.log(`Chapters Created:   ${stats.chaptersCreated}`);
  console.log(`Hive Mind Entries:  ${stats.hiveMindEntries}`);
  console.log(`Codex Updates:      ${stats.codexUpdates}`);
  console.log(`Errors:             ${stats.errors}`);
  console.log(`Duration:           ${duration.toFixed(2)}s`);
  console.log('═══════════════════════════════════════');
  console.log('');
}

// Export types and functions
export * from './types';
export * from './parsers';
export * from './extractors';

// Export types and functions
export * from './types';
export * from './parsers';
export * from './extractors';

