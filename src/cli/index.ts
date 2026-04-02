#!/usr/bin/env node
/**
 * ANOTS CLI - Cyberpunk Edition
 * 
 * Command-line interface for ANOTS Unified Platform
 * Oldschool terminal aesthetic with modern functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as theme from './theme';
const { colors } = theme;
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import { runAxiomSetup, quickHandshake } from './axiom-assistant';
import { startAxiomChat, askAxiom } from './axiom-chat';
import { startDashboard } from './dashboard';
import { MCPServer } from '../mcp/MCPServer';
import { registerAllTools } from '../mcp/tools';
import { config } from '../core/config';
import { createMemoryServiceAPI } from '../api/MemoryServiceAPI';
import { ANOTSGateway } from '../gateway/ANOTSGateway';

const program = new Command();

// Global memory service instance
let memoryService: UnifiedMemoryService | null = null;

/**
 * Initialize memory service
 */
async function initMemoryService(): Promise<UnifiedMemoryService> {
  if (!memoryService) {
    memoryService = new UnifiedMemoryService();
    await memoryService.initialize();
  }
  return memoryService;
}

/**
 * Cleanup on exit
 */
async function cleanup() {
  if (memoryService) {
    await memoryService.shutdown();
  }
}

/**
 * Interactive main menu
 */
async function showMainMenu() {
  console.clear();
  console.log(colors.cyan(theme.banner));
  console.log('');
  console.log(colors.highlight('═══════════════════════════════════════════════════════════════'));
  console.log(colors.cyan('                    ANOTS MAIN MENU'));
  console.log(colors.highlight('═══════════════════════════════════════════════════════════════'));
  console.log('');

  const choices = [
    { name: `${colors.cyan('📊')} Dashboard (Real-time TUI)`, value: 'dashboard' },
    { name: `${colors.cyan('🤖')} Chat with Axiom (TCAM Node C)`, value: 'axiom' },
    { name: `${colors.magenta('🔍')} Search Memory`, value: 'search' },
    { name: `${colors.yellow('📈')} System Status`, value: 'status' },
    { name: `${colors.green('🚀')} Start MCP Server`, value: 'mcp' },
    { name: `${colors.cyan('🌐')} Start API Server`, value: 'api' },
    { name: `${colors.white('📥')} Import Conversation`, value: 'import' },
    { name: `${colors.dimText('⚙️  Setup / Configuration')}`, value: 'setup' },
    { name: `${colors.dimText('❓ Help')}`, value: 'help' },
    new inquirer.Separator(),
    { name: `${colors.error('✕ Exit')}`, value: 'exit' },
  ];

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
      pageSize: 15,
    },
  ]);

  switch (answer.action) {
    case 'dashboard':
      const memory = await initMemoryService();
      await startDashboard(memory);
      break;
    case 'axiom':
      await startAxiomChat();
      break;
    case 'search':
      await interactiveSearch();
      break;
    case 'status':
      await showStatus();
      await pressAnyKey();
      await showMainMenu();
      break;
    case 'mcp':
      await startMCPInteractive();
      break;
    case 'api':
      await startAPIInteractive();
      break;
    case 'import':
      await importInteractive();
      break;
    case 'setup':
      await runAxiomSetup();
      await pressAnyKey();
      await showMainMenu();
      break;
    case 'help':
      showHelp();
      await pressAnyKey();
      await showMainMenu();
      break;
    case 'exit':
      console.log(theme.warning('\n⚠ Shutting down...'));
      await cleanup();
      process.exit(0);
      break;
  }
}

/**
 * Interactive search
 */
