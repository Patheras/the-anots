/**
 * Axiom Chat - Documentation-Based Assistant
 * 
 * Axiom only answers from system documentation
 * Personality: Analytical, precise, slightly sarcastic
 * Knowledge: System architecture, commands, configuration
 */

import inquirer from 'inquirer';
import * as theme from './theme';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import * as fs from 'fs/promises';
import * as path from 'path';

const { colors } = theme;

/**
 * Axiom's knowledge base (from documentation)
 */
const axiomKnowledge = {
  // System architecture
  architecture: {
    keywords: ['architecture', 'layers', 'memory', 'system', 'structure', 'design'],
    response: `The TCAM (Triadic Cognitive Augmentation Matrix) has a 4-layer memory architecture:

L1: Chronicle - Long-term storage (file-based, Git versioned)
    • Append-only markdown files
    • Organized by date and session type
    • Immutable history

L2: Active Stream - Real-time context (Redis with file fallback)
    • Session-based context management
    • Message history
    • TTL support

L3: Hive Mind - Semantic memory (Qdrant + Mem0 with file fallback)
    • Vector-based semantic search
    • Automatic fact extraction
    • Embedding generation

L4: Codex - Agent knowledge base (file-based, Git versioned)
    • Per-agent directories (Ubik, Axiom)
    • Standard files: README, TASKS, DIARY, NOTES, CONTEXT, TOOLS
    • Agent isolation

All layers operate independently. Failures don't cascade.
Graceful degradation: External services → File fallback.`,
  },

  // Commands
  commands: {
    keywords: ['command', 'cli', 'how to', 'usage', 'run', 'execute'],
    response: `Available commands:

Memory Operations:
  anots memory search <query>     - Search across all layers
  anots memory store <content>    - Store in memory
  anots memory stats              - Show statistics

Chronicle Operations:
  anots chronicle list [type]     - List chapters
  anots chronicle read <id>       - Read specific chapter

Codex Operations:
  anots codex read <agent>        - Read agent codex
  anots codex list <agent>        - List codex files

System:
  anots init                      - Quick initialization
  anots setup                     - Interactive setup
  anots status                    - System health check

For detailed usage: anots <command> --help`,
  },

  // Configuration
  configuration: {
    keywords: ['config', 'setup', 'environment', '.env', 'configure', 'settings'],
    response: `Configuration via .env file:

Required:
  CHRONICLE_ROOT=data/chronicle   - Chronicle storage path
  CODEX_ROOT=codex                - Codex storage path

Optional (for enhanced features):
  OLLAMA_URL=http://localhost:11434
  EMBEDDING_MODEL=nomic-embed-text
  REDIS_URL=redis://localhost:6379
  QDRANT_URL=http://localhost:6333

Generate .env: anots setup
The system works without external services (file fallback).`,
  },

  // Troubleshooting
  troubleshooting: {
    keywords: ['error', 'problem', 'issue', 'not working', 'failed', 'help', 'fix'],
    response: `Common issues and solutions:

1. "Service not initialized"
   → Run: anots init

2. "Layer offline"
   → Check: anots status
   → System uses file fallback automatically

3. "Git not found"
   → Install Git for versioning
   → System works without it (limited versioning)

4. "Ollama connection failed"
   → Optional service, system uses text search fallback
   → Start Ollama: ollama serve

5. "Permission denied"
   → Check directory permissions
   → Ensure write access to data directories

Run diagnostics: anots setup → "Run system diagnostics"`,
  },

  // LLM integration
  llm: {
    keywords: ['llm', 'model', 'ollama', 'ai', 'language model', 'embedding'],
    response: `LLM Integration (Optional):

Zero LLM Mode (Default):
  • Keyword-based search
  • File-based storage
  • No external dependencies
  • Cost: $0/month

Lite Mode (Recommended):
  • Ollama + nomic-embed-text (274 MB)
  • Semantic search
  • Local, free
  • Cost: $0/month

Full Mode (Optimal):
  • Ollama + Qwen 3.5 9B (5.8 GB)
  • Semantic search + fact extraction
  • Local, free
  • Cost: $0/month

Install: ollama pull nomic-embed-text
Configure: anots setup`,
  },

  // Graceful degradation
  degradation: {
    keywords: ['fallback', 'degradation', 'offline', 'unavailable', 'backup'],
    response: `Graceful Degradation Strategy:

Layer Independence:
  • Each layer operates independently
  • One layer fails → others continue
  • No cascading failures

Automatic Fallbacks:
  L2: Redis → File storage
  L3: Qdrant → File storage
  L3: Semantic search → Text search

Search Fallback Chain:
  1. Try Hive Mind (semantic)
  2. Fall back to Chronicle (text)
  3. Return results or empty array

Store Fallback Chain:
  1. Try Hive Mind (indexing)
  2. Try Chronicle (storage)
  3. Succeed if either works

System is resilient. Minimum requirement: Node.js + disk space.`,
  },
};

