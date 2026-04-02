#!/usr/bin/env node
/**
 * Import CLI
 * 
 * Command-line interface for importing conversations
 * 
 * Usage:
 *   npm run import -- <file-path> [options]
 *   anots import <file-path> [options]
 */

import * as fs from 'fs/promises';
import { ImportService, ImportOptions, printImportSummary } from '../import/ImportService';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: anots import <file-path> [options]

Import conversation files (JSON/Markdown) into ANOTS memory system.

Options:
  --type <type>       Session type: ubik, axiom, or general (default: general)
  --chunk-size <n>    Messages per chapter (default: 50)
  --dry-run           Preview import without writing
  --verbose           Show detailed progress
  --help              Show this help message

Examples:
  anots import data/import/conversation.json --type ubik
  anots import data/import/chat.md --type axiom --chunk-size 100
  anots import data/import/test.json --dry-run

Supported Formats:
  - JSON: Array of messages or object with metadata
  - Markdown: Conversation with ## User/Assistant headers

What Gets Imported:
  1. Chronicle: Conversation history in chapters
  2. Hive Mind: Semantic indexing for search
  3. Codex: Extracted truths and insights

See data/import/README.md for detailed documentation.
`);
    process.exit(0);
  }

  const options: ImportOptions = {
    filePath: args[0],
    sessionType: 'general',
    dryRun: false,
    chunkSize: 50,
    verbose: false,
  };

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      const type = args[i + 1];
      if (type !== 'ubik' && type !== 'axiom' && type !== 'general') {
        console.error(`Invalid session type: ${type}. Use: ubik, axiom, or general`);
        process.exit(1);
      }
      options.sessionType = type as 'ubik' | 'axiom' | 'general';
      i++;
    } else if (args[i] === '--chunk-size' && args[i + 1]) {
      options.chunkSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    }
  }

  // Validate file exists
  try {
    await fs.access(options.filePath);
  } catch {
    console.error(`❌ File not found: ${options.filePath}`);
    process.exit(1);
  }

  // Run import
  try {
    console.log('🚀 Starting conversation import...');
    console.log(`  File: ${options.filePath}`);
    console.log(`  Session Type: ${options.sessionType}`);
    console.log(`  Chunk Size: ${options.chunkSize} messages/chapter`);
    console.log(`  Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('');

    const service = new ImportService((progress) => {
      if (options.verbose) {
        console.log(`[${progress.phase}] ${progress.message} (${progress.current}/${progress.total})`);
      }
    });

    const stats = await service.import(options);
    printImportSummary(stats);

    if (stats.errors > 0) {
      console.log('⚠️  Import completed with errors');
      process.exit(1);
    } else {
      console.log('✅ Import completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
