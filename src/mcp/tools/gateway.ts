/**
 * MCP Gateway Tools
 * 
 * Exposes ANOTSGateway operations as MCP tools
 */

import { z } from 'zod';
import { MCPTool } from '../types';
import { ANOTSGateway } from '../../gateway/ANOTSGateway';
import { TaskType } from '../../gateway/types';

/**
 * Create MCP tools for Gateway operations
 */
export function createGatewayTools(gateway: ANOTSGateway): MCPTool[] {
  return [
    // anots/gateway/chat - Send chat completion request
    {
      definition: {
        name: 'anots/gateway/chat',
        description: 'Send a chat completion request through the Gateway. Uses entropy-based routing (cloud for high-entropy, local for low-entropy) with automatic fallback.',
        inputSchema: z.object({
          messages: z.array(z.object({
            role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
            content: z.string().describe('Message content'),
          })).describe('Chat messages'),
          taskHint: z.enum([
            'philosophical-dialogue',
            'code-generation',
            'mcp-orchestration',
            'truth-extraction',
            'chronicle-writing',
            'research-synthesis',
            'testing-validation',
          ]).optional().describe('Optional task type hint for routing'),
          timeoutMs: z.number().optional().describe('Request timeout in milliseconds (default: 30000)'),
          temperature: z.number().optional().describe('Temperature for response generation (0.0-1.0)'),
        }),
      },
      handler: async (args) => {
        const { messages, taskHint, timeoutMs, temperature } = args;
        
        const response = await gateway.chat(
          messages,
          {
            taskHint: taskHint as TaskType | undefined,
            timeoutMs,
            temperature,
          }
        );
        
        // Check for error response
        if (response.error) {
          return {
            content: [
              {
                type: 'text',
                text: `✗ Gateway Error: ${response.error.code}\n${response.error.details?.join('\n') || ''}`,
              },
            ],
            isError: true,
          };
        }
        
        const assistantMessage = response.choices[0]?.message?.content || '';
        const usage = response.usage;
        
        let resultText = assistantMessage;
        if (usage) {
          resultText += `\n\n---\nTokens: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`;
        }
        resultText += `\nModel: ${response.model}`;
        
        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      },
    },

    // anots/gateway/classify - Classify task type and entropy
    {
      definition: {
        name: 'anots/gateway/classify',
        description: 'Classify a task by type and entropy level. Returns task classification without executing the request.',
        inputSchema: z.object({
          messages: z.array(z.object({
            role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
            content: z.string().describe('Message content'),
          })).describe('Chat messages to classify'),
          taskHint: z.enum([
            'philosophical-dialogue',
            'code-generation',
            'mcp-orchestration',
            'truth-extraction',
            'chronicle-writing',
            'research-synthesis',
            'testing-validation',
          ]).optional().describe('Optional task type hint'),
        }),
      },
      handler: async (args) => {
        const { messages, taskHint } = args;
        
        // Use Gateway's internal classifier (we'll need to expose it or simulate)
        // For now, we'll make a lightweight classification based on keywords
        const lastMessage = messages[messages.length - 1]?.content || '';
        
        let taskType: TaskType = 'philosophical-dialogue';
        let entropy: 'high' | 'low' = 'high';
        let confidence: 'hint' | 'keyword' | 'default' = 'default';
        
        if (taskHint) {
          taskType = taskHint as TaskType;
          confidence = 'hint';
        } else {
          // Keyword-based classification
          const lower = lastMessage.toLowerCase();
          
          if (lower.includes('code') || lower.includes('function') || lower.includes('class')) {
            taskType = 'code-generation';
            entropy = 'low';
            confidence = 'keyword';
          } else if (lower.includes('test') || lower.includes('validate')) {
            taskType = 'testing-validation';
            entropy = 'low';
            confidence = 'keyword';
          } else if (lower.includes('chronicle') || lower.includes('write chapter')) {
            taskType = 'chronicle-writing';
            entropy = 'low';
            confidence = 'keyword';
          } else if (lower.includes('research') || lower.includes('analyze')) {
            taskType = 'research-synthesis';
            entropy = 'high';
            confidence = 'keyword';
          } else if (lower.includes('mcp') || lower.includes('tool') || lower.includes('orchestrate')) {
            taskType = 'mcp-orchestration';
            entropy = 'high';
            confidence = 'keyword';
          } else if (lower.includes('extract') || lower.includes('pattern')) {
            taskType = 'truth-extraction';
            entropy = 'low';
            confidence = 'keyword';
          }
        }
        
        // Determine entropy based on task type
        const highEntropyTasks: TaskType[] = [
          'philosophical-dialogue',
          'mcp-orchestration',
          'research-synthesis',
        ];
        entropy = highEntropyTasks.includes(taskType) ? 'high' : 'low';
        
        const resultText = `
Task Classification:
  Type: ${taskType}
  Entropy: ${entropy}
  Confidence: ${confidence}
  
Routing Recommendation:
  Provider: ${entropy === 'high' ? 'cloud (Z.ai)' : 'local (Ollama)'}
  Reason: ${entropy === 'high' ? 'High-entropy task requires creative reasoning' : 'Low-entropy task is deterministic'}
        `.trim();
        
        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      },
    },

    // anots/gateway/status - Get Gateway health and metrics
    {
      definition: {
        name: 'anots/gateway/status',
        description: 'Get Gateway health status and performance metrics. Shows provider health, routing statistics, and performance data.',
        inputSchema: z.object({
          includeRecentDecisions: z.boolean().optional().default(false).describe('Include recent routing decisions (default: false)'),
          decisionLimit: z.number().optional().default(10).describe('Number of recent decisions to include (default: 10)'),
        }),
      },
      handler: async (args) => {
        const { includeRecentDecisions, decisionLimit = 10 } = args;
        
        const metrics = gateway.getMetrics();
        
        let statusText = `
Gateway Status:

Performance Metrics:
  Total Requests: ${metrics.requestCount}
  Success Rate: ${(metrics.successRate * 100).toFixed(1)}%
  Avg Gateway Overhead: ${metrics.avgGatewayOverheadMs.toFixed(2)}ms

Provider Performance:`;
        
        // Cloud provider metrics
        if (metrics.perProvider.cloud) {
          const cloud = metrics.perProvider.cloud;
          statusText += `
  
  Cloud (Z.ai):
    Requests: ${cloud.requestCount}
    Success Rate: ${(cloud.successRate * 100).toFixed(1)}%
    Latency P50: ${cloud.p50.toFixed(2)}ms
    Latency P95: ${cloud.p95.toFixed(2)}ms
    Latency P99: ${cloud.p99.toFixed(2)}ms`;
        }
        
        // Local provider metrics
        if (metrics.perProvider.local) {
          const local = metrics.perProvider.local;
          statusText += `
  
  Local (Ollama):
    Requests: ${local.requestCount}
    Success Rate: ${(local.successRate * 100).toFixed(1)}%
    Latency P50: ${local.p50.toFixed(2)}ms
    Latency P95: ${local.p95.toFixed(2)}ms
    Latency P99: ${local.p99.toFixed(2)}ms`;
        }
        
        // Recent routing decisions
        if (includeRecentDecisions) {
          const decisions = gateway.getRecentDecisions(decisionLimit);
          
          if (decisions.length > 0) {
            statusText += `\n\nRecent Routing Decisions (${decisions.length}):`;
            
            decisions.forEach((d, i) => {
              statusText += `
  
  ${i + 1}. ${d.taskType} (${d.entropy})
     Provider: ${d.selectedProvider}
     Model: ${d.model}
     Quota: ${d.quotaStatus.exhausted ? 'exhausted' : 'ok'}
     Cloud Health: ${d.cloudHealthStatus}
     Local Health: ${d.localHealthStatus}
     Time: ${d.timestamp.toISOString()}`;
            });
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: statusText.trim(),
            },
          ],
        };
      },
    },
  ];
}