async function interactiveSearch() {
  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: 'Enter search query:',
      validate: (input) => input.trim().length > 0 || 'Query cannot be empty',
    },
    {
      type: 'number',
      name: 'limit',
      message: 'Maximum results:',
      default: 10,
    },
  ]);

  try {
    const memory = await initMemoryService();
    console.log(theme.info(`\n▸ Searching memory layers for: "${answer.query}"\n`));

    const results = await memory.search(answer.query, answer.limit);

    if (results.length === 0) {
      console.log(theme.warning('No results found'));
    } else {
      console.log(theme.success(`Found ${results.length} results:\n`));

      results.forEach((result, index) => {
        console.log(colors.highlight(`[${index + 1}]`));
        console.log(theme.bullet(`Source: ${result.source}`));
        console.log(theme.bullet(`Score: ${result.score.toFixed(2)}`));
        console.log(theme.bullet(`Content: ${result.content.substring(0, 100)}...`));
        console.log('');
      });
    }
  } catch (error) {
    console.error(theme.error(`Search failed: ${(error as Error).message}`));
  }

  await pressAnyKey();
  await showMainMenu();
}

/**
 * Show system status
 */
async function showStatus() {
  try {
    const memory = await initMemoryService();

    console.log(theme.info('\n▸ System Status\n'));

    const health = await memory.getLayerHealth();
    const isHealthy = await memory.isHealthy();

    console.log(theme.subheader('Overall Status:'));
    console.log(theme.bullet(isHealthy ? theme.success('✓ OPERATIONAL') : theme.error('✗ DEGRADED')));
    console.log('');

    console.log(theme.subheader('Layer Health:'));
    console.log(theme.bullet(`L1:Chronicle     ${health.chronicle ? theme.success('✓') : theme.error('✗')}`));
    console.log(theme.bullet(`L2:ActiveStream  ${health.activeStream ? theme.success('✓') : theme.error('✗')}`));
    console.log(theme.bullet(`L3:HiveMind      ${health.hiveMind ? theme.success('✓') : theme.error('✗')}`));
    console.log(theme.bullet(`L4:Codex         ${health.codex ? theme.success('✓') : theme.error('✗')}`));
    console.log('');
  } catch (error) {
    console.error(theme.error(`Status check failed: ${(error as Error).message}`));
  }
}

/**
 * Start MCP server interactively
 */
