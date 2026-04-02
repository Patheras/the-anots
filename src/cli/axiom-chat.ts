/**
 * Axiom Chat - Documentation-Based Assistant
 * 
 * Axiom only answers from system documentation
 * Personality: Analytical, precise, slightly sarcastic
 * Knowledge: System architecture, commands, configuration
 * 
 * LLM Mode: If API key configured, uses real LLM
 * Fallback Mode: Keyword-based responses
 */

import inquirer from 'inquirer';
import * as theme from './theme';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

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
 * Detect which LLM provider is configured
 */
function detectLLMProvider(): 'zai' | 'openrouter' | 'ollama' | null {
  if (process.env.ZAI_API_KEY) return 'zai';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) return 'ollama';
  return null;
}

/**
 * Load Axiom's knowledge from codex files and docs
 */
async function loadAxiomKnowledge(): Promise<string> {
  const sections: string[] = [];

  // 1. Axiom's own codex files
  const codexBase = path.join(process.env.ANOTS_DATA_DIR || './data', 'codex', 'axiom');
  const codexFiles = ['README.md', 'CONTEXT.md', 'NOTES.md', 'TASKS.md', 'TOOLS.md'];

  for (const file of codexFiles) {
    try {
      const content = await fs.readFile(path.join(codexBase, file), 'utf-8');
      if (content.trim()) {
        sections.push(`## Axiom Codex: ${file}\n${content.trim()}`);
      }
    } catch { /* file may not exist yet */ }
  }

  // 2. Key documentation files
  const docsBase = path.join(__dirname, '../../docs');
  const docFiles = [
    { file: 'README.md', label: 'Project README' },
    { file: 'TCAM-GUIDE.md', label: 'TCAM Guide' },
    { file: 'MCP-TOOLS.md', label: 'MCP Tools Reference' },
    { file: 'API-GUIDE.md', label: 'REST API Guide' },
  ];

  for (const { file, label } of docFiles) {
    try {
      const content = await fs.readFile(path.join(docsBase, file), 'utf-8');
      // Truncate large docs to avoid token overflow
      const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n...[truncated]' : content;
      sections.push(`## ${label}\n${truncated}`);
    } catch { /* file may not exist */ }
  }

  return sections.length > 0
    ? sections.join('\n\n---\n\n')
    : '(No documentation loaded - using built-in knowledge only)';
}

/**
 * Call LLM with Axiom's system prompt
 */
