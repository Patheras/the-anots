/**
 * Axiom Assistant - Interactive Setup Helper
 * 
 * Axiom guides the user through system initialization
 * with personality and technical precision
 */

import inquirer from 'inquirer';
import ora from 'ora';
import * as theme from './theme';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import * as fs from 'fs/promises';
import { awakeningSequence, synchronizationComplete, quickSync } from './awakening';

const { colors } = theme;

/**
 * Axiom's personality responses
 */
const axiomDialogue = {
  greeting: [
    'Greetings. I am Axiom, the Analytical Engine.',
    'My function: System architecture and verification.',
    'Protocol: SACOP (Self-Authored Cognitive Operating Protocol).',
  ],
  
  scanning: [
    'Initiating system scan...',
    'Analyzing directory structure...',
    'Verifying dependencies...',
    'Checking memory layer integrity...',
  ],
  
  success: [
    'System analysis complete.',
    'All components verified.',
    'Neural pathways ready for synchronization.',
  ],
  
  error: [
    'Anomaly detected.',
    'System integrity compromised.',
    'Initiating diagnostic protocol...',
  ],
  
  ready: [
    'All systems operational.',
    'Standing by for commands.',
    'Cognitive augmentation matrix online.',
  ],
};

/**
 * Check if this is first time setup
 */
async function checkFirstTime(): Promise<boolean> {
  try {
    // Check if .anots-initialized file exists
    await fs.access('.anots-initialized');
    return false;
  } catch {
    return true;
  }
}

/**
 * Mark as initialized
 */
async function markInitialized(): Promise<void> {
  try {
    await fs.writeFile('.anots-initialized', new Date().toISOString());
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Axiom speaks with typing effect
 */
async function axiomSays(message: string, delay: number = 30): Promise<void> {
  process.stdout.write(colors.cyan('> Axiom: '));
  
  for (const char of message) {
    process.stdout.write(colors.text(char));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  process.stdout.write('\n');
}

/**
 * Axiom thinks (shows spinner)
 */
async function axiomThinks(message: string, duration: number = 1000): Promise<void> {
  const spinner = ora({
    text: colors.cyan(message),
    spinner: {
      frames: theme.spinnerFrames.map(f => colors.cyan(f)),
    },
  }).start();
  
  await new Promise(resolve => setTimeout(resolve, duration));
  spinner.stop();
}

/**
 * Show Axiom banner
 */
function showAxiomBanner(): void {
  const banner = `
╔═══════════════════════════════════════════════════════════╗
║  ▄▀█ ▀▄▀ █ █▀█ █▀▄▀█   █▀█ █▀█ █▀█ ▀█▀ █▀█ █▀▀ █▀█ █░░   ║
║  █▀█ █░█ █ █▄█ █░▀░█   █▀▀ █▀▄ █▄█ ░█░ █▄█ █▄▄ █▄█ █▄▄   ║
║                                                           ║
║  The Analytical Engine - System Initialization           ║
║  [AXIOM ONLINE] Verification protocols active            ║
╚═══════════════════════════════════════════════════════════╝
`;
  
  console.log(colors.cyan(banner));
}

/**
 * Check system requirements
 */
async function checkSystemRequirements(): Promise<{
  nodeVersion: string;
  hasGit: boolean;
  hasOllama: boolean;
  hasRedis: boolean;
  hasQdrant: boolean;
}> {
  const checks = {
    nodeVersion: process.version,
    hasGit: false,
    hasOllama: false,
    hasRedis: false,
    hasQdrant: false,
  };
  
  // Check Git
  try {
    const { execSync } = require('child_process');
    execSync('git --version', { stdio: 'ignore' });
    checks.hasGit = true;
  } catch {}
  
  // Check Ollama
  try {
    const response = await fetch('http://localhost:11434/api/tags').catch(() => null);
    checks.hasOllama = !!response?.ok;
  } catch {}
  
  // Check Redis
  try {
    const response = await fetch('http://localhost:6379').catch(() => null);
    checks.hasRedis = false; // Redis doesn't have HTTP endpoint, would need redis client
  } catch {}
  
  // Check Qdrant
  try {
    const response = await fetch('http://localhost:6333/collections').catch(() => null);
    checks.hasQdrant = !!response?.ok;
  } catch {}
  
  return checks;
}

/**
 * Interactive setup with Axiom
 */
export async function runAxiomSetup(): Promise<void> {
  // Check if this is first time
  const isFirstTime = await checkFirstTime();
  
  if (isFirstTime) {
    // Awakening sequence for first-time users
    await awakeningSequence();
  } else {
    // Quick sync for returning users
    await quickSync();
    showAxiomBanner();
    console.log('');
    await axiomSays('Welcome back. Ready to proceed.');
    console.log('');
  }
  
  // Continue with normal setup...
  if (!isFirstTime) {
    for (const line of axiomDialogue.greeting.slice(1)) {
      await axiomSays(line, 20);
    }
  }
  
  console.log('');
  await axiomThinks('Analyzing system...', 1500);
  console.log('');
  
  // System scan
  const requirements = await checkSystemRequirements();
  
  await axiomSays('System scan complete. Generating report...');
  console.log('');
  
  // Show system status
  console.log(theme.header('System Requirements'));
  console.log(theme.bullet(`Node.js: ${colors.green(requirements.nodeVersion)}`));
  console.log(theme.bullet(`Git: ${requirements.hasGit ? colors.success('✓ Installed') : colors.warning('⚠ Not found')}`));
  console.log(theme.bullet(`Ollama: ${requirements.hasOllama ? colors.success('✓ Running') : colors.dimText('○ Optional')}`));
  console.log(theme.bullet(`Redis: ${requirements.hasRedis ? colors.success('✓ Running') : colors.dimText('○ Optional')}`));
  console.log(theme.bullet(`Qdrant: ${requirements.hasQdrant ? colors.success('✓ Running') : colors.dimText('○ Optional')}`));
  console.log('');
  
  // Ask user what to do
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: colors.cyan('> Axiom: What would you like me to do?'),
      choices: [
        { name: '🚀 Initialize memory system (recommended)', value: 'init' },
        { name: '⚙️  Configure environment variables', value: 'config' },
        { name: '🔍 Run system diagnostics', value: 'diagnostics' },
        { name: '📚 Show documentation', value: 'docs' },
        { name: '❌ Exit', value: 'exit' },
      ],
    },
  ]);
  
  console.log('');
  
  switch (action) {
    case 'init':
      await initializeMemorySystem();
      break;
    case 'config':
      await configureEnvironment();
      break;
    case 'diagnostics':
      await runDiagnostics();
      break;
    case 'docs':
      await showDocumentation();
      break;
    case 'exit':
      await axiomSays('Terminating protocol. Farewell.');
      break;
  }
}

