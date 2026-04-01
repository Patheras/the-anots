/**
 * MCP Memory Tools
 * 
 * Exposes UnifiedMemoryService operations as MCP tools
 */

import { z } from 'zod';
import { MCPTool } from '../types';
import { UnifiedMemoryService } from '../../memory/UnifiedMemoryService';

/**
 * Create MCP tools for memory operations
 */
export function createMemoryTools(memoryService: UnifiedMemoryService): MCPTool[] {
  return [
    // anots/memory/search - Search across all memory layers
    {
      definition: {
        name: 'anots/memory/search',
        description: 'Search across all memory layers (Hive Mind → Chronicle fallback). Returns semantic or text-based results.',
        inputSchema: z.object({
          query: z.string().describe('Search query'),
          limit: z.number().optional().default(20).describe('Maximum number of results (default: 20)'),
        }),
      },
      handler: async (args) => {
        const { query, limit } = args;
        
        const results = await memoryService.search(query, limit);
        
        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No results found for query: "${query}"`,
              },
            ],
          };
        }
        
        const resultText = results
          .map((r, i) => `${i + 1}. [${r.source}] (score: ${r.score.toFixed(2)})\n${r.content}\n`)
          .join('\n');
        
        return {
          content: [
            {
              type: 'text',
              text: `Found ${results.length} results:\n\n${resultText}`,
            },
          ],
        };
      },
    },

    // anots/memory/store - Store content in memory
    {
      definition: {
        name: 'anots/memory/store',
        description: 'Store content in memory (Hive Mind + Chronicle). Content is indexed semantically and stored long-term.',
        inputSchema: z.object({
          content: z.string().describe('Content to store'),
          metadata: z.record(z.any()).optional().describe('Optional metadata'),
        }),
      },
      handler: async (args) => {
        const { content, metadata } = args;
        
        await memoryService.store(content, metadata);
        
        return {
          content: [
            {
              type: 'text',
              text: `✓ Content stored successfully (${content.length} characters)`,
            },
          ],
        };
      },
    },

    // anots/memory/get-context - Get active session context
    {
      definition: {
        name: 'anots/memory/get-context',
        description: 'Get active context for a session from Active Stream (L2). Returns current conversation state.',
        inputSchema: z.object({
          sessionId: z.string().describe('Session ID'),
        }),
      },
      handler: async (args) => {
        const { sessionId } = args;
        
        const context = await memoryService.getContext(sessionId);
        
        if (!context) {
          return {
            content: [
              {
                type: 'text',
                text: `No context found for session: ${sessionId}`,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      },
    },

    // anots/memory/update-context - Update active session context
    {
      definition: {
        name: 'anots/memory/update-context',
        description: 'Update active context for a session in Active Stream (L2). Maintains conversation state.',
        inputSchema: z.object({
          sessionId: z.string().describe('Session ID'),
          state: z.object({
            messages: z.array(z.any()).describe('Conversation messages'),
            metadata: z.record(z.any()).optional().describe('Session metadata'),
          }).describe('Session state'),
        }),
      },
      handler: async (args) => {
        const { sessionId, state } = args;
        
        await memoryService.updateContext(sessionId, state);
        
        return {
          content: [
            {
              type: 'text',
              text: `✓ Context updated for session: ${sessionId}`,
            },
          ],
        };
      },
    },

    // anots/memory/clear-context - Clear active session context
    {
      definition: {
        name: 'anots/memory/clear-context',
        description: 'Clear active context for a session from Active Stream (L2). Removes conversation state.',
        inputSchema: z.object({
          sessionId: z.string().describe('Session ID'),
        }),
      },
      handler: async (args) => {
        const { sessionId } = args;
        
        await memoryService.clearContext(sessionId);
        
        return {
          content: [
            {
              type: 'text',
              text: `✓ Context cleared for session: ${sessionId}`,
            },
          ],
        };
      },
    },

    // anots/memory/list-sessions - List active sessions
    {
      definition: {
        name: 'anots/memory/list-sessions',
        description: 'List all active sessions in Active Stream (L2). Shows current conversation sessions.',
        inputSchema: z.object({}),
      },
      handler: async () => {
        const sessions = await memoryService.listSessions();
        
        if (sessions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No active sessions',
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Active sessions (${sessions.length}):\n${sessions.map(s => `- ${s}`).join('\n')}`,
            },
          ],
        };
      },
    },

    // anots/memory/stats - Get memory statistics
    {
      definition: {
        name: 'anots/memory/stats',
        description: 'Get statistics across all memory layers. Shows health and content counts.',
        inputSchema: z.object({}),
      },
      handler: async () => {
        const [stats, health] = await Promise.all([
          memoryService.getStats(),
          memoryService.getLayerHealth(),
        ]);
        
        const statsText = `
Memory Statistics:

Chronicle (L1):
  Status: ${health.chronicle ? '✓ Healthy' : '✗ Unavailable'}
  Chapters: ${stats.chronicle.chapterCount}

Active Stream (L2):
  Status: ${health.activeStream ? '✓ Healthy' : '✗ Unavailable'}
  Sessions: ${stats.activeStream.sessionCount}

Hive Mind (L3):
  Status: ${health.hiveMind ? '✓ Healthy' : '✗ Unavailable'}
  Memories: ${stats.hiveMind.memoryCount}

Codex (L4):
  Status: ${health.codex ? '✓ Healthy' : '✗ Unavailable'}
  Ubik: ${stats.codex.ubikInitialized ? 'Initialized' : 'Not initialized'}
  Axiom: ${stats.codex.axiomInitialized ? 'Initialized' : 'Not initialized'}
        `.trim();
        
        return {
          content: [
            {
              type: 'text',
              text: statsText,
            },
          ],
        };
      },
    },

    // anots/memory/health - Check memory system health
    {
      definition: {
        name: 'anots/memory/health',
        description: 'Check health status of all memory layers. Returns layer availability.',
        inputSchema: z.object({}),
      },
      handler: async () => {
        const health = await memoryService.getLayerHealth();
        const isHealthy = await memoryService.isHealthy();
        
        const healthText = `
Memory System Health: ${isHealthy ? '✓ Healthy' : '✗ Degraded'}

Layer Status:
- Chronicle (L1): ${health.chronicle ? '✓' : '✗'}
- Active Stream (L2): ${health.activeStream ? '✓' : '✗'}
- Hive Mind (L3): ${health.hiveMind ? '✓' : '✗'}
- Codex (L4): ${health.codex ? '✓' : '✗'}
        `.trim();
        
        return {
          content: [
            {
              type: 'text',
              text: healthText,
            },
          ],
        };
      },
    },
  ];
}
