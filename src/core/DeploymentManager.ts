/**
 * DeploymentManager - Handles mode selection and component initialization
 * 
 * Supports three deployment modes:
 * - CLI: Command-line interface with memory operations
 * - MCP Server: Model Context Protocol server for external agents
 * - Standalone: Full agent system with LangGraph orchestration
 */

import { DeploymentConfig, DeploymentMode, DeploymentError, Service } from './types';
import { loadConfig, logConfig } from './config';

export class DeploymentManager {
  private config: DeploymentConfig;
  private services: Map<string, Service> = new Map();
  private initialized = false;

  constructor(config?: DeploymentConfig) {
    this.config = config || loadConfig();
  }

  /**
   * Initialize the deployment manager and all required services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new DeploymentError('DeploymentManager already initialized');
    }

    logConfig(this.config);

    // Initialize services based on deployment mode
    switch (this.config.mode) {
      case 'cli':
        await this.initializeCLI();
        break;
      case 'mcp-server':
        await this.initializeMCPServer();
        break;
      case 'standalone':
        await this.initializeStandalone();
        break;
      default:
        throw new DeploymentError(`Unknown deployment mode: ${this.config.mode}`);
    }

    this.initialized = true;
    console.log(`✓ ANOTS initialized in ${this.config.mode} mode`);
  }

  /**
   * Initialize CLI mode
   * Requires: Memory System (all 4 layers)
   */
  private async initializeCLI(): Promise<void> {
    console.log('Initializing CLI mode...');
    
    // Memory services will be initialized in Phase 2
    // For now, just validate the mode
    this.validateMode('cli');
  }

  /**
   * Initialize MCP Server mode
   * Requires: Memory System + Gateway + MCP Server
   */
  private async initializeMCPServer(): Promise<void> {
    console.log('Initializing MCP Server mode...');
    
    this.validateMode('mcp-server');
    
    // Validate MCP-specific configuration
    if (!this.config.mcpPort) {
      throw new DeploymentError('MCP port not configured');
    }
    
    if (this.config.mcpAuthEnabled && (!this.config.mcpApiKeys || this.config.mcpApiKeys.length === 0)) {
      throw new DeploymentError('MCP authentication enabled but no API keys configured');
    }
    
    // MCP server and tools will be initialized in Phase 4
  }

  /**
   * Initialize Standalone mode
   * Requires: Memory System + Gateway + Agent System + LangGraph
   */
  private async initializeStandalone(): Promise<void> {
    console.log('Initializing Standalone mode...');
    
    this.validateMode('standalone');
    
    // Validate Gateway is enabled
    if (!this.config.gatewayEnabled) {
      throw new DeploymentError('Gateway must be enabled for standalone mode');
    }
    
    // Agent system will be initialized in Phase 5
  }

  /**
   * Validate deployment mode
   */
  private validateMode(expectedMode: DeploymentMode): void {
    if (this.config.mode !== expectedMode) {
      throw new DeploymentError(
        `Mode mismatch: expected ${expectedMode}, got ${this.config.mode}`
      );
    }
  }

  /**
   * Register a service
   */
  registerService(name: string, service: Service): void {
    if (this.services.has(name)) {
      throw new DeploymentError(`Service ${name} already registered`);
    }
    this.services.set(name, service);
  }

  /**
   * Get a registered service
   */
  getService<T extends Service>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new DeploymentError(`Service ${name} not found`);
    }
    return service as T;
  }

  /**
   * Check if a service is registered
   */
  hasService(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('Shutting down ANOTS...');

    // Shutdown services in reverse order
    const serviceNames = this.getServiceNames().reverse();
    for (const name of serviceNames) {
      const service = this.services.get(name);
      if (service) {
        try {
          await service.shutdown();
          console.log(`✓ ${name} shutdown complete`);
        } catch (error) {
          console.error(`✗ ${name} shutdown failed:`, error);
        }
      }
    }

    this.services.clear();
    this.initialized = false;
    console.log('✓ ANOTS shutdown complete');
  }

  /**
   * Get deployment configuration
   */
  getConfig(): DeploymentConfig {
    return { ...this.config };
  }

  /**
   * Get deployment mode
   */
  getMode(): DeploymentMode {
    return this.config.mode;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [name, service] of this.services) {
      try {
        health[name] = await service.isHealthy();
      } catch (error) {
        health[name] = false;
      }
    }
    
    return health;
  }
}
