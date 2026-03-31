/**
 * Tests for HealthMonitor
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7
 */

import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import { HealthMonitor, globalHealthMonitor } from '../../src/resilience/HealthMonitor';

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `health-test-${Date.now()}`);
    await fsp.mkdir(testDir, { recursive: true });
    monitor = new HealthMonitor({ dataDir: testDir, checkTimeoutMs: 1000 });
  });

  afterEach(async () => {
    monitor.stopPeriodicChecks();
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe('check', () => {
    it('returns a health report', async () => {
      const report = await monitor.check();
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('uptime');
      expect(report).toHaveProperty('components');
      expect(report).toHaveProperty('checkedAt');
    });

    it('filesystem is healthy when dir is writable', async () => {
      const report = await monitor.check();
      const fs = report.components.find(c => c.name === 'filesystem');
      expect(fs?.status).toBe('healthy');
    });

    it('components without registered checks are degraded', async () => {
      const report = await monitor.check();
      const qdrant = report.components.find(c => c.name === 'qdrant');
      expect(qdrant?.status).toBe('degraded');
    });

    it('component is healthy when check returns true', async () => {
      monitor.registerCheck('qdrant', async () => true);
      const report = await monitor.check();
      const qdrant = report.components.find(c => c.name === 'qdrant');
      expect(qdrant?.status).toBe('healthy');
    });

    it('component is down when check returns false', async () => {
      monitor.registerCheck('qdrant', async () => false);
      const report = await monitor.check();
      const qdrant = report.components.find(c => c.name === 'qdrant');
      expect(qdrant?.status).toBe('down');
    });

    it('component is down when check throws', async () => {
      monitor.registerCheck('redis', async () => { throw new Error('Connection refused'); });
      const report = await monitor.check();
      const redis = report.components.find(c => c.name === 'redis');
      expect(redis?.status).toBe('down');
      expect(redis?.error).toContain('Connection refused');
    });

    it('component is down when check times out', async () => {
      const fastMonitor = new HealthMonitor({ dataDir: testDir, checkTimeoutMs: 50 });
      fastMonitor.registerCheck('llm', async () => {
        await new Promise(r => setTimeout(r, 200)); // longer than timeout
        return true;
      });
      const report = await fastMonitor.check();
      const llm = report.components.find(c => c.name === 'llm');
      expect(llm?.status).toBe('down');
      fastMonitor.stopPeriodicChecks();
    });
  });

  describe('overall status calculation', () => {
    it('is healthy when all components are healthy', async () => {
      monitor.registerCheck('qdrant', async () => true);
      monitor.registerCheck('redis', async () => true);
      monitor.registerCheck('mem0', async () => true);
      monitor.registerCheck('llm', async () => true);
      const report = await monitor.check();
      expect(report.status).toBe('healthy');
    });

    it('is degraded when some components are down (but not filesystem)', async () => {
      monitor.registerCheck('qdrant', async () => false);
      const report = await monitor.check();
      expect(report.status).toBe('degraded');
    });

    it('is down when filesystem is down', async () => {
      // Use a path that cannot be written to (null byte in path is invalid on all platforms)
      const badMonitor = new HealthMonitor({ dataDir: testDir, checkTimeoutMs: 1000 });
      // Override the filesystem check to simulate failure
      const originalCheck = (badMonitor as any).checkFileSystem.bind(badMonitor);
      (badMonitor as any).checkFileSystem = async () => {
        (badMonitor as any).setComponent('filesystem', 'down', 0, 'Simulated disk failure');
      };
      const report = await badMonitor.check();
      badMonitor.stopPeriodicChecks();
      expect(report.status).toBe('down');
    });
  });

  describe('uptime', () => {
    it('returns uptime in seconds', async () => {
      await new Promise(r => setTimeout(r, 100));
      const report = await monitor.check();
      expect(report.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordOperation', () => {
    it('updates lastOperationAt', async () => {
      monitor.recordOperation(true);
      const report = monitor.getReport();
      expect(report.lastOperationAt).not.toBeNull();
    });

    it('increments errorCount on failure', () => {
      monitor.recordOperation(false);
      monitor.recordOperation(false);
      const report = monitor.getReport();
      expect(report.errorCount).toBe(2);
    });
  });

  describe('getComponentStatus', () => {
    it('returns component health', async () => {
      await monitor.check();
      const fs = monitor.getComponentStatus('filesystem');
      expect(fs).toBeDefined();
      expect(fs?.name).toBe('filesystem');
    });

    it('returns undefined for unknown component', () => {
      expect(monitor.getComponentStatus('unknown')).toBeUndefined();
    });
  });

  describe('periodic checks', () => {
    it('starts and stops without error', () => {
      monitor.startPeriodicChecks();
      monitor.stopPeriodicChecks();
      // No error thrown
    });

    it('does not start twice', () => {
      monitor.startPeriodicChecks();
      monitor.startPeriodicChecks(); // second call is no-op
      monitor.stopPeriodicChecks();
    });
  });

  describe('globalHealthMonitor', () => {
    it('is a singleton instance', () => {
      expect(globalHealthMonitor).toBeInstanceOf(HealthMonitor);
    });
  });
});
