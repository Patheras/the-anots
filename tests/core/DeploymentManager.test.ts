/**
 * Tests for DeploymentManager
 */

import { DeploymentManager } from '../../src/core/DeploymentManager';
import { DeploymentConfig, DeploymentError, Service } from '../../src/core/types';
import { loadConfig } from '../../src/core/config';
import * as fc from 'fast-check';

// Mock service for testing
class MockService implements Service {
  name: string;
  private healthy: boolean;
  initializeCalled = false;
  shutdownCalled = false;

  constructor(name: string, healthy = true) {
    this.name = name;
    this.healthy = healthy;
  }

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }
}

describe('DeploymentManager', () => {
  let manager: DeploymentManager;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock console methods to avoid test pollution
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterAll(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterEach(async () => {
    if (manager && manager.isInitialized()) {
      await manager.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize in CLI mode', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getMode()).toBe('cli');
    });

    it('should initialize in MCP server mode', async () => {
      const config: DeploymentConfig = {
        mode: 'mcp-server',
        dataDir: './data',
        mcpPort: 3100,
        mcpAuthEnabled: false,
        gatewayEnabled: true,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getMode()).toBe('mcp-server');
    });

    it('should initialize in standalone mode', async () => {
      const config: DeploymentConfig = {
        mode: 'standalone',
        dataDir: './data',
        gatewayEnabled: true,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getMode()).toBe('standalone');
    });

    it('should throw error when initializing twice', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      await expect(manager.initialize()).rejects.toThrow(DeploymentError);
      await expect(manager.initialize()).rejects.toThrow(/already initialized/);
    });

    it('should throw error for MCP mode without port', async () => {
      const config: DeploymentConfig = {
        mode: 'mcp-server',
        dataDir: './data',
        mcpPort: undefined,
        gatewayEnabled: true,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      
      await expect(manager.initialize()).rejects.toThrow(DeploymentError);
      await expect(manager.initialize()).rejects.toThrow(/MCP port not configured/);
    });

    it('should throw error for MCP mode with auth but no API keys', async () => {
      const config: DeploymentConfig = {
        mode: 'mcp-server',
        dataDir: './data',
        mcpPort: 3100,
        mcpAuthEnabled: true,
        mcpApiKeys: [],
        gatewayEnabled: true,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      
      await expect(manager.initialize()).rejects.toThrow(DeploymentError);
      await expect(manager.initialize()).rejects.toThrow(/no API keys configured/);
    });

    it('should throw error for standalone mode without gateway', async () => {
      const config: DeploymentConfig = {
        mode: 'standalone',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      
      await expect(manager.initialize()).rejects.toThrow(DeploymentError);
      await expect(manager.initialize()).rejects.toThrow(/Gateway must be enabled/);
    });
  });

  describe('Service Management', () => {
    beforeEach(async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();
    });

    it('should register a service', () => {
      const service = new MockService('test-service');
      
      manager.registerService('test-service', service);
      
      expect(manager.hasService('test-service')).toBe(true);
      expect(manager.getServiceNames()).toContain('test-service');
    });

    it('should throw error when registering duplicate service', () => {
      const service1 = new MockService('test-service');
      const service2 = new MockService('test-service');
      
      manager.registerService('test-service', service1);
      
      expect(() => manager.registerService('test-service', service2)).toThrow(DeploymentError);
      expect(() => manager.registerService('test-service', service2)).toThrow(/already registered/);
    });

    it('should get a registered service', () => {
      const service = new MockService('test-service');
      
      manager.registerService('test-service', service);
      const retrieved = manager.getService('test-service');
      
      expect(retrieved).toBe(service);
    });

    it('should throw error when getting non-existent service', () => {
      expect(() => manager.getService('non-existent')).toThrow(DeploymentError);
      expect(() => manager.getService('non-existent')).toThrow(/not found/);
    });

    it('should check if service exists', () => {
      const service = new MockService('test-service');
      
      expect(manager.hasService('test-service')).toBe(false);
      
      manager.registerService('test-service', service);
      
      expect(manager.hasService('test-service')).toBe(true);
    });

    it('should get all service names', () => {
      const service1 = new MockService('service-1');
      const service2 = new MockService('service-2');
      const service3 = new MockService('service-3');
      
      manager.registerService('service-1', service1);
      manager.registerService('service-2', service2);
      manager.registerService('service-3', service3);
      
      const names = manager.getServiceNames();
      
      expect(names).toHaveLength(3);
      expect(names).toContain('service-1');
      expect(names).toContain('service-2');
      expect(names).toContain('service-3');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown all services', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      const service1 = new MockService('service-1');
      const service2 = new MockService('service-2');
      
      manager.registerService('service-1', service1);
      manager.registerService('service-2', service2);

      await manager.shutdown();

      expect(service1.shutdownCalled).toBe(true);
      expect(service2.shutdownCalled).toBe(true);
      expect(manager.isInitialized()).toBe(false);
      expect(manager.getServiceNames()).toHaveLength(0);
    });

    it('should handle shutdown when not initialized', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      
      // Should not throw
      await expect(manager.shutdown()).resolves.not.toThrow();
    });

    it('should continue shutdown even if service fails', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      const failingService = {
        name: 'failing-service',
        initialize: jest.fn(),
        shutdown: jest.fn().mockRejectedValue(new Error('Shutdown failed')),
        isHealthy: jest.fn(),
      };
      
      const normalService = new MockService('normal-service');
      
      manager.registerService('failing-service', failingService);
      manager.registerService('normal-service', normalService);

      // Should not throw
      await expect(manager.shutdown()).resolves.not.toThrow();
      
      expect(failingService.shutdown).toHaveBeenCalled();
      expect(normalService.shutdownCalled).toBe(true);
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();
    });

    it('should get health status of all services', async () => {
      const healthyService = new MockService('healthy-service', true);
      const unhealthyService = new MockService('unhealthy-service', false);
      
      manager.registerService('healthy-service', healthyService);
      manager.registerService('unhealthy-service', unhealthyService);

      const health = await manager.getHealthStatus();

      expect(health['healthy-service']).toBe(true);
      expect(health['unhealthy-service']).toBe(false);
    });

    it('should handle service health check errors', async () => {
      const errorService = {
        name: 'error-service',
        initialize: jest.fn(),
        shutdown: jest.fn(),
        isHealthy: jest.fn().mockRejectedValue(new Error('Health check failed')),
      };
      
      manager.registerService('error-service', errorService);

      const health = await manager.getHealthStatus();

      expect(health['error-service']).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should return deployment configuration', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './custom/data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'debug',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      const retrievedConfig = manager.getConfig();

      expect(retrievedConfig.mode).toBe('cli');
      expect(retrievedConfig.dataDir).toBe('./custom/data');
      expect(retrievedConfig.logLevel).toBe('debug');
    });

    it('should return a copy of configuration', async () => {
      const config: DeploymentConfig = {
        mode: 'cli',
        dataDir: './data',
        gatewayEnabled: false,
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'qwen2.5:9b',
        logLevel: 'info',
      };

      manager = new DeploymentManager(config);
      await manager.initialize();

      const retrievedConfig = manager.getConfig();
      retrievedConfig.dataDir = './modified';

      expect(manager.getConfig().dataDir).toBe('./data');
    });
  });

  describe('Property Tests', () => {
    describe('Property 1: Mode Validation', () => {
      it('should only accept valid deployment modes', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.oneof(
              fc.constant('cli'),
              fc.constant('mcp-server'),
              fc.constant('standalone')
            ),
            async (mode) => {
              const config: DeploymentConfig = {
                mode: mode as any,
                dataDir: './data',
                mcpPort: mode === 'mcp-server' ? 3100 : undefined,
                gatewayEnabled: mode !== 'cli',
                ollamaBaseUrl: 'http://localhost:11434',
                ollamaModel: 'qwen2.5:9b',
                logLevel: 'info',
              };

              const testManager = new DeploymentManager(config);
              await testManager.initialize();
              
              expect(testManager.getMode()).toBe(mode);
              expect(testManager.isInitialized()).toBe(true);
              
              await testManager.shutdown();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject invalid deployment modes', () => {
        fc.assert(
          fc.property(
            fc.string().filter(s => s.trim().length > 0 && !['cli', 'mcp-server', 'standalone'].includes(s)),
            (invalidMode) => {
              // Set invalid mode in environment
              process.env.ANOTS_MODE = invalidMode;

              // loadConfig should throw, not DeploymentManager constructor
              expect(() => loadConfig()).toThrow();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Property 2: Mode Determinism', () => {
      it('should produce same initialization result for same config', () => {
        fc.assert(
          fc.asyncProperty(
            fc.record({
              mode: fc.oneof(
                fc.constant('cli' as const),
                fc.constant('mcp-server' as const),
                fc.constant('standalone' as const)
              ),
              dataDir: fc.string(),
              logLevel: fc.oneof(
                fc.constant('debug' as const),
                fc.constant('info' as const),
                fc.constant('warn' as const),
                fc.constant('error' as const)
              ),
            }),
            async (configBase) => {
              const config: DeploymentConfig = {
                ...configBase,
                mcpPort: configBase.mode === 'mcp-server' ? 3100 : undefined,
                gatewayEnabled: configBase.mode !== 'cli',
                ollamaBaseUrl: 'http://localhost:11434',
                ollamaModel: 'qwen2.5:9b',
              };

              const manager1 = new DeploymentManager(config);
              const manager2 = new DeploymentManager(config);

              await manager1.initialize();
              await manager2.initialize();

              expect(manager1.getMode()).toBe(manager2.getMode());
              expect(manager1.isInitialized()).toBe(manager2.isInitialized());

              await manager1.shutdown();
              await manager2.shutdown();
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });
});
