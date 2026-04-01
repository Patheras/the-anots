#!/usr/bin/env node
/**
 * ANOTS CLI - Cyberpunk Edition
 * 
 * Command-line interface for ANOTS Unified Platform
 * Oldschool terminal aesthetic with modern functionality
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as theme from './theme';
const { colors } = theme;
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import { runAxiomSetup, quickHandshake } from './axiom-assistant';

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

// Parse arguments
program.parse();
