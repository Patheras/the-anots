/**
 * Content Extractors
 * 
 * Extract truths, insights, and other metadata from conversations
 */

import { ConversationMessage } from './types';

/**
 * Extract truths from conversation messages
 * 
 * Looks for factual statements, definitions, decisions
 */
export function extractTruths(messages: ConversationMessage[]): string[] {
  const truths: string[] = [];
  const truthPatterns = [
    /(?:we decided|we agreed|decision:|conclusion:)\s*(.+)/gi,
    /(?:fact:|truth:|important:)\s*(.+)/gi,
    /(?:this means|this is|definition:)\s*(.+)/gi,
  ];

  for (const msg of messages) {
    for (const pattern of truthPatterns) {
      const matches = msg.content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          truths.push(match[1].trim());
        }
      }
    }
  }

  return truths;
}

/**
 * Extract insights from conversation messages
 * 
 * Looks for key takeaways and learnings
 */
export function extractInsights(messages: ConversationMessage[]): string[] {
  const insights: string[] = [];
  const insightPatterns = [
    /(?:insight:|key takeaway:|learned:)\s*(.+)/gi,
    /(?:this suggests|this implies|this shows)\s*(.+)/gi,
  ];

  for (const msg of messages) {
    for (const pattern of insightPatterns) {
      const matches = msg.content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          insights.push(match[1].trim());
        }
      }
    }
  }

  return insights;
}

/**
 * Extract decisions from conversation messages
 */
export function extractDecisions(messages: ConversationMessage[]): string[] {
  const decisions: string[] = [];
  const decisionPatterns = [
    /(?:we decided|decision:|we will|let's)\s*(.+)/gi,
  ];

  for (const msg of messages) {
    for (const pattern of decisionPatterns) {
      const matches = msg.content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          decisions.push(match[1].trim());
        }
      }
    }
  }

  return decisions;
}

/**
 * Generate chapter summary from messages
 */
export function generateChapterSummary(
  messages: ConversationMessage[],
  chunkIndex: number,
  totalChunks: number
): string {
  const messageCount = messages.length;
  const firstMessage = messages[0]?.content.substring(0, 100) || '';
  
  return `Chapter ${chunkIndex + 1}/${totalChunks}: ${messageCount} messages. Starts with: "${firstMessage}..."`;
}

/**
 * Convert messages to Chronicle dialogue format
 */
export function messagesToDialogue(messages: ConversationMessage[]): string {
  return messages
    .map(msg => {
      const speaker = msg.role === 'user' ? 'Chip' : 
                     msg.role === 'assistant' ? 'AI' : 
                     'System';
      return `### ${speaker}\n\n${msg.content}\n`;
    })
    .join('\n');
}

/**
 * Chunk messages into groups
 */
export function chunkMessages(
  messages: ConversationMessage[],
  chunkSize: number
): ConversationMessage[][] {
  const chunks: ConversationMessage[][] = [];

  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  return chunks;
}
