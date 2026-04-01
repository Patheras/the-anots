/**
 * Configuration loader for ANOTS Unified Platform
 * Reads from environment variables with sensible defaults
 */

import { DeploymentConfig, DeploymentMode, DeploymentError } from './types';
import dotenv from 'dotenv';

// Load .env file if it exists
dotenv.config();

/**
 * Validate deployment mode
 */
function validateMode(mode: string): DeploymentMode {
  const validModes: DeploymentMode[] = ['cli', 'mcp-server', 'standalone'];
  
  if (!validModes.includes(mode as DeploymentMode)) {
    throw new DeploymentError(
      `Invalid deployment mode: ${mode}. Must be one of: ${validModes.join(', ')}`
    );
  }
  
  return mode as DeploymentMode;
}

/**
 * Parse comma-separated API keys
 */
function parseApiKeys(keys?: string): string[] | undefined {
  if (!keys || keys.trim() === '') {
    return undefined;
  }
  return keys.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): DeploymentConfig {
  const mode = validateMode(process.env.ANOTS_MODE || 'cli');
  
  const config: DeploymentConfig = {
    // Deployment
    mode,
    dataDir: process.env.ANOTS_DATA_DIR || './data',
    
    // MCP Server
    mcpPort: process.env.ANOTS_MCP_PORT ? parseInt(process.env.ANOTS_MCP_PORT) : 3100,
    mcpAuthEnabled: process.env.ANOTS_MCP_AUTH_ENABLED === 'true',
    mcpApiKeys: parseApiKeys(process.env.ANOTS_MCP_API_KEYS),
    
    // Gateway
    gatewayEnabled: process.env.ANOTS_GATEWAY_ENABLED !== 'false', // default true
    
    // Ollama (Local LLM)
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:9b-instruct-q4_K_M',
    
    // Z.ai (Cloud LLM)
    zaiApiKey: process.env.ZAI_API_KEY,
    zaiBaseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
    zaiModel: process.env.ZAI_MODEL || 'glm-5-pro',
    
    // External Services
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    
    // Logging
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  };
  
  // Validate configuration
  validateConfig(config);
  
  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config: DeploymentConfig): void {
  // Validate MCP port
  if (config.mcpPort && (config.mcpPort < 1 || config.mcpPort > 65535)) {
    throw new DeploymentError(`Invalid MCP port: ${config.mcpPort}. Must be between 1 and 65535.`);
  }
  
  // Validate MCP auth
  if (config.mcpAuthEnabled && (!config.mcpApiKeys || config.mcpApiKeys.length === 0)) {
    throw new DeploymentError(
      'MCP authentication is enabled but no API keys provided. Set ANOTS_MCP_API_KEYS.'
    );
  }
  
  // Warn if Z.ai API key missing but gateway enabled
  if (config.gatewayEnabled && !config.zaiApiKey) {
    console.warn(
      'Warning: Gateway enabled but ZAI_API_KEY not set. Cloud LLM routing will be disabled.'
    );
  }
  
  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new DeploymentError(
      `Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`
    );
  }
}

/**
 * Log configuration (excluding sensitive values)
 */
export function logConfig(config: DeploymentConfig): void {
  console.log('ANOTS Unified Platform Configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Data Directory: ${config.dataDir}`);
  
  if (config.mode === 'mcp-server') {
    console.log(`  MCP Port: ${config.mcpPort}`);
    console.log(`  MCP Auth: ${config.mcpAuthEnabled ? 'enabled' : 'disabled'}`);
    if (config.mcpAuthEnabled) {
      console.log(`  MCP API Keys: ${config.mcpApiKeys?.length || 0} configured`);
    }
  }
  
  console.log(`  Gateway: ${config.gatewayEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  Ollama: ${config.ollamaBaseUrl} (${config.ollamaModel})`);
  
  if (config.zaiApiKey) {
    console.log(`  Z.ai: ${config.zaiBaseUrl} (${config.zaiModel})`);
  }
  
  console.log(`  Log Level: ${config.logLevel}`);
}

/**
 * Get default configuration (for testing)
 */
export function getDefaultConfig(): DeploymentConfig {
  return {
    mode: 'cli',
    dataDir: './data',
    mcpPort: 3100,
    mcpAuthEnabled: false,
    gatewayEnabled: true,
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:9b-instruct-q4_K_M',
    zaiBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
    zaiModel: 'glm-5-pro',
    redisUrl: 'redis://localhost:6379',
    qdrantUrl: 'http://localhost:6333',
    logLevel: 'info',
  };
}

// Export singleton config instance
export const config = loadConfig();
