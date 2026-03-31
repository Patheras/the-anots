/**
 * Tests for configuration loader
 */

import { loadConfig, getDefaultConfig, logConfig } from '../../src/core/config';
import { DeploymentError } from '../../src/core/types';

describe('Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default configuration when no env vars set', () => {
      delete process.env.ANOTS_MODE;
      delete process.env.ANOTS_DATA_DIR;

      const config = loadConfig();

      expect(config.mode).toBe('cli');
      expect(config.dataDir).toBe('./data');
      expect(config.gatewayEnabled).toBe(true);
      expect(config.logLevel).toBe('info');
    });

    it('should load CLI mode configuration', () => {
      process.env.ANOTS_MODE = 'cli';
      process.env.ANOTS_DATA_DIR = '/custom/data';

      const config = loadConfig();

      expect(config.mode).toBe('cli');
      expect(config.dataDir).toBe('/custom/data');
    });

    it('should load MCP server mode configuration', () => {
      process.env.ANOTS_MODE = 'mcp-server';
      process.env.ANOTS_MCP_PORT = '3200';
      process.env.ANOTS_MCP_AUTH_ENABLED = 'true';
      process.env.ANOTS_MCP_API_KEYS = 'key1,key2,key3';

      const config = loadConfig();

      expect(config.mode).toBe('mcp-server');
      expect(config.mcpPort).toBe(3200);
      expect(config.mcpAuthEnabled).toBe(true);
      expect(config.mcpApiKeys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should load standalone mode configuration', () => {
      process.env.ANOTS_MODE = 'standalone';
      process.env.ANOTS_GATEWAY_ENABLED = 'true';

      const config = loadConfig();

      expect(config.mode).toBe('standalone');
      expect(config.gatewayEnabled).toBe(true);
    });

    it('should throw error for invalid mode', () => {
      process.env.ANOTS_MODE = 'invalid-mode';

      expect(() => loadConfig()).toThrow(DeploymentError);
      expect(() => loadConfig()).toThrow(/Invalid deployment mode/);
    });

    it('should throw error for invalid MCP port', () => {
      process.env.ANOTS_MODE = 'mcp-server';
      process.env.ANOTS_MCP_PORT = '99999';

      expect(() => loadConfig()).toThrow(DeploymentError);
      expect(() => loadConfig()).toThrow(/Invalid MCP port/);
    });

    it('should throw error when MCP auth enabled but no API keys', () => {
      process.env.ANOTS_MODE = 'mcp-server';
      process.env.ANOTS_MCP_AUTH_ENABLED = 'true';
      delete process.env.ANOTS_MCP_API_KEYS;

      expect(() => loadConfig()).toThrow(DeploymentError);
      expect(() => loadConfig()).toThrow(/no API keys provided/);
    });

    it('should parse comma-separated API keys correctly', () => {
      process.env.ANOTS_MODE = 'mcp-server';
      process.env.ANOTS_MCP_AUTH_ENABLED = 'true';
      process.env.ANOTS_MCP_API_KEYS = ' key1 , key2 , key3 ';

      const config = loadConfig();

      expect(config.mcpApiKeys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should handle empty API keys string', () => {
      process.env.ANOTS_MODE = 'cli';
      process.env.ANOTS_MCP_API_KEYS = '';

      const config = loadConfig();

      expect(config.mcpApiKeys).toBeUndefined();
    });

    it('should load Ollama configuration', () => {
      process.env.OLLAMA_BASE_URL = 'http://custom:11434';
      process.env.OLLAMA_MODEL = 'llama3:8b';

      const config = loadConfig();

      expect(config.ollamaBaseUrl).toBe('http://custom:11434');
      expect(config.ollamaModel).toBe('llama3:8b');
    });

    it('should load Z.ai configuration', () => {
      process.env.ZAI_API_KEY = 'test-key';
      process.env.ZAI_BASE_URL = 'https://custom.z.ai';
      process.env.ZAI_MODEL = 'custom-model';

      const config = loadConfig();

      expect(config.zaiApiKey).toBe('test-key');
      expect(config.zaiBaseUrl).toBe('https://custom.z.ai');
      expect(config.zaiModel).toBe('custom-model');
    });

    it('should load external service URLs', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      process.env.QDRANT_URL = 'http://custom:6333';

      const config = loadConfig();

      expect(config.redisUrl).toBe('redis://custom:6379');
      expect(config.qdrantUrl).toBe('http://custom:6333');
    });

    it('should load log level', () => {
      process.env.LOG_LEVEL = 'debug';

      const config = loadConfig();

      expect(config.logLevel).toBe('debug');
    });

    it('should throw error for invalid log level', () => {
      process.env.LOG_LEVEL = 'invalid';

      expect(() => loadConfig()).toThrow(DeploymentError);
      expect(() => loadConfig()).toThrow(/Invalid log level/);
    });

    it('should warn when gateway enabled but no Z.ai API key', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      process.env.ANOTS_GATEWAY_ENABLED = 'true';
      delete process.env.ZAI_API_KEY;

      loadConfig();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ZAI_API_KEY not set')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config.mode).toBe('cli');
      expect(config.dataDir).toBe('./data');
      expect(config.mcpPort).toBe(3100);
      expect(config.mcpAuthEnabled).toBe(false);
      expect(config.gatewayEnabled).toBe(true);
      expect(config.logLevel).toBe('info');
    });
  });

  describe('logConfig', () => {
    it('should log configuration without sensitive data', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = getDefaultConfig();
      logConfig(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ANOTS Unified Platform Configuration')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mode: cli')
      );

      consoleSpy.mockRestore();
    });

    it('should log MCP configuration in mcp-server mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const config = {
        ...getDefaultConfig(),
        mode: 'mcp-server' as const,
        mcpAuthEnabled: true,
        mcpApiKeys: ['key1', 'key2'],
      };
      logConfig(config);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP Port: 3100')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP Auth: enabled')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP API Keys: 2 configured')
      );

      consoleSpy.mockRestore();
    });
  });
});
