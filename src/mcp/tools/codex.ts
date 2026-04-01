/**
 * MCP Codex Tools
 *
 * Expose Agent Codex operations via MCP protocol.
 * Requirements: 5.2
 */

import { z } from 'zod';
import { CodexService } from '../../memory/CodexService.js';
import { AgentNode, CodexFile, CodexOperation } from '../../codex/types.js';
import { MCPTool } from '../types.js';

/**
 * Register all Codex tools with the MCP server.
 */
export function registerCodexTools(codex: CodexService): MCPTool[] {
  return [
    // anots/codex/read - Read a file from an agent's codex
    {
      definition: {
        name: 'anots/codex/read',
        description: 'Read a file from an agent\'s codex',
        inputSchema: z.object({
          node: z.enum(['ubik', 'axiom']).describe('Agent node (ubik or axiom)'),
          file: z.enum(['README.md', 'TASKS.md', 'NOTES.md', 'TOOLS.md', 'CONTEXT.md', 'SYNTHETIC-DIARY.md']).describe('Codex file to read'),
        }),
      },
      handler: async (args) => {
        try {
          const { node, file } = args;
          const content = await codex.readFile(node as AgentNode, file as CodexFile);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                node,
                file,
                content,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: (error as Error).message,
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },

    // anots/codex/write - Update a file in an agent's codex
    {
      definition: {
        name: 'anots/codex/write',
        description: 'Update a file in an agent\'s codex',
        inputSchema: z.object({
          node: z.enum(['ubik', 'axiom']).describe('Agent node (ubik or axiom)'),
          file: z.enum(['README.md', 'TASKS.md', 'NOTES.md', 'TOOLS.md', 'CONTEXT.md', 'SYNTHETIC-DIARY.md']).describe('Codex file to update'),
          operation: z.enum(['append', 'replace', 'update']).describe('Update operation type'),
          content: z.string().describe('Content to write'),
          summary: z.string().describe('Brief summary of the update for Git commit'),
          section: z.string().optional().describe('Section to update (for update operation)'),
        }),
      },
      handler: async (args) => {
        try {
          const { node, file, operation, content, summary, section } = args;
          await codex.write({
            node: node as AgentNode,
            file: file as CodexFile,
            operation: operation as CodexOperation,
            content,
            summary,
            section,
          });
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                node,
                file,
                operation,
                message: `Updated ${file} for ${node}`,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: (error as Error).message,
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },

    // anots/codex/list - List all codex files for an agent
    {
      definition: {
        name: 'anots/codex/list',
        description: 'List all codex files for an agent',
        inputSchema: z.object({
          node: z.enum(['ubik', 'axiom']).describe('Agent node (ubik or axiom)'),
        }),
      },
      handler: async (args) => {
        try {
          const { node } = args;
          const files = await codex.list(node as AgentNode);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                node,
                files,
                count: files.length,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: (error as Error).message,
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },

    // anots/codex/init - Initialize codex for an agent node
    {
      definition: {
        name: 'anots/codex/init',
        description: 'Initialize codex for an agent node',
        inputSchema: z.object({
          node: z.enum(['ubik', 'axiom']).describe('Agent node (ubik or axiom)'),
        }),
      },
      handler: async (args) => {
        try {
          const { node } = args;
          await codex.init(node as AgentNode);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                node,
                message: `Initialized codex for ${node}`,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: (error as Error).message,
              }, null, 2),
            }],
            isError: true,
          };
        }
      },
    },

    // anots/codex/read-full - Read entire codex for an agent
    {
      definition: {
        name: 'anots/codex/read-full',
        description: 'Read entire codex for an agent',
        inputSchema: z.object({
          node: z.enum(['ubik', 'axiom']).describe('Agent node (ubik or axiom)'),
        }),
      },
      handler: async (args) => {
        try {
          const { node } = args;
          const codexData = await codex.read(node as AgentNode);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                ...codexData,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
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