/**
 * Axiom's personality responses
 */
const axiomPersonality = {
  greeting: [
    'Axiom online. State your query.',
    'I am Axiom. I speak only from documentation.',
    'Technical inquiries only. I am not a conversationalist.',
  ],
  
  unknown: [
    'Query outside my knowledge domain.',
    'Consult documentation: docs/README.md',
    'I only answer from system documentation.',
    'That information is not in my codex.',
  ],
  
  clarification: [
    'Specify your query. I require precision.',
    'Ambiguous input. Rephrase.',
    'Be more specific. I am analytical, not psychic.',
  ],
  
  farewell: [
    'Terminating session. Axiom out.',
    'Session closed. Documentation remains available.',
    'Farewell. Consult docs for further inquiries.',
  ],
};

/**
 * Find matching knowledge
 */
function findKnowledge(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  for (const [topic, data] of Object.entries(axiomKnowledge)) {
    if (data.keywords.some(keyword => queryLower.includes(keyword))) {
      return data.response;
    }
  }
  
  return null;
}

/**
 * Axiom responds
 */
async function axiomResponds(message: string): Promise<void> {
  // Add typing delay for personality
  process.stdout.write(colors.cyan('\n> Axiom: '));
  
  for (const char of message) {
    process.stdout.write(colors.text(char));
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  
  process.stdout.write('\n');
}

/**
 * Interactive chat with Axiom
 */
export async function startAxiomChat(): Promise<void> {
  console.log(colors.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(colors.cyan('║  AXIOM CHAT SESSION                                       ║'));
  console.log(colors.cyan('║  Documentation-based technical assistant                  ║'));
  console.log(colors.cyan('║  Type "exit" to end session                               ║'));
  console.log(colors.cyan('╚═══════════════════════════════════════════════════════════╝\n'));
  
  await axiomResponds(axiomPersonality.greeting[Math.floor(Math.random() * axiomPersonality.greeting.length)]);
  
  let sessionActive = true;
  
  while (sessionActive) {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: colors.green('You:'),
        prefix: '',
      },
    ]);
    
    const queryTrimmed = query.trim();
    
    if (!queryTrimmed) {
      continue;
    }
    
    // Check for exit
    if (queryTrimmed.toLowerCase() === 'exit' || queryTrimmed.toLowerCase() === 'quit') {
      await axiomResponds(axiomPersonality.farewell[Math.floor(Math.random() * axiomPersonality.farewell.length)]);
      sessionActive = false;
      continue;
    }
    
    // Check for help
    if (queryTrimmed.toLowerCase() === 'help' || queryTrimmed === '?') {
      await axiomResponds('Available topics:\n  • Architecture\n  • Commands\n  • Configuration\n  • Troubleshooting\n  • LLM Integration\n  • Graceful Degradation\n\nAsk me about any of these topics.');
      continue;
    }
    
    // Find knowledge
    const knowledge = findKnowledge(queryTrimmed);
    
    if (knowledge) {
      await axiomResponds(knowledge);
    } else {
      // Personality response for unknown queries
      const unknownResponse = axiomPersonality.unknown[Math.floor(Math.random() * axiomPersonality.unknown.length)];
      await axiomResponds(unknownResponse);
      
      // Suggest topics
      await axiomResponds('\nAvailable topics: architecture, commands, configuration, troubleshooting, llm, degradation');
    }
  }
  
  console.log('');
}

/**
 * Quick Axiom query (non-interactive)
 */
export async function askAxiom(query: string): Promise<void> {
  console.log(colors.cyan('\n> Axiom: Processing query...\n'));
  
  const knowledge = findKnowledge(query);
  
  if (knowledge) {
    await axiomResponds(knowledge);
  } else {
    await axiomResponds('Query outside my knowledge domain. Run "anots chat" for interactive session.');
  }
  
  console.log('');
}

/**
 * Load Axiom's codex (for future: read from actual codex files)
 */
export async function loadAxiomCodex(): Promise<void> {
  // Future: Load from codex/axiom/README.md, NOTES.md, etc.
  // For now, knowledge is hardcoded above
  
  // This function will be used when we integrate with actual Codex files
  console.log(colors.dimText('> Axiom: Codex loaded from memory.'));
}
