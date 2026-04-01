/**
 * MCP System Tools
 *
 * Expose system operations via MCP protocol.
 * Requirements: 5.2, 5.3, 5.4, 5.5, 9.3
 */

import { z } from 'zod';
import { MCPTool } from '../types.js';
import { UnifiedMemoryService } from '../../memory/UnifiedMemoryService.js';

/**
 * Create MCP tools for system operations
 */
export function createSystemTools(memoryService: UnifiedMemoryService): MCPTool[] {
  return [
    // anots/system/health - Check health of all memory layers
    {
      definition: {
        name: 'anots/system/health',
        description: 'Check health status of all memory layers (Chronicle, Active Stream, Hive Mind, Codex)',
        inputSchema: z.object({}),
      },
      handler: async () => {
        try {
          const health = await memoryService.getLayerHealth();
          
          const layers = [
            { layer: 'Chronicle', healthy: health.chronicle, message: health.chronicle ? 'Operational' : 'Unavailable' },
            { layer: 'ActiveStream', healthy: health.activeStream, message: health.activeStream ? 'Operational' : 'Unavailable' },
            { layer: 'HiveMind', healthy: health.hiveMind, message: health.hiveMind ? 'Operational' : 'Unavailable' },
            { layer: 'Codex', healthy: health.codex, message: health.codex ? 'Operational' : 'Unavailable' },
          ];
          
          const allHealthy = health.chronicle && health.activeStream && health.hiveMind && health.codex;
          
          const healthSummary = {
            overall: allHealthy ? 'healthy' : 'degraded',
            layers: layers.map(l => ({
              layer: l.layer,
              status: l.healthy ? 'healthy' : 'unhealthy',
              message: l.message,
            })),
            timestamp: new Date().toISOString(),
          };
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(healthSummary, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                overall: 'error',
                error: (error as Error).message,
                timestamp: new Date().toISOString(),
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },

    // anots/system/list-tools - List all available MCP tools
    {
      definition: {
        name: 'anots/system/list-tools',
        description: 'List all available MCP tools with their descriptions and schemas',
        inputSchema: z.object({
          category: z.enum(['memory', 'chronicle', 'gateway', 'codex', 'system', 'all']).optional().default('all').describe('Filter tools by category'),
        }),
      },
      handler: async (args) => {
        try {
          const category = args.category || 'all';
          
          // Define all available tools by category
          const toolsByCategory = {
            memory: [
              'anots/memory/search',
              'anots/memory/store',
              'anots/memory/get-context',
              'anots/memory/update-context',
              'anots/memory/clear-context',
              'anots/memory/list-sessions',
              'anots/memory/stats',
              'anots/memory/health',
            ],
            chronicle: [
              'anots/chronicle/write',
              'anots/chronicle/read',
              'anots/chronicle/list',
              'anots/chronicle/search',
            ],
            gateway: [
              'anots/gateway/chat',
              'anots/gateway/classify',
              'anots/gateway/status',
            ],
            codex: [
              'anots/codex/read',
              'anots/codex/write',
              'anots/codex/list',
              'anots/codex/init',
              'anots/codex/read-full',
            ],
            system: [
              'anots/system/health',
              'anots/system/list-tools',
            ],
          };
          
          let tools: string[];
          if (category === 'all') {
            tools = Object.values(toolsByCategory).flat();
          } else {
            tools = toolsByCategory[category as keyof typeof toolsByCategory] || [];
          }
          
          const toolList = {
            category,
            count: tools.length,
            tools: tools.sort(),
            categories: {
              memory: toolsByCategory.memory.length,
              chronicle: toolsByCategory.chronicle.length,
              gateway: toolsByCategory.gateway.length,
              codex: toolsByCategory.codex.length,
              system: toolsByCategory.system.length,
            },
            total: Object.values(toolsByCategory).flat().length,
          };
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(toolList, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: (error as Error).message,
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },
  ];
}
