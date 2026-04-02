/**
 * ANOTS Terminal UI Dashboard
 *
 * Real-time monitoring dashboard with blessed-contrib
 * Cyberpunk aesthetic meets 90s anime vibes
 * Pure monitoring - no chat (use 'anots axiom' for chat)
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { UnifiedMemoryService } from '../memory/UnifiedMemoryService';

interface DashboardOptions {
  refreshInterval?: number;
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
  private statsTable: any;
  private activityLog: any;

  // Data
  private logLines: string[] = [];
  private maxLogLines = 100;

  constructor(memory: UnifiedMemoryService, options: DashboardOptions = {}) {
    this.memory = memory;
    this.refreshInterval = options.refreshInterval || 2000;

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'ANOTS Dashboard',
      fullUnicode: true,
    });

    this.grid = new contrib.grid({ rows: 12, cols: 12, screen: this.screen });

    this.setupWidgets();
    this.setupKeyBindings();
  }

  private setupWidgets() {
    // Header
    this.grid.set(0, 0, 1, 12, blessed.box, {
      content: '{center}{bold}{cyan-fg}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓{/cyan-fg}{/bold}{/center}\n{center}{magenta-fg}◆◆◆  ANOTS — Triadic Cognitive Augmentation Matrix  ◆◆◆{/magenta-fg}{/center}',
      tags: true,
    });

    // Layer Status LCD (top left)
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
      style: { border: { fg: 'magenta' } },
    });

    // System Sync Gauge (top middle)
    this.memoryGauge = this.grid.set(1, 4, 4, 4, contrib.gauge, {
      label: '▸ SYSTEM SYNC',
      stroke: 'magenta',
      fill: 'cyan',
      gaugeSpacing: 0,
      gaugeHeight: 1,
      showLabel: true,
      style: { border: { fg: 'cyan' } },
    });

    // Core Metrics Table (top right)
    this.statsTable = this.grid.set(1, 8, 4, 4, contrib.table, {
      keys: false,
      fg: 'cyan',
      selectedFg: 'white',
      selectedBg: 'magenta',
      interactive: false,
      label: '▸ CORE METRICS',
      columnSpacing: 3,
      columnWidth: [16, 10],
      style: { border: { fg: 'green' } },
    });

    // Activity Log (bottom - full width)
    this.activityLog = this.grid.set(5, 0, 6, 12, contrib.log, {
      fg: 'green',
      label: '▸ SYSTEM LOG [STREAMING]',
      tags: true,
      style: { fg: 'green', border: { fg: 'yellow' } },
    });

    // Footer
    this.grid.set(11, 0, 1, 12, blessed.box, {
      content: '{center}{yellow-fg}▼▼▼{/yellow-fg}  {cyan-fg}[R]{/cyan-fg} Refresh  {cyan-fg}[F1]{/cyan-fg} Help  {magenta-fg}[F2]{/magenta-fg} Chat with Axiom  {red-fg}[Q]{/red-fg} Quit  {yellow-fg}▼▼▼{/yellow-fg}{/center}',
      tags: true,
    });
  }

  private setupKeyBindings() {
    this.screen.key(['q', 'Q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });

    this.screen.key(['r', 'R'], async () => {
      await this.refresh();
      this.log('Manual refresh triggered');
    });

    this.screen.key(['f1'], () => {
      this.showHelp();
    });

    this.screen.key(['f2'], async () => {
      this.stop();
      this.screen.destroy();
      const { startAxiomChat } = await import('./axiom-chat');
      await startAxiomChat();
      process.exit(0);
    });
  }

  private showHelp() {
    const helpBox = blessed.box({
      top: 'center', left: 'center',
      width: '60%', height: '55%',
      content: `
{center}{bold}{cyan-fg}╔═══════════════════════════════════════╗{/cyan-fg}{/bold}{/center}
{center}{bold}{cyan-fg}║   ANOTS DASHBOARD — HELP PROTOCOL   ║{/cyan-fg}{/bold}{/center}
{center}{bold}{cyan-fg}╚═══════════════════════════════════════╝{/cyan-fg}{/bold}{/center}

{bold}{magenta-fg}▸ KEYBOARD SHORTCUTS:{/magenta-fg}{/bold}

  {cyan-fg}Q, Ctrl+C{/cyan-fg}    - Terminate dashboard
  {cyan-fg}R{/cyan-fg}            - Force manual refresh
  {cyan-fg}F1{/cyan-fg}           - This help screen

{bold}{magenta-fg}▸ PANELS:{/magenta-fg}{/bold}

  {green-fg}Memory Layers{/green-fg}    - L1-L4 sync status (LCD)
  {green-fg}System Sync{/green-fg}      - Overall health gauge
  {green-fg}Core Metrics{/green-fg}     - Real-time statistics
  {green-fg}System Log{/green-fg}       - Streaming activity log

{bold}{magenta-fg}▸ CHAT WITH AXIOM:{/magenta-fg}{/bold}

  {yellow-fg}anots axiom{/yellow-fg}     - Full SACOP chat session
  {yellow-fg}anots ask "..."  {/yellow-fg} - Quick single query

{center}{dim-fg}Press any key to close...{/dim-fg}{/center}
      `,
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: 'cyan' } },
    });

    this.screen.append(helpBox);
    helpBox.focus();
    helpBox.key(['escape', 'enter', 'space', 'f1'], () => {
      helpBox.destroy();
      this.screen.render();
    });
    this.screen.render();
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `{cyan-fg}[${timestamp}]{/cyan-fg} {green-fg}▸{/green-fg} ${message}`;
    this.logLines.push(line);
    if (this.logLines.length > this.maxLogLines) this.logLines.shift();
    this.activityLog.log(line);
  }

  private async refresh() {
    try {
      const health = await this.memory.getLayerHealth();
      const stats = await this.memory.getStats();

      const layerCount = [
        health.chronicle, health.activeStream, health.hiveMind, health.codex,
      ].filter(Boolean).length;

      this.layerStatus.setDisplay(layerCount);
      this.memoryGauge.setPercent((layerCount / 4) * 100);

      this.statsTable.setData({
        headers: ['Metric', 'Value'],
        data: [
          ['Chronicle', `${stats.chronicle.chapterCount} ◆`],
          ['ActiveStream', `${stats.activeStream.sessionCount} ◆`],
          ['HiveMind', `${stats.hiveMind.memoryCount} ◆`],
          ['Codex', `${stats.codex.ubikInitialized ? '✓' : '✗'} Ubik / ${stats.codex.axiomInitialized ? '✓' : '✗'} Axiom`],
          ['', ''],
          ['L1: Chronicle', health.chronicle ? '▸ SYNC' : '✗ OFFLINE'],
          ['L2: Stream', health.activeStream ? '▸ SYNC' : '✗ OFFLINE'],
          ['L3: HiveMind', health.hiveMind ? '▸ SYNC' : '✗ OFFLINE'],
          ['L4: Codex', health.codex ? '▸ SYNC' : '✗ OFFLINE'],
        ],
      });

      this.screen.render();
    } catch (error) {
      this.log(`{red-fg}Error:{/red-fg} ${(error as Error).message}`);
    }
  }

  async start() {
    const provider = process.env.ZAI_API_KEY ? 'ZAI'
      : process.env.OPENROUTER_API_KEY ? 'OpenRouter'
      : process.env.OLLAMA_BASE_URL ? 'Ollama'
      : null;

    this.log('{magenta-fg}◆◆◆{/magenta-fg} Dashboard initialization sequence started');
    this.log(`{cyan-fg}▸{/cyan-fg} LLM: ${provider ? `{green-fg}${provider} ACTIVE{/green-fg}` : '{yellow-fg}not configured{/yellow-fg}'}`);
    this.log(`{cyan-fg}▸{/cyan-fg} Auto-refresh: every ${this.refreshInterval / 1000}s  ·  F1 for help`);
    this.log(`{dim-fg}▸ For Axiom chat: open a new terminal and run "anots axiom"{/dim-fg}`);

    await this.refresh();

    this.intervalId = setInterval(() => this.refresh(), this.refreshInterval);
    this.screen.render();
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.log('{red-fg}◆◆◆{/red-fg} Dashboard terminated');
  }
}

export async function startDashboard(memory: UnifiedMemoryService) {
  const dashboard = new Dashboard(memory, { refreshInterval: 2000 });
  await dashboard.start();
}