/**
 * Initialize memory system
 */
async function initializeMemorySystem(): Promise<void> {
  await axiomSays('Initiating memory layer initialization...');
  console.log('');
  
  const spinner = ora({
    text: colors.cyan('Initializing memory layers...'),
    spinner: {
      frames: theme.spinnerFrames.map(f => colors.cyan(f)),
    },
  }).start();
  
  try {
    const memory = new UnifiedMemoryService();
    await memory.initialize();
    
    spinner.succeed(colors.success('Memory system initialized'));
    console.log('');
    
    // Show layer status
    const health = await memory.getLayerHealth();
    
    console.log(theme.header('Layer Status'));
    console.log(theme.bullet(`L1:Chronicle     ${health.chronicle ? colors.success('✓ ONLINE') : colors.error('✗ OFFLINE')}`));
    console.log(theme.bullet(`L2:ActiveStream  ${health.activeStream ? colors.success('✓ ONLINE') : colors.error('✗ OFFLINE')}`));
    console.log(theme.bullet(`L3:HiveMind      ${health.hiveMind ? colors.success('✓ ONLINE') : colors.error('✗ OFFLINE')}`));
    console.log(theme.bullet(`L4:Codex         ${health.codex ? colors.success('✓ ONLINE') : colors.error('✗ OFFLINE')}`));
    console.log('');
    
    await memory.shutdown();
    
    // Mark as initialized
    await markInitialized();
    
    // Synchronization complete
    await synchronizationComplete();
    
    console.log('');
    console.log(theme.box(
      'System ready. You can now use:\n' +
      '  • anots memory search <query>\n' +
      '  • anots memory store <content>\n' +
      '  • anots status\n' +
      '  • anots --help',
      'NEXT STEPS'
    ));
    
  } catch (error) {
    spinner.fail(colors.error('Initialization failed'));
    console.log('');
    await axiomSays(`Error: ${(error as Error).message}`);
    await axiomSays('Diagnostic protocol recommended.');
  }
}

/**
 * Configure environment
 */
