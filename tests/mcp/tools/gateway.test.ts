/**
 * Tests for MCP Gateway Tools
 */

import { createGatewayTools } from '../../../src/mcp/tools/gateway';
import { ANOTSGateway } from '../../../src/gateway/ANOTSGateway';
import { ChatCompletion, ChatMessage, GatewayMetricsSnapshot, RoutingDecision } from '../../../src/gateway/types';

// Helper to extract text from CallToolResult
function getTextContent(result: any): string {
  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content.find((c: any) => c.type === 'text');
    return textContent?.text || '';
  }
  return '';
}

describe('MCP Gateway Tools', () => {
  let mockGateway: ANOTSGateway;
  let tools: ReturnType<typeof createGatewayTools>;

  beforeEach(() => {
    // Create mock Gateway
    mockGateway = {
      chat: jest.fn(),
      getMetrics: jest.fn(),
      getRecentDecisions: jest.fn(),
    } as any;

    tools = createGatewayTools(mockGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('anots/gateway/chat', () => {
    it('should send chat request and return response', async () => {
      const chatTool = tools.find(t => t.definition.name === 'anots/gateway/chat')!;
      expect(chatTool).toBeDefined();

      const mockResponse: ChatCompletion = {
        id: 'test-123',
        choices: [{
          message: { role: 'assistant', content: 'Hello, world!' },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        model: 'qwen3.5:latest',
      };

      (mockGateway.chat as jest.Mock).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = await chatTool.handler({ messages });
      const text = getTextContent(result);

      expect(mockGateway.chat).toHaveBeenCalledWith(messages, {});
      expect(text).toContain('Hello, world!');
      expect(text).toContain('Tokens: 15');
      expect(text).toContain('Model: qwen3.5:latest');
    });

    it('should pass task hint and options', async () => {
      const chatTool = tools.find(t => t.definition.name === 'anots/gateway/chat')!;

      const mockResponse: ChatCompletion = {
        id: 'test-123',
        choices: [{
          message: { role: 'assistant', content: 'Code generated' },
          finish_reason: 'stop',
        }],
        model: 'qwen3.5:latest',
      };

      (mockGateway.chat as jest.Mock).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Generate code' },
      ];

      await chatTool.handler({
        messages,
        taskHint: 'code-generation',
        timeoutMs: 60000,
        temperature: 0.7,
      });

      expect(mockGateway.chat).toHaveBeenCalledWith(messages, {
        taskHint: 'code-generation',
        timeoutMs: 60000,
        temperature: 0.7,
      });
    });

    it('should handle error responses', async () => {
      const chatTool = tools.find(t => t.definition.name === 'anots/gateway/chat')!;

      const mockResponse: ChatCompletion = {
        id: 'test-123',
        choices: [{
          message: { role: 'assistant', content: '[Gateway Error] All providers unavailable' },
          finish_reason: 'error',
        }],
        model: 'none',
        error: {
          code: 'all_providers_unavailable',
          details: ['cloud: timeout', 'local: connection refused'],
        },
      };

      (mockGateway.chat as jest.Mock).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = await chatTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Gateway Error');
      expect(text).toContain('all_providers_unavailable');
      expect(text).toContain('cloud: timeout');
      expect(text).toContain('local: connection refused');
      expect(result.isError).toBe(true);
    });

    it('should handle response without usage data', async () => {
      const chatTool = tools.find(t => t.definition.name === 'anots/gateway/chat')!;

      const mockResponse: ChatCompletion = {
        id: 'test-123',
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          finish_reason: 'stop',
        }],
        model: 'qwen3.5:latest',
      };

      (mockGateway.chat as jest.Mock).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = await chatTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Response');
      expect(text).not.toContain('Tokens:');
      expect(text).toContain('Model: qwen3.5:latest');
    });

    it('should handle all task hint types', async () => {
      const chatTool = tools.find(t => t.definition.name === 'anots/gateway/chat')!;

      const taskHints = [
        'philosophical-dialogue',
        'code-generation',
        'mcp-orchestration',
        'truth-extraction',
        'chronicle-writing',
        'research-synthesis',
        'testing-validation',
      ];

      const mockResponse: ChatCompletion = {
        id: 'test-123',
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          finish_reason: 'stop',
        }],
        model: 'qwen3.5:latest',
      };

      (mockGateway.chat as jest.Mock).mockResolvedValue(mockResponse);

      for (const taskHint of taskHints) {
        await chatTool.handler({
          messages: [{ role: 'user', content: 'Test' }],
          taskHint: taskHint as any,
        });

        expect(mockGateway.chat).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ taskHint })
        );
      }
    });
  });

  describe('anots/gateway/classify', () => {
    it('should classify code generation task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;
      expect(classifyTool).toBeDefined();

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Write a function to sort an array' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: code-generation');
      expect(text).toContain('Entropy: low');
      expect(text).toContain('Confidence: keyword');
      expect(text).toContain('Provider: local (Ollama)');
    });

    it('should classify philosophical dialogue task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'What is the meaning of consciousness?' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: philosophical-dialogue');
      expect(text).toContain('Entropy: high');
      expect(text).toContain('Provider: cloud (Z.ai)');
    });

    it('should classify testing validation task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Validate this test case' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: testing-validation');
      expect(text).toContain('Entropy: low');
      expect(text).toContain('Provider: local (Ollama)');
    });

    it('should classify chronicle writing task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Write a chronicle entry for this conversation' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: chronicle-writing');
      expect(text).toContain('Entropy: low');
    });

    it('should classify research synthesis task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Research and analyze this topic' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: research-synthesis');
      expect(text).toContain('Entropy: high');
    });

    it('should classify MCP orchestration task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Orchestrate multiple MCP tools' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: mcp-orchestration');
      expect(text).toContain('Entropy: high');
    });

    it('should classify truth extraction task', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Extract patterns from this data' },
      ];

      const result = await classifyTool.handler({ messages });
      const text = getTextContent(result);

      expect(text).toContain('Type: truth-extraction');
      expect(text).toContain('Entropy: low');
    });

    it('should use task hint when provided', async () => {
      const classifyTool = tools.find(t => t.definition.name === 'anots/gateway/classify')!;

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Random message' },
      ];

      const result = await classifyTool.handler({
        messages,
        taskHint: 'code-generation',
      });
      const text = getTextContent(result);

      expect(text).toContain('Type: code-generation');
      expect(text).toContain('Confidence: hint');
    });
  });

  describe('anots/gateway/status', () => {
    it('should return Gateway status and metrics', async () => {
      const statusTool = tools.find(t => t.definition.name === 'anots/gateway/status')!;
      expect(statusTool).toBeDefined();

      const mockMetrics: GatewayMetricsSnapshot = {
        requestCount: 100,
        successRate: 0.95,
        avgGatewayOverheadMs: 5.2,
        perProvider: {
          cloud: {
            p50: 150,
            p95: 300,
            p99: 500,
            successRate: 0.98,
            requestCount: 60,
          },
          local: {
            p50: 80,
            p95: 150,
            p99: 200,
            successRate: 0.92,
            requestCount: 40,
          },
        },
      };

      (mockGateway.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = await statusTool.handler({});
      const text = getTextContent(result);

      expect(mockGateway.getMetrics).toHaveBeenCalled();
      expect(text).toContain('Gateway Status');
      expect(text).toContain('Total Requests: 100');
      expect(text).toContain('Success Rate: 95.0%');
      expect(text).toContain('Avg Gateway Overhead: 5.20ms');
      expect(text).toContain('Cloud (Z.ai)');
      expect(text).toContain('Requests: 60');
      expect(text).toContain('Latency P50: 150.00ms');
      expect(text).toContain('Local (Ollama)');
      expect(text).toContain('Requests: 40');
      expect(text).toContain('Latency P50: 80.00ms');
    });

    it('should handle missing provider metrics', async () => {
      const statusTool = tools.find(t => t.definition.name === 'anots/gateway/status')!;

      const mockMetrics: GatewayMetricsSnapshot = {
        requestCount: 50,
        successRate: 1.0,
        avgGatewayOverheadMs: 3.5,
        perProvider: {
          local: {
            p50: 80,
            p95: 150,
            p99: 200,
            successRate: 1.0,
            requestCount: 50,
          },
        },
      };

      (mockGateway.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = await statusTool.handler({});
      const text = getTextContent(result);

      expect(text).toContain('Local (Ollama)');
      expect(text).not.toContain('Cloud (Z.ai)');
    });

    it('should include recent routing decisions when requested', async () => {
      const statusTool = tools.find(t => t.definition.name === 'anots/gateway/status')!;

      const mockMetrics: GatewayMetricsSnapshot = {
        requestCount: 10,
        successRate: 1.0,
        avgGatewayOverheadMs: 2.0,
        perProvider: {},
      };

      const mockDecisions: RoutingDecision[] = [
        {
          requestId: 'req-1',
          taskType: 'code-generation',
          entropy: 'low',
          selectedProvider: 'local',
          model: 'qwen3.5:latest',
          fallbackChain: ['cloud'],
          quotaStatus: { consumed: 100, limit: 1000000, exhausted: false, resetAt: new Date() },
          cloudHealthStatus: 'healthy',
          localHealthStatus: 'healthy',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          requestId: 'req-2',
          taskType: 'philosophical-dialogue',
          entropy: 'high',
          selectedProvider: 'cloud',
          model: 'glm-5-pro',
          fallbackChain: ['local'],
          quotaStatus: { consumed: 200, limit: 1000000, exhausted: false, resetAt: new Date() },
          cloudHealthStatus: 'healthy',
          localHealthStatus: 'healthy',
          timestamp: new Date('2024-01-01T10:01:00Z'),
        },
      ];

      (mockGateway.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      (mockGateway.getRecentDecisions as jest.Mock).mockReturnValue(mockDecisions);

      const result = await statusTool.handler({
        includeRecentDecisions: true,
        decisionLimit: 5,
      });
      const text = getTextContent(result);

      expect(mockGateway.getRecentDecisions).toHaveBeenCalledWith(5);
      expect(text).toContain('Recent Routing Decisions (2)');
      expect(text).toContain('code-generation (low)');
      expect(text).toContain('Provider: local');
      expect(text).toContain('philosophical-dialogue (high)');
      expect(text).toContain('Provider: cloud');
      expect(text).toContain('Model: glm-5-pro');
    });

    it('should not include decisions when not requested', async () => {
      const statusTool = tools.find(t => t.definition.name === 'anots/gateway/status')!;

      const mockMetrics: GatewayMetricsSnapshot = {
        requestCount: 10,
        successRate: 1.0,
        avgGatewayOverheadMs: 2.0,
        perProvider: {},
      };

      (mockGateway.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = await statusTool.handler({
        includeRecentDecisions: false,
      });
      const text = getTextContent(result);

      expect(mockGateway.getRecentDecisions).not.toHaveBeenCalled();
      expect(text).not.toContain('Recent Routing Decisions');
    });

    it('should use default decision limit', async () => {
      const statusTool = tools.find(t => t.definition.name === 'anots/gateway/status')!;

      const mockMetrics: GatewayMetricsSnapshot = {
        requestCount: 10,
        successRate: 1.0,
        avgGatewayOverheadMs: 2.0,
        perProvider: {},
      };

      (mockGateway.getMetrics as jest.Mock).mockReturnValue(mockMetrics);
      (mockGateway.getRecentDecisions as jest.Mock).mockReturnValue([]);

      await statusTool.handler({
        includeRecentDecisions: true,
      });

      expect(mockGateway.getRecentDecisions).toHaveBeenCalledWith(10);
    });
  });

  describe('Tool Registration', () => {
    it('should register all 3 Gateway tools', () => {
      expect(tools).toHaveLength(3);
      
      const toolNames = tools.map(t => t.definition.name);
      expect(toolNames).toContain('anots/gateway/chat');
      expect(toolNames).toContain('anots/gateway/classify');
      expect(toolNames).toContain('anots/gateway/status');
    });

    it('should have valid input schemas', () => {
      tools.forEach(tool => {
        expect(tool.definition.inputSchema).toBeDefined();
        expect(tool.definition.description).toBeTruthy();
      });
    });
  });
});

