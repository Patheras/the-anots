/**
 * Axiom Chat Utilities
 * Shared functions for LLM integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

// Load .env from multiple possible locations
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
];

for (const envPath of possibleEnvPaths) {
  try {
    const envContent = require('fs').readFileSync(envPath, 'utf-8');
    dotenv.parse(envContent);
    dotenv.config({ path: envPath });
    break;
  } catch {
    // Try next path
  }
}

/**
 * Detect which LLM provider is configured
 */
export function detectLLMProvider(): 'zai' | 'openrouter' | 'ollama' | null {
  if (process.env.ZAI_API_KEY) return 'zai';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) return 'ollama';
  return null;
}

/**
 * Load Axiom's knowledge from codex files and docs
 */
export async function loadAxiomKnowledge(): Promise<string> {
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
export async function callLLM(
  userMessage: string,
  conversationHistory: Array<{role: string; content: string}>
): Promise<string | null> {
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