async function startMCPInteractive() {
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'auth',
      message: 'Enable API key authentication?',
      default: false,
    },
  ]);

  console.log(theme.header('\nStarting MCP Server'));
  console.log('');

  try {
    const memory = await initMemoryService();

    let apiKeys: string[] = [];
    let authEnabled = answer.auth;

    if (authEnabled && config.mcpApiKeys) {
      apiKeys = config.mcpApiKeys;
      if (apiKeys.length === 0) {
        console.log(theme.warning('⚠ No API keys configured. Disabling auth.'));
        authEnabled = false;
      }
    }

    const mcpServer = new MCPServer({
      name: 'anots-mcp-server',
      version: '1.0.0',
      transport: 'stdio',
      authEnabled,
      apiKeys,
      enableLogging: true,
    });

    console.log(theme.info('▸ Registering MCP tools...'));
    await registerAllTools(mcpServer, memory);

    const tools = mcpServer.getTools();
    console.log(theme.success(`✓ Registered ${tools.length} tools`));
    console.log('');

    if (authEnabled) {
      console.log(theme.info(`▸ Authentication: ${colors.success('ENABLED')} (${apiKeys.length} keys)`));
    } else {
      console.log(theme.info(`▸ Authentication: ${colors.dimText('DISABLED')}`));
    }
    console.log('');

    console.log(theme.info('▸ Starting MCP server (stdio transport)...'));
    await mcpServer.initialize();

    console.log(theme.success('✓ MCP Server running'));
    console.log(colors.dimText('Press Ctrl+C to stop'));
    console.log('');

    process.on('SIGINT', async () => {
      console.log(theme.warning('\n\n⚠ Shutting down MCP server...'));
      await mcpServer.shutdown();
      await cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error(theme.error(`MCP server failed: ${(error as Error).message}`));
    await pressAnyKey();
    await showMainMenu();
  }
}

/**
 * Start API server interactively
 */
async function startAPIInteractive() {
  const answer = await inquirer.prompt([
    {
      type: 'number',
      name: 'port',
      message: 'API port:',
      default: 3001,
    },
    {
      type: 'confirm',
      name: 'axiom',
      message: 'Enable Axiom chat endpoint?',
      default: false,
    },
  ]);

  console.log(theme.header('\nStarting API Server'));
  console.log('');

  try {
    const memory = await initMemoryService();

    let gateway: ANOTSGateway | undefined;
    if (answer.axiom) {
      console.log(theme.info('▸ Initializing Gateway for Axiom...'));
      gateway = new ANOTSGateway({
        zaiApiKey: config.zaiApiKey,
        zaiBaseUrl: config.zaiBaseUrl || 'https://api.z.ai/api/coding/paas/v4',
        zaiModel: config.zaiModel || 'glm-5-pro',
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
        openrouterApiKey: process.env.OPENROUTER_API_KEY,
        openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        openrouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      });
      await gateway.initialize();
      console.log(theme.success('✓ Gateway initialized'));
      console.log('');
    }

    const api = createMemoryServiceAPI(
      memory,
      {
        port: answer.port,
        host: '0.0.0.0',
        enableAxiom: answer.axiom,
      },
      gateway
    );

    console.log(theme.info(`▸ Starting API server on port ${answer.port}...`));
    await api.start();

    console.log(theme.success('✓ API Server running'));
    console.log('');
    console.log(theme.subheader('Available Endpoints:'));
    console.log(theme.bullet(`GET  http://localhost:${answer.port}/api/health`));
    console.log(theme.bullet(`POST http://localhost:${answer.port}/api/memory/search`));
    console.log(theme.bullet(`POST http://localhost:${answer.port}/api/memory/store`));
    console.log(theme.bullet(`GET  http://localhost:${answer.port}/api/memory/stats`));
    console.log(theme.bullet(`POST http://localhost:${answer.port}/api/chronicle/write`));

    if (answer.axiom) {
      console.log(theme.bullet(`POST http://localhost:${answer.port}/api/axiom/chat ${colors.success('(Axiom enabled)')}`));
    }

    console.log('');
    console.log(colors.dimText('Press Ctrl+C to stop'));
    console.log('');

    process.on('SIGINT', async () => {
      console.log(theme.warning('\n\n⚠ Shutting down API server...'));
      await api.stop();
      if (gateway) {
        await gateway.shutdown();
      }
      await cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error(theme.error(`API server failed: ${(error as Error).message}`));
    await pressAnyKey();
    await showMainMenu();
  }
}

/**
 * Import conversation interactively
 */
async function importInteractive() {
  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'file',
      message: 'Path to conversation file:',
      validate: (input) => input.trim().length > 0 || 'File path cannot be empty',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Session type:',
      choices: ['general', 'ubik', 'axiom'],
      default: 'general',
    },
    {
      type: 'number',
      name: 'chunkSize',
      message: 'Messages per chapter:',
      default: 50,
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Dry run (preview only)?',
      default: false,
    },
  ]);

  try {
    const { ImportService, printImportSummary } = await import('../import/ImportService');

    console.log(theme.header('\nConversation Import'));
    console.log('');
    console.log(theme.info(`▸ File: ${answer.file}`));
    console.log(theme.info(`▸ Type: ${answer.type}`));
    console.log(theme.info(`▸ Chunk Size: ${answer.chunkSize} messages/chapter`));
    console.log(theme.info(`▸ Dry Run: ${answer.dryRun ? 'YES' : 'NO'}`));
    console.log('');

    const service = new ImportService((progress) => {
      console.log(theme.bullet(`[${progress.phase}] ${progress.message} (${progress.current}/${progress.total})`));
    });

    const stats = await service.import({
      filePath: answer.file,
      sessionType: answer.type as 'ubik' | 'axiom' | 'general',
      chunkSize: answer.chunkSize,
      dryRun: answer.dryRun,
      verbose: true,
    });

    printImportSummary(stats);

    if (stats.errors > 0) {
      console.log(theme.warning('⚠ Import completed with errors'));
    } else {
      console.log(theme.success('✓ Import completed successfully!'));
    }
  } catch (error) {
    console.error(theme.error(`Import failed: ${(error as Error).message}`));
  }

  await pressAnyKey();
  await showMainMenu();
}