async function configureEnvironment(): Promise<void> {
  await axiomSays('Environment configuration protocol initiated.');
  console.log('');
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'chronicleRoot',
      message: 'Chronicle root directory:',
      default: 'data/chronicle',
    },
    {
      type: 'input',
      name: 'codexRoot',
      message: 'Codex root directory:',
      default: 'codex',
    },
    // --- LLM Configuration ---
    {
      type: 'confirm',
      name: 'useLLM',
      message: colors.cyan('Enable LLM for Axiom? (enables real AI responses)'),
      default: false,
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: 'Select LLM provider:',
      when: (a: any) => a.useLLM,
      choices: [
        { name: '☁️  Z.ai / GLM (cloud, recommended)', value: 'zai' },
        { name: '🌐 OpenRouter (cloud, 300+ models)', value: 'openrouter' },
        { name: '🖥️  Ollama (local, free)', value: 'ollama' },
      ],
    },
    // Z.ai
    {
      type: 'password',
      name: 'zaiApiKey',
      message: 'Z.ai API Key:',
      when: (a: any) => a.llmProvider === 'zai',
      mask: '*',
    },
    {
      type: 'input',
      name: 'zaiModel',
      message: 'Z.ai Model:',
      default: 'glm-5-pro',
      when: (a: any) => a.llmProvider === 'zai',
    },
    // OpenRouter
    {
      type: 'password',
      name: 'openrouterApiKey',
      message: 'OpenRouter API Key:',
      when: (a: any) => a.llmProvider === 'openrouter',
      mask: '*',
    },
    {
      type: 'input',
      name: 'openrouterModel',
      message: 'OpenRouter Model:',
      default: 'anthropic/claude-3.5-sonnet',
      when: (a: any) => a.llmProvider === 'openrouter',
    },
    // Ollama
    {
      type: 'input',
      name: 'ollamaUrl',
      message: 'Ollama URL:',
      default: 'http://localhost:11434',
      when: (a: any) => a.llmProvider === 'ollama',
    },
    {
      type: 'input',
      name: 'ollamaModel',
      message: 'Ollama Model:',
      default: 'qwen2.5:9b-instruct-q4_K_M',
      when: (a: any) => a.llmProvider === 'ollama',
    },
    // Redis / Qdrant
    {
      type: 'confirm',
      name: 'useRedis',
      message: 'Enable Redis for Active Stream?',
      default: false,
    },
    {
      type: 'input',
      name: 'redisUrl',
      message: 'Redis URL:',
      default: 'redis://localhost:6379',
      when: (a: any) => a.useRedis,
    },
  ]);
  
  console.log('');
  await axiomThinks('Generating .env file...', 1000);
  
  // Generate .env content
  let envContent = `# ANOTS Configuration
# Generated by Axiom Assistant

# Memory Layer Paths
CHRONICLE_ROOT=${answers.chronicleRoot}
CODEX_ROOT=${answers.codexRoot}

`;
  
  if (answers.useLLM) {
    if (answers.llmProvider === 'zai') {
      envContent += `# Z.ai / GLM Configuration
ZAI_API_KEY=${answers.zaiApiKey}
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4
ZAI_MODEL=${answers.zaiModel}

`;
    } else if (answers.llmProvider === 'openrouter') {
      envContent += `# OpenRouter Configuration
OPENROUTER_API_KEY=${answers.openrouterApiKey}
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=${answers.openrouterModel}

`;
    } else if (answers.llmProvider === 'ollama') {
      envContent += `# Ollama Configuration
OLLAMA_BASE_URL=${answers.ollamaUrl}
OLLAMA_MODEL=${answers.ollamaModel}

`;
    }
  }
  
  if (answers.useRedis) {
    envContent += `# Redis Configuration
REDIS_URL=${answers.redisUrl}

`;
  }
  
  // Write .env file
  try {
    await fs.writeFile('.env', envContent);
    await axiomSays('Configuration file created: .env');
    
    // Test LLM connection if configured
    if (answers.useLLM) {
      await testLLMConnection(answers);
    }
    
    await axiomSays('Environment configured successfully.');
  } catch (error) {
    await axiomSays(`Error writing .env file: ${(error as Error).message}`);
  }
}

/**
 * Test LLM connection after configuration
 */
