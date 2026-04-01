/**
 * MCP Chronicle Tools
 * 
 * Exposes ChronicleService operations as MCP tools
 */

import { z } from 'zod';
import { MCPTool } from '../types';
import { ChronicleService } from '../../memory/ChronicleService';

/**
 * Create MCP tools for Chronicle operations
 */
export function createChronicleTools(chronicleService: ChronicleService): MCPTool[] {
  return [
    // anots/chronicle/write - Write a new chapter
    {
      definition: {
        name: 'anots/chronicle/write',
        description: 'Write a new chapter to Chronicle (L1). Creates an append-only, Git-versioned entry.',
        inputSchema: z.object({
          content: z.string().describe('Chapter content'),
          participants: z.array(z.string()).optional().describe('Participants (default: ["System"])'),
          sessionType: z.enum(['general', 'ubik', 'axiom']).optional().default('general').describe('Session type (default: "general")'),
          metadata: z.record(z.any()).optional().describe('Optional metadata'),
        }),
      },
      handler: async (args) => {
        const { content, participants, sessionType, metadata } = args;
        
        const date = new Date().toISOString().split('T')[0];
        const entry = {
          chapterId: '', // Auto-generate
          date,
          participants: participants || ['System'],
          sessionType: sessionType || 'general',
          content,
          metadata,
        };
        
        await chronicleService.write(entry);
        
        return {
          content: [
            {
              type: 'text',
              text: `✓ Chapter written successfully\nDate: ${date}\nParticipants: ${entry.participants.join(', ')}\nType: ${entry.sessionType}`,
            },
          ],
        };
      },
    },

    // anots/chronicle/read - Read a specific chapter
    {
      definition: {
        name: 'anots/chronicle/read',
        description: 'Read a specific chapter from Chronicle by ID. Returns full chapter content.',
        inputSchema: z.object({
          chapterId: z.string().describe('Chapter ID to read'),
          sessionType: z.enum(['general', 'ubik', 'axiom']).optional().default('general').describe('Session type (default: "general")'),
        }),
      },
      handler: async (args) => {
        const { chapterId, sessionType } = args;
        
        const chapter = await chronicleService.read(chapterId, sessionType || 'general');
        
        if (!chapter) {
          return {
            content: [
              {
                type: 'text',
                text: `Chapter not found: ${chapterId}`,
              },
            ],
            isError: true,
          };
        }
        
        const chapterText = `
Chapter: ${chapter.chapterId}
Date: ${chapter.date}
Participants: ${chapter.participants.join(', ')}
Type: ${chapter.sessionType}

${chapter.content}
        `.trim();
        
        return {
          content: [
            {
              type: 'text',
              text: chapterText,
            },
          ],
        };
      },
    },

    // anots/chronicle/list - List all chapters
    {
      definition: {
        name: 'anots/chronicle/list',
        description: 'List all chapters in Chronicle. Returns chapter metadata without full content.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Maximum number of chapters to return'),
        }),
      },
      handler: async (args) => {
        const { limit } = args;
        
        let chapters = await chronicleService.list();
        
        if (limit && limit > 0) {
          chapters = chapters.slice(0, limit);
        }
        
        if (chapters.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No chapters found in Chronicle',
              },
            ],
          };
        }
        
        const chapterList = chapters
          .map(c => `- ${c.chapterId} (${c.date}) [${c.participants.join(', ')}] - ${c.sessionType}`)
          .join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `Chronicle Chapters (${chapters.length}):\n\n${chapterList}`,
            },
          ],
        };
      },
    },

    // anots/chronicle/search - Search chapters
    {
      definition: {
        name: 'anots/chronicle/search',
        description: 'Search Chronicle chapters by content, participants, or session type. Returns matching chapters.',
        inputSchema: z.object({
          content: z.string().optional().describe('Search in content'),
          participants: z.array(z.string()).optional().describe('Filter by participants'),
          sessionType: z.string().optional().describe('Filter by session type'),
          limit: z.number().optional().default(20).describe('Maximum results (default: 20)'),
        }),
      },
      handler: async (args) => {
        const { content, participants, sessionType, limit } = args;
        
        const results = await chronicleService.search({
          content,
          participants,
          sessionType,
        });
        
        const limitedResults = results.slice(0, limit || 20);
        
        if (limitedResults.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No matching chapters found',
              },
            ],
          };
        }
        
        const resultText = limitedResults
          .map((c, i) => {
            const preview = c.content.substring(0, 150) + (c.content.length > 150 ? '...' : '');
            return `${i + 1}. ${c.chapterId} (${c.date})\n   Participants: ${c.participants.join(', ')}\n   Type: ${c.sessionType}\n   ${preview}\n`;
          })
          .join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${limitedResults.length} chapters:\n\n${resultText}`,
            },
          ],
        };
      },
    },
  ];
}