/**
 * Show help
 */
function showHelp() {
  console.log(theme.header('\nANOTS CLI Help'));
  console.log('');
  console.log(theme.subheader('Interactive Mode:'));
  console.log(theme.bullet('anots                    - Main menu (you are here!)'));
  console.log('');
  console.log(theme.subheader('Direct Commands:'));
  console.log(theme.bullet('anots dashboard          - Real-time TUI dashboard'));
  console.log(theme.bullet('anots axiom              - Chat with Axiom (TCAM Node C)'));
  console.log(theme.bullet('anots mcp:start          - Start MCP server'));
  console.log(theme.bullet('anots api:start          - Start API server'));
  console.log(theme.bullet('anots status             - System status'));
  console.log(theme.bullet('anots memory:search      - Search memory'));
  console.log(theme.bullet('anots import <file>      - Import conversation'));
  console.log(theme.bullet('anots setup              - Configuration wizard'));
  console.log('');
  console.log(theme.subheader('More Info:'));
  console.log(theme.bullet('anots --help             - Full command list'));
  console.log(theme.bullet('anots <command> --help   - Command-specific help'));
  console.log('');
}

/**
 * Press any key to continue
 */
async function pressAnyKey() {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
    },
  ]);
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log(theme.warning('\n\n⚠ System shutdown initiated...'));
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// CLI Configuration
program
  .name('anots')
  .description('ANOTS - Triadic Cognitive Augmentation Matrix')
  .version('1.0.0')
  .hook('preAction', () => {
    // Show banner on first command
    if (!memoryService) {
      console.log(colors.cyan(theme.banner));
    }
  });

// Memory commands
program
  .command('memory')
  .description('Memory operations (search, store, context)')
  .action(() => {
    console.log(theme.info('Available memory commands:'));
    console.log(theme.bullet('anots memory search <query>'));
    console.log(theme.bullet('anots memory store <content>'));
    console.log(theme.bullet('anots memory context [sessionId]'));
    console.log(theme.bullet('anots memory clear <sessionId>'));
    console.log(theme.bullet('anots memory stats'));
  });

