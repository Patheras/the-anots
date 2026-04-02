/**
 * Import Module Types
 * 
 * Type definitions for conversation import functionality
 */

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ConversationMetadata {
  title?: string;
  date?: string;
  participants?: string[];
  tags?: string[];
}

export interface ConversationFile {
  messages: ConversationMessage[];
  metadata?: ConversationMetadata;
}

export interface ImportOptions {
  filePath: string;
  sessionType: 'general' | 'ubik' | 'axiom';
  dryRun?: boolean;
  chunkSize?: number;
  verbose?: boolean;
}

export interface ImportStats {
  totalMessages: number;
  chaptersCreated: number;
  hiveMindEntries: number;
  codexUpdates: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
}

export interface ImportProgress {
  phase: 'parsing' | 'chronicle' | 'hivemind' | 'codex' | 'complete';
  current: number;
  total: number;
  message: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;
