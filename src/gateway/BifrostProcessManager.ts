/**
 * Bifrost Process Manager
 *
 * Manages the lifecycle of the Bifrost Go binary process.
 * Writes config, spawns process, monitors health, auto-restarts on crash.
 *
 * Requirements: 8.1–8.6
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GatewayConfig } from './types';

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2_000;
const HEALTH_POLL_INTERVAL_MS = 200;
const HEALTH_TIMEOUT_MS = 5_000;

export class BifrostProcessManager {
  private process: cp.ChildProcess | null = null;
  private restartCount = 0;
  private permanentlyFailed = false;
  private configFilePath: string | null = null;
  private readonly config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /** Start the Bifrost process */
  async start(): Promise<void> {
    if (this.permanentlyFailed) {
      throw new Error('Bifrost process permanently failed after max restarts');
    }

    this.configFilePath = this.writeConfig();
    await this.spawnAndWait();
  }

  /** Stop the Bifrost process */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.removeAllListeners('exit');
      this.process.kill('SIGTERM');
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 3_000);
        this.process!.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      this.process = null;
    }

    if (this.configFilePath && fs.existsSync(this.configFilePath)) {
      try { fs.unlinkSync(this.configFilePath); } catch { /* ignore */ }
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  isPermanentlyFailed(): boolean {
    return this.permanentlyFailed;
  }

  private writeConfig(): string {
    const configDir = os.tmpdir();
    const configPath = path.join(configDir, `bifrost-config-${Date.now()}.json`);

    const bifrostConfig = {
      port: this.config.bifrostPort,
      providers: [
        {
          name: 'cloud',
          type: 'openai-compatible',
          baseUrl: this.config.zaiBaseUrl,
          model: this.config.zaiModel,
          apiKey: this.config.zaiApiKey,
        },
        {
          name: 'local',
          type: 'ollama',
          baseUrl: this.config.ollamaBaseUrl,
          model: this.config.ollamaModel,
        },
      ],
    };

    fs.writeFileSync(configPath, JSON.stringify(bifrostConfig, null, 2));
    return configPath;
  }

  private async spawnAndWait(): Promise<void> {
    const binPath = this.config.bifrostBinPath;

    if (!fs.existsSync(binPath)) {
      throw new Error(
        `Bifrost binary not found at: ${binPath}. ` +
        `Set BIFROST_BIN_PATH env var or download from https://github.com/maximhq/bifrost`
      );
    }

    this.process = cp.spawn(binPath, ['--config', this.configFilePath!], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (d: Buffer) => {
      console.log(`[Bifrost] ${d.toString().trim()}`);
    });
    this.process.stderr?.on('data', (d: Buffer) => {
      console.warn(`[Bifrost] ${d.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      console.warn(`[Bifrost] Process exited with code ${code}`);
      this.process = null;
      this.handleUnexpectedExit();
    });

    // Wait for health endpoint
    await this.waitForHealth();
  }

  private async waitForHealth(): Promise<void> {
    const healthUrl = `http://localhost:${this.config.bifrostPort}/health`;
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
        if (res.ok) return;
      } catch { /* not ready yet */ }
      await sleep(HEALTH_POLL_INTERVAL_MS);
    }

    throw new Error(
      `Bifrost did not become healthy within ${HEALTH_TIMEOUT_MS}ms at ${healthUrl}`
    );
  }

  private handleUnexpectedExit(): void {
    if (this.restartCount >= MAX_RESTARTS) {
      this.permanentlyFailed = true;
      console.error(`[Bifrost] Permanently failed after ${MAX_RESTARTS} restart attempts`);
      return;
    }

    this.restartCount++;
    console.warn(`[Bifrost] Restarting (attempt ${this.restartCount}/${MAX_RESTARTS})...`);

    setTimeout(async () => {
      try {
        this.configFilePath = this.writeConfig();
        await this.spawnAndWait();
        console.log('[Bifrost] Restarted successfully');
      } catch (error) {
        console.error('[Bifrost] Restart failed:', (error as Error).message);
        this.handleUnexpectedExit();
      }
    }, RESTART_DELAY_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
