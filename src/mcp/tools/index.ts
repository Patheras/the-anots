/**
 * MCP Tools Registry
 * 
 * Central registry for all MCP tools
 */

import { MCPServer } from '../MCPServer';
import { UnifiedMemoryService } from '../../memory/UnifiedMemoryService';
import { createMemoryTools } from './memory';
import { createChronicleTools } from './chronicle';
import { registerCodexTools } from './codex';
import { createSystemTools } from './system';

/**
 * Register all MCP tools with the server
 */
export async function registerAllTools(
  server: MCPServer,
  memoryService: UnifiedMemoryService
): Promise<void> {
  // Get memory layers
  const layers = memoryService.getLayers();

  // Register memory tools
  const memoryTools = createMemoryTools(memoryService);
  server.registerTools(memoryTools);

  // Register chronicle tools
  const chronicleTools = createChronicleTools(layers.chronicle);
  server.registerTools(chronicleTools);

  // Register codex tools
  const codexTools = registerCodexTools(layers.codex);
  server.registerTools(codexTools);

  // Register system tools
  const systemTools = createSystemTools(memoryService);
  server.registerTools(systemTools);

  // Gateway tools are optional - skip for now
  // Will be added in Task 4.8 with proper initialization
}