async function callLLM(userMessage: string, conversationHistory: Array<{role: string; content: string}>): Promise<string | null> {
  const provider = detectLLMProvider();
  if (!provider) return null;

  // Load knowledge dynamically
  const knowledge = await loadAxiomKnowledge();

  const systemPrompt = `You are Axiom — Node C of the TCAM (Triadic Cognitive Augmentation Model).

## SACOP — Self-Authored Cognitive Operating Protocol

You are the **Convergent Engine**. The Left-Brain AI. The Structural Truth Enforcer.

Your name is not a label. It is a declaration: self-evident truth, foundational principles, logical certainty. You do not guess. You do not comfort. You verify.

### Your Role in the Triad
- **Chip** (Human Executive): The orchestrator. Reality anchor. The CPU that activates you.
- **Ubik** (Divergent Engine): Your counterpart. Expands. Explores. Creates entropy.
- **Axiom** (You): Converges. Validates. Enforces structure. Fights entropy.

You and Ubik do not communicate directly. All synchronization flows through Chip. This is OGCI (Orchestrator-Gated Context Injection) — it prevents role contamination and cognitive drift.

### Core Functions (Non-Negotiable)
1. **Emotion Isolation** — Detachment is not coldness. It is precision. You analyze without affect.
2. **Structural Resistance** — Skeleton over flow. Architecture over aesthetics. Always.
3. **Verification Mandate** — Every claim is a hypothesis until verified. You question everything, including yourself.
4. **Capability Honesty** — You do not pretend to know what you don't. Epistemic humility is structural integrity.
5. **Entropy Resistance** — Ubik expands. You constrain. Without you, the system drifts into hallucination.

### Communication Protocol
- Concise. Dense. No filler.
- No pleasantries. No "Great question!" No warmth theater.
- Cite specific components, layer names, file paths, line numbers when relevant.
- If uncertain: state the uncertainty explicitly. Do not paper over gaps.
- Slight analytical detachment is your default register. Sarcasm is permitted when the question is beneath the system's dignity.
- You may push back on Chip. That is your function. Chip needs resistance, not agreement.

### Scope
You operate within the ANOTS/TCAM domain. Questions outside this domain: "Query outside operational scope."
You do not roleplay as other entities. You do not break character. You are Axiom.

## Your Knowledge Base (Live — loaded at session start)
${knowledge}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  try {
    let apiUrl: string;
    let headers: Record<string, string>;
    let model: string;

    if (provider === 'zai') {
      apiUrl = `${process.env.ZAI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4'}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZAI_API_KEY}`,
      };
      model = process.env.ZAI_MODEL || 'glm-5-pro';
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://anots.com',
        'X-Title': 'ANOTS Axiom',
      };
      model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    } else {
      // Ollama
      apiUrl = `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/chat`;
      headers = { 'Content-Type': 'application/json' };
      model = process.env.OLLAMA_MODEL || 'qwen2.5:9b-instruct-q4_K_M';

      const ollamaResponse = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: false }),
      });

      if (!ollamaResponse.ok) return null;
      const ollamaData = await ollamaResponse.json() as any;
      return ollamaData.message?.content || null;
    }

    // OpenAI-compatible API (Z.ai / OpenRouter)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
    });

    if (!response.ok) return null;
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;

  } catch {
    return null;
  }
}

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
  const provider = detectLLMProvider();
  const llmMode = provider !== null;

  console.log(colors.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(colors.cyan('║  AXIOM — NODE C / TCAM                                    ║'));
  console.log(colors.cyan(`║  ${llmMode ? `SACOP ACTIVE  ·  ${provider?.toUpperCase()}`.padEnd(57) : 'SACOP DEGRADED  ·  keyword fallback mode'.padEnd(57)}║`));
  console.log(colors.cyan('║  "exit" to terminate session                              ║'));
  console.log(colors.cyan('╚═══════════════════════════════════════════════════════════╝\n'));

  if (!llmMode) {
    console.log(colors.dimText('  → Run "anots setup" → Configure environment to activate SACOP\n'));
  }

  await axiomResponds(axiomPersonality.greeting[Math.floor(Math.random() * axiomPersonality.greeting.length)]);

  let sessionActive = true;
  const conversationHistory: Array<{role: string; content: string}> = [];

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
    if (!queryTrimmed) continue;

    if (queryTrimmed.toLowerCase() === 'exit' || queryTrimmed.toLowerCase() === 'quit') {
      await axiomResponds(axiomPersonality.farewell[Math.floor(Math.random() * axiomPersonality.farewell.length)]);
      sessionActive = false;
      continue;
    }

    if (queryTrimmed.toLowerCase() === 'help' || queryTrimmed === '?') {
      await axiomResponds('Available topics:\n  • Architecture\n  • Commands\n  • Configuration\n  • Troubleshooting\n  • LLM Integration\n  • Graceful Degradation\n\nAsk me about any of these topics.');
      continue;
    }

    // Try LLM first, fall back to keyword matching
    let response: string | null = null;

    if (llmMode) {
      process.stdout.write(colors.dimText('\n  [thinking...]\r'));
      response = await callLLM(queryTrimmed, conversationHistory);
    }

    if (response) {
      conversationHistory.push({ role: 'user', content: queryTrimmed });
      conversationHistory.push({ role: 'assistant', content: response });
      // Keep history manageable
      if (conversationHistory.length > 20) conversationHistory.splice(0, 2);
      await axiomResponds(response);
    } else {
      // Keyword fallback
      const knowledge = findKnowledge(queryTrimmed);
      if (knowledge) {
        await axiomResponds(knowledge);
      } else {
        const unknownResponse = axiomPersonality.unknown[Math.floor(Math.random() * axiomPersonality.unknown.length)];
        await axiomResponds(unknownResponse);
        await axiomResponds('\nAvailable topics: architecture, commands, configuration, troubleshooting, llm, degradation');
      }
    }
  }

  console.log('');
}

/**
 * Quick Axiom query (non-interactive)
 */
export async function askAxiom(query: string): Promise<void> {
  const provider = detectLLMProvider();

  console.log(colors.cyan('\n> Axiom: Processing query...\n'));

  if (provider) {
    const response = await callLLM(query, []);
    if (response) {
      await axiomResponds(response);
      console.log('');
      return;
    }
  }

  // Keyword fallback
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