program
  .command('memory:search')
  .description('Search across all memory layers')
  .argument('<query>', 'Search query')
  .option('-l, --limit <number>', 'Maximum results', '20')
  .action(async (query: string, options: { limit: string }) => {
    try {
      const memory = await initMemoryService();
      const limit = parseInt(options.limit);
      
      console.log(theme.info(`\n▸ Searching memory layers for: "${query}"\n`));
      
      const results = await memory.search(query, limit);
      
      if (results.length === 0) {
        console.log(theme.warning('No results found'));
      } else {
        console.log(theme.success(`Found ${results.length} results:\n`));
        
        results.forEach((result, index) => {
          console.log(colors.highlight(`[${index + 1}]`));
          console.log(theme.bullet(`Source: ${result.source}`));
          console.log(theme.bullet(`Score: ${result.score.toFixed(2)}`));
          console.log(theme.bullet(`Content: ${result.content.substring(0, 100)}...`));
          console.log('');
        });
      }
    } catch (error) {
      console.error(theme.error(`Search failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('memory:store')
  .description('Store content in memory')
  .argument('<content>', 'Content to store')
  .option('-m, --metadata <json>', 'Metadata as JSON')
  .action(async (content: string, options: { metadata?: string }) => {
    try {
      const memory = await initMemoryService();
      
      let metadata: Record<string, any> | undefined;
      if (options.metadata) {
        metadata = JSON.parse(options.metadata);
      }
      
      console.log(theme.info('\n▸ Storing in memory layers...\n'));
      
      await memory.store(content, metadata);
      
      console.log(theme.success('✓ Content stored successfully'));
    } catch (error) {
      console.error(theme.error(`Store failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('memory:stats')
  .description('Show memory statistics')
  .action(async () => {
    try {
      const memory = await initMemoryService();
      
      console.log(theme.info('\n▸ Memory System Statistics\n'));
      
      const stats = await memory.getStats();
      const health = await memory.getLayerHealth();
      
      console.log(theme.subheader('Layer Status:'));
      console.log(theme.bullet(`L1:Chronicle     ${health.chronicle ? theme.success('✓ ONLINE') : theme.error('✗ OFFLINE')} - ${stats.chronicle.chapterCount} chapters`));
      console.log(theme.bullet(`L2:ActiveStream  ${health.activeStream ? theme.success('✓ ONLINE') : theme.error('✗ OFFLINE')} - ${stats.activeStream.sessionCount} sessions`));
      console.log(theme.bullet(`L3:HiveMind      ${health.hiveMind ? theme.success('✓ ONLINE') : theme.error('✗ OFFLINE')} - ${stats.hiveMind.memoryCount} memories`));
      console.log(theme.bullet(`L4:Codex         ${health.codex ? theme.success('✓ ONLINE') : theme.error('✗ OFFLINE')} - Ubik: ${stats.codex.ubikInitialized ? '✓' : '✗'}, Axiom: ${stats.codex.axiomInitialized ? '✓' : '✗'}`));
      console.log('');
    } catch (error) {
      console.error(theme.error(`Stats failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Chronicle commands
program
  .command('chronicle')
  .description('Chronicle operations (long-term memory)')
  .action(() => {
    console.log(theme.info('Available chronicle commands:'));
    console.log(theme.bullet('anots chronicle list [type]'));
    console.log(theme.bullet('anots chronicle read <chapterId>'));
    console.log(theme.bullet('anots chronicle search <query>'));
  });

program
  .command('chronicle:list')
  .description('List chronicle chapters')
  .argument('[type]', 'Session type (general, ubik, axiom)', 'general')
  .action(async (type: string) => {
    try {
      const memory = await initMemoryService();
      const layers = memory.getLayers();
      
      console.log(theme.info(`\n▸ Chronicle Chapters (${type})\n`));
      
      const chapters = await layers.chronicle.list(type as any);
      
      if (chapters.length === 0) {
        console.log(theme.warning('No chapters found'));
      } else {
        console.log(theme.success(`Found ${chapters.length} chapters:\n`));
        
        chapters.slice(0, 10).forEach((chapter) => {
          console.log(colors.highlight(`${chapter.chapterId}`));
          console.log(theme.bullet(`Date: ${chapter.date}`));
          console.log(theme.bullet(`Participants: ${chapter.participants.join(', ')}`));
          console.log(theme.bullet(`Preview: ${chapter.content.substring(0, 80)}...`));
          console.log('');
        });
        
        if (chapters.length > 10) {
          console.log(colors.dimText(`... and ${chapters.length - 10} more`));
        }
      }
    } catch (error) {
      console.error(theme.error(`List failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Codex commands
program
  .command('codex')
  .description('Agent codex operations')
  .action(() => {
    console.log(theme.info('Available codex commands:'));
    console.log(theme.bullet('anots codex read <agent>'));
    console.log(theme.bullet('anots codex list <agent>'));
  });

program
  .command('codex:read')
  .description('Read agent codex')
  .argument('<agent>', 'Agent name (ubik, axiom)')
  .action(async (agent: string) => {
    try {
      const memory = await initMemoryService();
      
      console.log(theme.info(`\n▸ ${agent.toUpperCase()} Codex\n`));
      
      const codex = await memory.readCodex(agent as any);
      
      console.log(theme.subheader('Identity:'));
      console.log(colors.text(codex.identity.substring(0, 200) + '...\n'));
      
      console.log(theme.subheader('Active Tasks:'));
      console.log(colors.text(codex.tasks.substring(0, 200) + '...\n'));
      
      console.log(colors.dimText(`Last updated: ${codex.lastUpdated}`));
    } catch (error) {
      console.error(theme.error(`Read failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// System commands
program
  .command('dashboard')
  .description('Real-time monitoring dashboard (Terminal UI)')
  .option('-r, --refresh <ms>', 'Refresh interval in milliseconds', '2000')
  .action(async (options: { refresh: string }) => {
    try {
      const memory = await initMemoryService();
      const { startDashboard } = await import('./dashboard');
      
      await startDashboard(memory);
    } catch (error) {
      console.error(theme.error(`Dashboard failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Quick initialization with Axiom handshake')
  .action(async () => {
    await quickHandshake();
    
    try {
      const memory = await initMemoryService();
      const health = await memory.getLayerHealth();
      
      console.log(theme.header('System Initialized'));
      console.log(theme.bullet(`L1:Chronicle     ${health.chronicle ? colors.success('✓') : colors.error('✗')}`));
      console.log(theme.bullet(`L2:ActiveStream  ${health.activeStream ? colors.success('✓') : colors.error('✗')}`));
      console.log(theme.bullet(`L3:HiveMind      ${health.hiveMind ? colors.success('✓') : colors.error('✗')}`));
      console.log(theme.bullet(`L4:Codex         ${health.codex ? colors.success('✓') : colors.error('✗')}`));
      console.log('');
      console.log(colors.success('✓ System ready'));
    } catch (error) {
      console.error(colors.error(`Initialization failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Interactive setup with Axiom assistant')
  .action(async () => {
    await runAxiomSetup();
  });

// Chat commands
program
  .command('axiom')
  .description('Interactive chat with Axiom (TCAM Node C / SACOP)')
  .action(async () => {
    await startAxiomChat();
  });

program
  .command('chat')
  .description('Interactive chat with Axiom (alias for axiom)')
  .action(async () => {
    await startAxiomChat();
  });

program
  .command('ask')
  .description('Ask Axiom a quick question')
  .argument('<question>', 'Your question')
  .action(async (question: string) => {
    await askAxiom(question);
  });

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    try {
      const memory = await initMemoryService();
      
      console.log(theme.info('\n▸ System Status\n'));
      
      const health = await memory.getLayerHealth();
      const isHealthy = await memory.isHealthy();
      
      console.log(theme.subheader('Overall Status:'));
      console.log(theme.bullet(isHealthy ? theme.success('✓ OPERATIONAL') : theme.error('✗ DEGRADED')));
      console.log('');
      
      console.log(theme.subheader('Layer Health:'));
      console.log(theme.bullet(`L1:Chronicle     ${health.chronicle ? theme.success('✓') : theme.error('✗')}`));
      console.log(theme.bullet(`L2:ActiveStream  ${health.activeStream ? theme.success('✓') : theme.error('✗')}`));
      console.log(theme.bullet(`L3:HiveMind      ${health.hiveMind ? theme.success('✓') : theme.error('✗')}`));
      console.log(theme.bullet(`L4:Codex         ${health.codex ? theme.success('✓') : theme.error('✗')}`));
      console.log('');
    } catch (error) {
      console.error(theme.error(`Status check failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// MCP Server commands
program
  .command('mcp:start')
  .description('Start MCP server (Model Context Protocol)')
  .option('--auth', 'Enable API key authentication')
  .option('--keys <keys>', 'Comma-separated API keys (if auth enabled)')
  .action(async (options: { auth?: boolean; keys?: string }) => {
    try {
      console.log(theme.header('Starting MCP Server'));
      console.log('');
      
      // Initialize memory service
      const memory = await initMemoryService();
      
      // Parse API keys from environment or options
      let apiKeys: string[] = [];
      let authEnabled = options.auth || config.mcpAuthEnabled;
      
      if (authEnabled) {
        if (options.keys) {
          apiKeys = options.keys.split(',').map(k => k.trim());
        } else if (config.mcpApiKeys) {
          apiKeys = config.mcpApiKeys; // Already an array
        }
        
        if (apiKeys.length === 0) {
          console.log(theme.warning('⚠ Auth enabled but no API keys provided. Disabling auth.'));
          authEnabled = false;
        }
      }
      
      // Create MCP server
      const mcpServer = new MCPServer({
        name: 'anots-mcp-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled,
        apiKeys,
        enableLogging: true,
      });
      
      // Register all tools
      console.log(theme.info('▸ Registering MCP tools...'));
      await registerAllTools(mcpServer, memory);
      
      const tools = mcpServer.getTools();
      console.log(theme.success(`✓ Registered ${tools.length} tools`));
      console.log('');
      
      if (authEnabled) {
        console.log(theme.info(`▸ Authentication: ${colors.success('ENABLED')} (${apiKeys.length} keys)`));
      } else {
        console.log(theme.info(`▸ Authentication: ${colors.dimText('DISABLED')}`));
      }
      console.log('');
      
      // Initialize and start server
      console.log(theme.info('▸ Starting MCP server (stdio transport)...'));
      await mcpServer.initialize();
      
      console.log(theme.success('✓ MCP Server running'));
      console.log(colors.dimText('Press Ctrl+C to stop'));
      console.log('');
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log(theme.warning('\n\n⚠ Shutting down MCP server...'));
        await mcpServer.shutdown();
        await cleanup();
        process.exit(0);
      });
      
    } catch (error) {
      console.error(theme.error(`MCP server failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('mcp:tools')
  .description('List available MCP tools')
  .action(async () => {
    try {
      console.log(theme.header('Available MCP Tools'));
      console.log('');
      
      // Initialize memory service
      const memory = await initMemoryService();
      
      // Create temporary server to get tool list
      const mcpServer = new MCPServer({
        name: 'anots-mcp-server',
        version: '1.0.0',
        transport: 'stdio',
        enableLogging: false,
      });
      
      await registerAllTools(mcpServer, memory);
      const tools = mcpServer.getTools();
      
      // Group tools by category
      const categories: Record<string, string[]> = {
        memory: [],
        chronicle: [],
        gateway: [],
        codex: [],
        system: [],
      };
      
      tools.forEach(tool => {
        const category = tool.split('/')[1];
        if (categories[category]) {
          categories[category].push(tool);
        }
      });
      
      // Display tools by category
      Object.entries(categories).forEach(([category, toolList]) => {
        if (toolList.length > 0) {
          console.log(theme.subheader(`${category.toUpperCase()}:`));
          toolList.forEach(tool => {
            console.log(theme.bullet(tool));
          });
          console.log('');
        }
      });
      
      console.log(theme.success(`Total: ${tools.length} tools`));
      
    } catch (error) {
      console.error(theme.error(`Failed to list tools: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// API Server commands
program
  .command('api:start')
  .description('Start REST API server (with optional Axiom chat)')
  .option('-p, --port <port>', 'API port', '3001')
  .option('--axiom', 'Enable Axiom chat endpoint')
  .action(async (options: { port: string; axiom?: boolean }) => {
    try {
      console.log(theme.header('Starting API Server'));
      console.log('');
      
      // Initialize memory service
      const memory = await initMemoryService();
      
      // Initialize gateway if Axiom enabled
      let gateway: ANOTSGateway | undefined;
      if (options.axiom) {
        console.log(theme.info('▸ Initializing Gateway for Axiom...'));
        gateway = new ANOTSGateway({
          zaiApiKey: config.zaiApiKey,
          zaiBaseUrl: config.zaiBaseUrl || 'https://api.z.ai/api/coding/paas/v4',
          zaiModel: config.zaiModel || 'glm-5-pro',
          ollamaBaseUrl: config.ollamaBaseUrl,
          ollamaModel: config.ollamaModel,
          openrouterApiKey: process.env.OPENROUTER_API_KEY,
          openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          openrouterModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        });
        await gateway.initialize();
        console.log(theme.success('✓ Gateway initialized'));
        console.log('');
      }
      
      // Create API server
      const api = createMemoryServiceAPI(
        memory,
        {
          port: parseInt(options.port),
          host: '0.0.0.0',
          enableAxiom: options.axiom,
        },
        gateway
      );
      
      console.log(theme.info(`▸ Starting API server on port ${options.port}...`));
      await api.start();
      
      console.log(theme.success('✓ API Server running'));
      console.log('');
      console.log(theme.subheader('Available Endpoints:'));
      console.log(theme.bullet(`GET  http://localhost:${options.port}/api/health`));
      console.log(theme.bullet(`POST http://localhost:${options.port}/api/memory/search`));
      console.log(theme.bullet(`POST http://localhost:${options.port}/api/memory/store`));
      console.log(theme.bullet(`GET  http://localhost:${options.port}/api/memory/stats`));
      console.log(theme.bullet(`POST http://localhost:${options.port}/api/chronicle/write`));
      
      if (options.axiom) {
        console.log(theme.bullet(`POST http://localhost:${options.port}/api/axiom/chat ${colors.success('(Axiom enabled)')}`));
      }
      
      console.log('');
      console.log(colors.dimText('Press Ctrl+C to stop'));
      console.log('');
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log(theme.warning('\n\n⚠ Shutting down API server...'));
        await api.stop();
        if (gateway) {
          await gateway.shutdown();
        }
        await cleanup();
        process.exit(0);
      });
      
    } catch (error) {
      console.error(theme.error(`API server failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Import commands
program
  .command('import')
  .description('Import conversation files (JSON/Markdown) into memory')
  .argument('<file>', 'Path to conversation file')
  .option('-t, --type <type>', 'Session type: ubik, axiom, or general', 'general')
  .option('-c, --chunk-size <size>', 'Messages per chapter', '50')
  .option('--dry-run', 'Preview import without writing')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (file: string, options: { type: string; chunkSize: string; dryRun?: boolean; verbose?: boolean }) => {
    try {
      // Dynamically import to avoid loading unless needed
      const { ImportService, printImportSummary } = await import('../import/ImportService');
      
      console.log(theme.header('Conversation Import'));
      console.log('');
      console.log(theme.info(`▸ File: ${file}`));
      console.log(theme.info(`▸ Type: ${options.type}`));
      console.log(theme.info(`▸ Chunk Size: ${options.chunkSize} messages/chapter`));
      console.log(theme.info(`▸ Dry Run: ${options.dryRun ? 'YES' : 'NO'}`));
      console.log('');
      
      const service = new ImportService((progress) => {
        if (options.verbose) {
          console.log(theme.bullet(`[${progress.phase}] ${progress.message} (${progress.current}/${progress.total})`));
        }
      });
      
      const stats = await service.import({
        filePath: file,
        sessionType: options.type as 'ubik' | 'axiom' | 'general',
        chunkSize: parseInt(options.chunkSize),
        dryRun: options.dryRun,
        verbose: options.verbose,
      });
      
      printImportSummary(stats);
      
      if (stats.errors > 0) {
        console.log(theme.warning('⚠ Import completed with errors'));
        process.exit(1);
      } else {
        console.log(theme.success('✓ Import completed successfully!'));
      }
      
    } catch (error) {
      console.error(theme.error(`Import failed: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Parse arguments
if (process.argv.length === 2) {
  // No arguments provided - show main menu
  showMainMenu().catch((error) => {
    console.error(theme.error(`Error: ${error.message}`));
    process.exit(1);
  });
} else {
  // Arguments provided - use commander
  program.parse();
}

