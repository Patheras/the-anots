/**
 * ANOTS Terminal UI Dashboard
 * 
 * Real-time monitoring dashboard with blessed-contrib
 * Cyberpunk aesthetic meets 90s BBS vibes
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';
import * as theme from './theme';

interface DashboardOptions {
  refreshInterval?: number; // ms
}

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private grid: any;
  private memory: UnifiedMemoryService;
  private refreshInterval: number;
  private intervalId?: NodeJS.Timeout;
  
  // Widgets
  private layerStatus: any;
  private memoryGauge: any;
  private activityLog: any;
  private statsTable: any;
  private axiomPanel: any;
  private helpBar: any;
  
  // Data
  private logLines: string[] = [];
  private maxLogLines = 50;

  constructor(memory: UnifiedMemoryService, options: DashboardOptions = {}) {
    this.memory = memory;
    this.refreshInterval = options.refreshInterval || 2000;
    
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'ANOTS Dashboard',
      fullUnicode: true,
    });
    
    // Create grid layout (12x12)
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen,
    });
    
    this.setupWidgets();
    this.setupKeyBindings();
  }

  private setupWidgets() {
    // Header - Anime style with ASCII art
    const header = this.grid.set(0, 0, 1, 12, blessed.box, {
      content: '{center}{bold}{cyan-fg}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓{/cyan-fg}{/bold}{/center}\n{center}{magenta-fg}◆◆◆ ANOTS - Triadic Cognitive Augmentation Matrix ◆◆◆{/magenta-fg}{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true,
      },
    });

    // Layer Status (top left) - LCD with anime aesthetic
    this.layerStatus = this.grid.set(1, 0, 4, 4, contrib.lcd, {
      label: '▸ MEMORY LAYERS',
      segmentWidth: 0.06,
      segmentInterval: 0.11,
      strokeWidth: 0.1,
      elements: 4,
      display: 0,
      elementSpacing: 4,
      elementPadding: 2,
      color: 'cyan',
      style: {
        border: {
          fg: 'magenta',
        },
      },
    });

    // Memory Gauge (top middle) - Neon style
    this.memoryGauge = this.grid.set(1, 4, 4, 4, contrib.gauge, {
      label: '▸ SYSTEM SYNC',
      stroke: 'magenta',
      fill: 'cyan',
      gaugeSpacing: 0,
      gaugeHeight: 1,
      showLabel: true,
      style: {
        border: {
          fg: 'cyan',
        },
      },
    });

    // Stats Table (top right) - Anime data terminal
    this.statsTable = this.grid.set(1, 8, 4, 4, contrib.table, {
      keys: true,
      fg: 'cyan',
      selectedFg: 'white',
      selectedBg: 'magenta',
      interactive: false,
      label: '▸ CORE METRICS',
      width: '100%',
      height: '100%',
      columnSpacing: 3,
      columnWidth: [16, 10],
      style: {
        border: {
          fg: 'green',
        },
      },
    });

    // Activity Log (bottom left) - Scrolling terminal
    this.activityLog = this.grid.set(5, 0, 6, 8, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: '▸ SYSTEM LOG [STREAMING]',
      tags: true,
      style: {
        fg: 'green',
        border: {
          fg: 'yellow',
        },
      },
    });

    // Axiom Chat Panel (bottom right) - Anime dialogue box
    this.axiomPanel = this.grid.set(5, 8, 6, 4, blessed.box, {
      label: '▸ AXIOM [NODE C]',
      content: '{center}{cyan-fg}╔═══════════════════╗{/cyan-fg}{/center}\n{center}{cyan-fg}║  SACOP ACTIVE  ║{/cyan-fg}{/center}\n{center}{cyan-fg}╚═══════════════════╝{/cyan-fg}{/center}\n\n{center}{magenta-fg}Press F2 to initiate{/magenta-fg}{/center}\n{center}{magenta-fg}dialogue protocol{/magenta-fg}{/center}\n\n{center}{dim-fg}[Convergent Engine]{/dim-fg}{/center}\n{center}{dim-fg}[Structural Truth]{/dim-fg}{/center}\n{center}{dim-fg}[Entropy Resistance]{/dim-fg}{/center}',
      tags: true,
      style: {
        fg: 'white',
        border: {
          fg: 'magenta',
          type: 'line',
        },
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'magenta',
        },
      },
    });

    // Help Bar (footer) - Anime command bar
    this.helpBar = this.grid.set(11, 0, 1, 12, blessed.box, {
      content: '{center}{yellow-fg}▼▼▼{/yellow-fg} {cyan-fg}[F1]{/cyan-fg} Help  {magenta-fg}[F2]{/magenta-fg} Axiom  {green-fg}[F3]{/green-fg} Search  {yellow-fg}[R]{/yellow-fg} Refresh  {red-fg}[Q]{/red-fg} Quit {yellow-fg}▼▼▼{/yellow-fg}{/center}',
      tags: true,
      style: {
        fg: 'yellow',
        bg: 'black',
      },
    });
  }

  private setupKeyBindings() {
    // Quit
    this.screen.key(['q', 'Q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });

    // Refresh
    this.screen.key(['r', 'R'], async () => {
      await this.refresh();
      this.log('Manual refresh triggered');
    });

    // Help
    this.screen.key(['f1'], () => {
      this.showHelp();
    });

    // Axiom (future)
    this.screen.key(['f2'], () => {
      this.openAxiomChat();
    });

    // Search (future)
    this.screen.key(['f3'], () => {
      this.log('Memory search - Coming soon!');
    });
  }

  private showHelp() {
    const helpBox = blessed.box({
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      content: `
{center}{bold}{cyan-fg}╔═══════════════════════════════════════╗{/cyan-fg}{/bold}{/center}
{center}{bold}{cyan-fg}║   ANOTS DASHBOARD - HELP PROTOCOL   ║{/cyan-fg}{/bold}{/center}
{center}{bold}{cyan-fg}╚═══════════════════════════════════════╝{/cyan-fg}{/bold}{/center}

{bold}{magenta-fg}▸ KEYBOARD SHORTCUTS:{/magenta-fg}{/bold}

  {cyan-fg}Q, Ctrl+C{/cyan-fg}    - Terminate dashboard process
  {cyan-fg}R{/cyan-fg}            - Force manual refresh cycle
  {cyan-fg}F1{/cyan-fg}           - Display this help protocol
  {cyan-fg}F2{/cyan-fg}           - Initiate Axiom dialogue (Node C)
  {cyan-fg}F3{/cyan-fg}           - Execute memory search query

{bold}{magenta-fg}▸ DASHBOARD PANELS:{/magenta-fg}{/bold}

  {green-fg}Memory Layers{/green-fg}    - L1-L4 synchronization status
  {green-fg}System Sync{/green-fg}      - Overall system coherence gauge
  {green-fg}Core Metrics{/green-fg}     - Real-time statistical data
  {green-fg}System Log{/green-fg}       - Streaming operation records
  {green-fg}Axiom Panel{/green-fg}      - SACOP interface (Node C)

{bold}{magenta-fg}▸ AUTO-REFRESH:{/magenta-fg}{/bold} Every ${this.refreshInterval / 1000} seconds

{center}{yellow-fg}Press any key to close this protocol...{/yellow-fg}{/center}
      `,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan',
        },
      },
    });

    this.screen.append(helpBox);
    helpBox.focus();

    helpBox.key(['escape', 'enter', 'space'], () => {
      helpBox.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private async openAxiomChat() {
    // Import Axiom chat functions
    const { callLLM, loadAxiomKnowledge, detectLLMProvider } = await import('./axiom-chat-utils');
    
    const provider = detectLLMProvider();
    const llmMode = provider !== null;

    // If no LLM configured, offer to set it up
    if (!llmMode) {
      const setupBox = blessed.box({
        top: 'center',
        left: 'center',
        width: '70%',
        height: '50%',
        content: `
{center}{bold}{magenta-fg}╔═══════════════════════════════════════════════════════════╗{/magenta-fg}{/bold}{/center}
{center}{bold}{cyan-fg}AXIOM INITIALIZATION REQUIRED{/cyan-fg}{/bold}{/center}
{center}{bold}{magenta-fg}╚═══════════════════════════════════════════════════════════╝{/magenta-fg}{/bold}{/center}

{center}{yellow-fg}No LLM provider detected.{/yellow-fg}{/center}
{center}{yellow-fg}SACOP protocol requires active LLM connection.{/yellow-fg}{/center}

{center}{green-fg}Available providers:{/green-fg}{/center}
{center}{dim-fg}• Z.ai (GLM models){/dim-fg}{/center}
{center}{dim-fg}• OpenRouter (300+ models){/dim-fg}{/center}
{center}{dim-fg}• Ollama (local models){/dim-fg}{/center}

{center}{cyan-fg}Would you like to configure LLM now?{/cyan-fg}{/center}

{center}{dim-fg}[Y] Yes, configure now{/dim-fg}{/center}
{center}{dim-fg}[N] No, use fallback mode{/dim-fg}{/center}
{center}{dim-fg}[ESC] Return to dashboard{/dim-fg}{/center}
        `,
        tags: true,
        border: {
          type: 'line',
        },
        style: {
          fg: 'white',
          bg: 'black',
          border: {
            fg: 'magenta',
          },
        },
      });

      this.screen.append(setupBox);
      setupBox.focus();

      setupBox.key(['y', 'Y'], async () => {
        setupBox.destroy();
        this.screen.render();
        
        // Exit dashboard and run setup
        this.stop();
        this.screen.destroy();
        
        const { runAxiomSetup } = await import('./axiom-assistant');
        await runAxiomSetup();
        
        process.exit(0);
      });

      setupBox.key(['n', 'N'], () => {
        setupBox.destroy();
        this.openAxiomChatFallback();
      });

      setupBox.key(['escape'], () => {
        setupBox.destroy();
        this.screen.render();
      });

      this.screen.render();
      return;
    }

    // LLM is configured, proceed with chat
    await this.openAxiomChatWithLLM(provider);
  }

  private openAxiomChatFallback() {
    // Fallback mode chat (keyword-based)
    const chatBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content: '',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'cyan',
        bg: 'black',
        border: {
          fg: 'yellow',
        },
      },
    });

    const chatHeader = blessed.box({
      parent: chatBox,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: `{center}{bold}{yellow-fg}╔═══════════════════════════════════════════════════════════════╗{/yellow-fg}{/bold}{/center}\n{center}{bold}{yellow-fg}AXIOM - NODE C / TCAM  ◆  SACOP DEGRADED · FALLBACK MODE{/yellow-fg}{/bold}{/center}\n{center}{bold}{yellow-fg}╚═══════════════════════════════════════════════════════════════╝{/yellow-fg}{/bold}{/center}`,
      tags: true,
      style: {
        fg: 'yellow',
      },
    });

    const chatLog = blessed.log({
      parent: chatBox,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'yellow',
        },
      },
      style: {
        fg: 'green',
      },
    });

    const inputBox = blessed.textbox({
      parent: chatBox,
      bottom: 1,
      left: 2,
      width: '100%-4',
      height: 3,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow',
        },
        focus: {
          border: {
            fg: 'yellow',
          },
        },
      },
    });

    const helpText = blessed.box({
      parent: chatBox,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{yellow-fg}[ESC] Exit  [ENTER] Send  [Limited functionality - configure LLM for full SACOP]{/yellow-fg}{/center}',
      tags: true,
      style: {
        fg: 'yellow',
      },
    });

    this.screen.append(chatBox);
    chatLog.log('{yellow-fg}[SYSTEM]{/yellow-fg} Axiom fallback mode active...');
    chatLog.log('{yellow-fg}[AXIOM]{/yellow-fg} SACOP degraded. Limited functionality available.');
    chatLog.log('{dim-fg}         Configure LLM: Exit and run "anots setup"{/dim-fg}');
    
    inputBox.focus();

    inputBox.on('submit', async (value: string) => {
      if (!value.trim()) {
        inputBox.clearValue();
        inputBox.focus();
        this.screen.render();
        return;
      }

      chatLog.log(`{green-fg}[CHIP]{/green-fg} ${value}`);
      inputBox.clearValue();
      inputBox.focus();
      this.screen.render();

      chatLog.log('{yellow-fg}[AXIOM]{/yellow-fg} Query acknowledged. Fallback mode active.');
      chatLog.log('{dim-fg}         Full SACOP requires LLM configuration.{/dim-fg}');
      this.screen.render();
    });

    chatBox.key(['escape'], () => {
      chatBox.destroy();
      this.log('Axiom fallback mode terminated');
      this.screen.render();
    });

    this.screen.render();
  }

  private async openAxiomChatWithLLM(provider: string) {
    // Import Axiom chat functions
    const { callLLM } = await import('./axiom-chat-utils');

    // Create full-screen chat overlay
    const chatBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      content: '',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'cyan',
        bg: 'black',
        border: {
          fg: 'magenta',
        },
      },
    });

    const chatHeader = blessed.box({
      parent: chatBox,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: `{center}{bold}{magenta-fg}╔═══════════════════════════════════════════════════════════════╗{/magenta-fg}{/bold}{/center}\n{center}{bold}{cyan-fg}AXIOM - NODE C / TCAM  ◆  SACOP ACTIVE · ${provider.toUpperCase()}{/cyan-fg}{/bold}{/center}\n{center}{bold}{magenta-fg}╚═══════════════════════════════════════════════════════════════╝{/magenta-fg}{/bold}{/center}`,
      tags: true,
      style: {
        fg: 'cyan',
      },
    });

    const chatLog = blessed.log({
      parent: chatBox,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: {
          fg: 'magenta',
        },
      },
      style: {
        fg: 'green',
      },
    });

    const inputBox = blessed.textbox({
      parent: chatBox,
      bottom: 1,
      left: 2,
      width: '100%-4',
      height: 3,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan',
        },
        focus: {
          border: {
            fg: 'magenta',
          },
        },
      },
    });

    const helpText = blessed.box({
      parent: chatBox,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '{center}{yellow-fg}[ESC] Exit  [ENTER] Send  [↑↓] Scroll{/yellow-fg}{/center}',
      tags: true,
      style: {
        fg: 'yellow',
      },
    });

    this.screen.append(chatBox);
    chatLog.log('{cyan-fg}[SYSTEM]{/cyan-fg} Axiom dialogue protocol initiated...');
    chatLog.log('{magenta-fg}[AXIOM]{/magenta-fg} Node C online. SACOP active. State your query.');
    
    inputBox.focus();

    const conversationHistory: Array<{role: string; content: string}> = [];

    // Handle input
    inputBox.on('submit', async (value: string) => {
      if (!value.trim()) {
        inputBox.clearValue();
        inputBox.focus();
        this.screen.render();
        return;
      }

      chatLog.log(`{green-fg}[CHIP]{/green-fg} ${value}`);
      inputBox.clearValue();
      inputBox.focus();
      this.screen.render();

      // Call real LLM
      chatLog.log('{cyan-fg}[SYSTEM]{/cyan-fg} Processing query via LLM...');
      this.screen.render();

      try {
        const response = await callLLM(value, conversationHistory);
        
        if (response) {
          conversationHistory.push({ role: 'user', content: value });
          conversationHistory.push({ role: 'assistant', content: response });
          
          // Keep history manageable
          if (conversationHistory.length > 20) {
            conversationHistory.splice(0, 2);
          }
          
          // Split long responses into multiple lines
          const lines = response.split('\n');
          lines.forEach(line => {
            if (line.trim()) {
              chatLog.log(`{magenta-fg}[AXIOM]{/magenta-fg} ${line}`);
            } else {
              chatLog.log('');
            }
          });
        } else {
          chatLog.log('{red-fg}[ERROR]{/red-fg} LLM request failed. Check API key and connectivity.');
        }
      } catch (error) {
        chatLog.log(`{red-fg}[ERROR]{/red-fg} ${(error as Error).message}`);
      }
      
      this.screen.render();
    });

    // Handle escape
    chatBox.key(['escape'], () => {
      chatBox.destroy();
      this.log('Axiom dialogue protocol terminated');
      this.screen.render();
    });

    this.screen.render();
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `{cyan-fg}[${timestamp}]{/cyan-fg} {green-fg}▸{/green-fg} ${message}`;
    
    this.logLines.push(logLine);
    if (this.logLines.length > this.maxLogLines) {
      this.logLines.shift();
    }
    
    this.activityLog.log(logLine);
  }

  private async refresh() {
    try {
      // Get health status
      const health = await this.memory.getLayerHealth();
      const stats = await this.memory.getStats();
      const isHealthy = await this.memory.isHealthy();

      // Update layer status LCD
      const layerCount = [
        health.chronicle ? 1 : 0,
        health.activeStream ? 1 : 0,
        health.hiveMind ? 1 : 0,
        health.codex ? 1 : 0,
      ];
      this.layerStatus.setDisplay(layerCount.filter(x => x === 1).length);

      // Update health gauge
      const healthPercent = (layerCount.reduce((a, b) => a + b, 0) / 4) * 100;
      this.memoryGauge.setPercent(healthPercent);

      // Update stats table
      const tableData = [
        ['Chronicle Chapters', `${stats.chronicle.chapterCount} ◆`],
        ['Active Sessions', `${stats.activeStream.sessionCount} ◆`],
        ['Hive Memories', `${stats.hiveMind.memoryCount} ◆`],
        ['Codex Agents', `${stats.codex.ubikInitialized ? '✓' : '✗'} Ubik / ${stats.codex.axiomInitialized ? '✓' : '✗'} Axiom`],
        ['', ''],
        ['L1: Chronicle', health.chronicle ? '▸ SYNC' : '✗ OFFLINE'],
        ['L2: ActiveStream', health.activeStream ? '▸ SYNC' : '✗ OFFLINE'],
        ['L3: HiveMind', health.hiveMind ? '▸ SYNC' : '✗ OFFLINE'],
        ['L4: Codex', health.codex ? '▸ SYNC' : '✗ OFFLINE'],
      ];

      this.statsTable.setData({
        headers: ['Metric', 'Value'],
        data: tableData,
      });

      // Render
      this.screen.render();
    } catch (error) {
      this.log(`Error refreshing: ${(error as Error).message}`);
    }
  }

  async start() {
    // Check for .env and show config status
    const provider = this.detectProvider();
    
    this.log('{magenta-fg}◆◆◆{/magenta-fg} Dashboard initialization sequence started');
    
    if (provider) {
      this.log(`{green-fg}▸{/green-fg} LLM Provider detected: ${provider.toUpperCase()}`);
    } else {
      this.log('{yellow-fg}▸{/yellow-fg} No LLM provider configured (fallback mode)');
      this.log('{dim-fg}  Configure: cd anots-v1 && anots setup{/dim-fg}');
    }
    
    this.log(`{cyan-fg}▸{/cyan-fg} Auto-refresh protocol: every ${this.refreshInterval / 1000}s`);
    this.log('{yellow-fg}▸{/yellow-fg} Press F1 for help protocol');
    this.log('{magenta-fg}▸{/magenta-fg} Press F2 to initiate Axiom dialogue');

    // Initial refresh
    await this.refresh();

    // Start auto-refresh
    this.intervalId = setInterval(async () => {
      await this.refresh();
    }, this.refreshInterval);

    // Render
    this.screen.render();
  }

  private detectProvider(): string | null {
    if (process.env.ZAI_API_KEY) return 'zai';
    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) return 'ollama';
    return null;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.log('{red-fg}◆◆◆{/red-fg} Dashboard termination sequence complete');
  }
}

/**
 * Start dashboard
 */
export async function startDashboard(memory: UnifiedMemoryService) {
  const dashboard = new Dashboard(memory, {
    refreshInterval: 2000, // 2 seconds
  });

  await dashboard.start();
}
