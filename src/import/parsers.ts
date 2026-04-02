/**
 * Conversation File Parsers
 * 
 * Supports JSON and Markdown conversation formats
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ConversationFile, ConversationMessage } from './types';

/**
 * Parse conversation file (auto-detects format)
 */
export async function parseConversationFile(filePath: string): Promise<ConversationFile> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return parseJSONConversation(content);
  } else if (ext === '.md' || ext === '.markdown') {
    return parseMarkdownConversation(content);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .json or .md`);
  }
}

/**
 * Parse JSON conversation file
 * 
 * Supports two formats:
 * 1. Simple array: [{ role, content }, ...]
 * 2. Object with metadata: { metadata: {...}, messages: [...] }
 */
export function parseJSONConversation(content: string): ConversationFile {
  const data = JSON.parse(content);

  // Handle different JSON formats
  if (Array.isArray(data)) {
    // Simple array of messages
    return { messages: data };
  } else if (data.messages && Array.isArray(data.messages)) {
    // Object with messages array
    return data as ConversationFile;
  } else {
    throw new Error('Invalid JSON format. Expected array of messages or object with messages array');
  }
}

/**
 * Parse Markdown conversation file
 * 
 * Expected format:
 * # Conversation Title
 * 
 * ## User
 * Message content...
 * 
 * ## Assistant
 * Response content...
 */
export function parseMarkdownConversation(content: string): ConversationFile {
  const messages: ConversationMessage[] = [];
  const lines = content.split('\n');

  let currentRole: 'user' | 'assistant' | 'system' | null = null;
  let currentContent: string[] = [];
  let title: string | undefined;

  for (const line of lines) {
    // Extract title from # header
    if (line.startsWith('# ') && !title) {
      title = line.substring(2).trim();
      continue;
    }

    // Detect role headers (## User, ## Assistant, etc.)
    const roleMatch = line.match(/^##\s+(User|Assistant|System)/i);
    if (roleMatch) {
      // Save previous message
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim(),
        });
      }

      // Start new message
      currentRole = roleMatch[1].toLowerCase() as 'user' | 'assistant' | 'system';
      currentContent = [];
      continue;
    }

    // Accumulate content
    if (currentRole) {
      currentContent.push(line);
    }
  }

  // Save last message
  if (currentRole && currentContent.length > 0) {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
    });
  }

  return {
    messages,
    metadata: title ? { title } : undefined,
  };
}

/**
 * Validate conversation file structure
 */
export function validateConversationFile(conversation: ConversationFile): void {
  if (!conversation.messages || !Array.isArray(conversation.messages)) {
    throw new Error('Invalid conversation: messages array is required');
  }

  if (conversation.messages.length === 0) {
    throw new Error('Invalid conversation: at least one message is required');
  }

  for (let i = 0; i < conversation.messages.length; i++) {
    const msg = conversation.messages[i];
    
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      throw new Error(`Invalid message at index ${i}: role must be user, assistant, or system`);
    }

    if (!msg.content || typeof msg.content !== 'string') {
      throw new Error(`Invalid message at index ${i}: content is required and must be a string`);
    }
  }
}