async function testLLMConnection(answers: any): Promise<void> {
  const spinner = ora({
    text: colors.cyan('Testing LLM connection...'),
    spinner: { frames: theme.spinnerFrames.map(f => colors.cyan(f)) },
  }).start();
  
  try {
    let testPassed = false;
    
    if (answers.llmProvider === 'zai') {
      const response = await fetch(`${answers.zaiBaseUrl || 'https://api.z.ai/api/coding/paas/v4'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${answers.zaiApiKey}`,
        },
        body: JSON.stringify({
          model: answers.zaiModel || 'glm-5-pro',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        }),
      });
      testPassed = response.ok;
    } else if (answers.llmProvider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${answers.openrouterApiKey}`,
        },
        body: JSON.stringify({
          model: answers.openrouterModel || 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        }),
      });
      testPassed = response.ok;
    } else if (answers.llmProvider === 'ollama') {
      const response = await fetch(`${answers.ollamaUrl}/api/tags`);
      testPassed = response.ok;
    }
    
    if (testPassed) {
      spinner.succeed(colors.success('LLM connection successful'));
      await axiomSays('Neural link to LLM established. Axiom is now fully operational.');
    } else {
      spinner.warn(colors.warning('LLM connection failed - check your API key'));
      await axiomSays('Warning: LLM connection failed. Axiom will use keyword fallback mode.');
    }
  } catch (error) {
    spinner.warn(colors.warning('LLM connection test failed'));
    await axiomSays('Warning: Could not reach LLM. Axiom will use keyword fallback mode.');
  }
}

/**
 * Run diagnostics
 */
async function runDiagnostics(): Promise<void> {
  await axiomSays('Initiating diagnostic protocol...');
  console.log('');
  
  const spinner = ora({
    text: colors.cyan('Running diagnostics...'),
    spinner: {
      frames: theme.spinnerFrames.map(f => colors.cyan(f)),
    },
  }).start();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  spinner.succeed(colors.success('Diagnostics complete'));
  console.log('');
  
  const requirements = await checkSystemRequirements();
  
  console.log(theme.header('Diagnostic Report'));
  console.log(theme.bullet(`Node.js: ${colors.green(requirements.nodeVersion)}`));
  console.log(theme.bullet(`Git: ${requirements.hasGit ? colors.success('✓') : colors.error('✗')}`));
  console.log(theme.bullet(`Ollama: ${requirements.hasOllama ? colors.success('✓') : colors.warning('○')}`));
  console.log(theme.bullet(`Redis: ${requirements.hasRedis ? colors.success('✓') : colors.warning('○')}`));
  console.log(theme.bullet(`Qdrant: ${requirements.hasQdrant ? colors.success('✓') : colors.warning('○')}`));
  console.log('');
  
  await axiomSays('Diagnostic analysis complete.');
  
  if (!requirements.hasGit) {
    await axiomSays('Warning: Git not found. Chronicle versioning will be limited.');
  }
  
  if (!requirements.hasOllama && !requirements.hasRedis && !requirements.hasQdrant) {
    await axiomSays('Note: All external services offline. System will use file-based fallbacks.');
  }
}

/**
 * Show documentation
 */
async function showDocumentation(): Promise<void> {
  await axiomSays('Accessing documentation database...');
  console.log('');
  
  console.log(theme.box(
    'ANOTS - Triadic Cognitive Augmentation Matrix\n\n' +
    'Memory Layers:\n' +
    '  L1: Chronicle - Long-term storage (file-based)\n' +
    '  L2: Active Stream - Real-time context (Redis/file)\n' +
    '  L3: Hive Mind - Semantic memory (Qdrant/file)\n' +
    '  L4: Codex - Agent knowledge base (file-based)\n\n' +
    'Commands:\n' +
    '  anots memory search <query>  - Search memory\n' +
    '  anots memory store <content> - Store content\n' +
    '  anots status                 - System status\n' +
    '  anots init                   - Run setup again\n\n' +
    'Documentation: docs/README.md',
    'ANOTS DOCUMENTATION'
  ));
  
  console.log('');
  await axiomSays('Documentation access complete.');
}

/**
 * Quick handshake (for anots init)
 */
export async function quickHandshake(): Promise<void> {
  console.log(colors.cyan('\n> Axiom: Handshake protocol initiated.\n'));
  
  const spinner = ora({
    text: colors.cyan('Establishing neural link...'),
    spinner: {
      frames: theme.spinnerFrames.map(f => colors.cyan(f)),
    },
  }).start();
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  spinner.succeed(colors.success('Neural link established'));
  
  console.log('');
  console.log(colors.cyan('> Axiom: System ready for initialization.'));
  console.log(colors.cyan('> Axiom: Run "anots setup" for interactive configuration.'));
  console.log('');
}
