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
    // Header
    const header = this.grid.set(0, 0, 1, 12, blessed.box, {
      content: '{center}═══ ANOTS - Triadic Cognitive Augmentation Matrix ═══{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true,
      },
    });

    // Layer Status (top left)
    this.layerStatus = this.grid.set(1, 0, 4, 4, contrib.lcd, {
      label: 'Memory Layers',
      segmentWidth: 0.06,
      segmentInterval: 0.11,
      strokeWidth: 0.1,
      elements: 4,
      display: 0,
      elementSpacing: 4,
      elementPadding: 2,
      color: 'green',
    });

    // Memory Gauge (top middle)
    this.memoryGauge = this.grid.set(1, 4, 4, 4, contrib.gauge, {
      label: 'System Health',
      stroke: 'green',
      fill: 'white',
      gaugeSpacing: 0,
      gaugeHeight: 1,
      showLabel: true,
    });

    // Stats Table (top right)
    this.statsTable = this.grid.set(1, 8, 4, 4, contrib.table, {
      keys: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: false,
      label: 'Statistics',
      width: '100%',
      height: '100%',
      columnSpacing: 3,
      columnWidth: [16, 10],
    });

    // Activity Log (bottom)
    this.activityLog = this.grid.set(5, 0, 6, 12, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: 'Activity Log',
      tags: true,
      style: {
        fg: 'cyan',
        border: {
          fg: 'cyan',
        },
      },
    });

    // Help Bar (footer)
    this.helpBar = this.grid.set(11, 0, 1, 12, blessed.box, {
      content: '{center}[F1] Help  [F2] Axiom  [F3] Search  [R] Refresh  [Q] Quit{/center}',
      tags: true,
      style: {
        fg: 'yellow',
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
      this.log('Axiom chat - Coming soon!');
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
{center}{bold}ANOTS Dashboard Help{/bold}{/center}

{bold}Keyboard Shortcuts:{/bold}

  Q, Ctrl+C    - Quit dashboard
  R            - Manual refresh
  F1           - Show this help
  F2           - Open Axiom chat (coming soon)
  F3           - Search memory (coming soon)

{bold}Dashboard Panels:{/bold}

  Memory Layers    - L1-L4 health status
  System Health    - Overall system gauge
  Statistics       - Real-time metrics
  Activity Log     - Recent operations

{bold}Auto-refresh:{/bold} Every ${this.refreshInterval / 1000} seconds

Press any key to close...
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

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}`;
    
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
        ['Chronicle Chapters', stats.chronicle.chapterCount.toString()],
        ['Active Sessions', stats.activeStream.sessionCount.toString()],
        ['Hive Memories', stats.hiveMind.memoryCount.toString()],
        ['Codex Agents', `${stats.codex.ubikInitialized ? 1 : 0} + ${stats.codex.axiomInitialized ? 1 : 0}`],
        ['', ''],
        ['L1: Chronicle', health.chronicle ? '✓ ONLINE' : '✗ OFFLINE'],
        ['L2: ActiveStream', health.activeStream ? '✓ ONLINE' : '✗ OFFLINE'],
        ['L3: HiveMind', health.hiveMind ? '✓ ONLINE' : '✗ OFFLINE'],
        ['L4: Codex', health.codex ? '✓ ONLINE' : '✗ OFFLINE'],
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
    this.log('Dashboard started');
    this.log(`Auto-refresh: every ${this.refreshInterval / 1000}s`);
    this.log('Press F1 for help');

    // Initial refresh
    await this.refresh();

    // Start auto-refresh
    this.intervalId = setInterval(async () => {
      await this.refresh();
    }, this.refreshInterval);

    // Render
    this.screen.render();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.log('Dashboard stopped');
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
