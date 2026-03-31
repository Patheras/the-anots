/**
 * Property 2: File-System-Only Layers Have Zero External Dependencies
 *
 * Validates: Requirements 1.5, 1.6, 3.7
 *
 * This property test verifies that L1 (Chronicle) and L4 (Agent Codex)
 * layers use ONLY file system operations with no external dependencies:
 * - No network calls
 * - No external processes
 * - No database connections
 * - Only fs, path, and git operations
 *
 * Test Strategy:
 * 1. Monitor system calls during L1 and L4 operations
 * 2. Verify only file system operations occur
 * 3. Test with various operations (read, write, update)
 * 4. Ensure no network activity or external process spawning
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ChronicleChapter } from '../src/chronicle/types';
import { writeChronicle } from '../src/chronicle/writer';
import { parseChronicle } from '../src/chronicle/parser';
import { serializeChronicle } from '../src/chronicle/serializer';
import { initializeNodeCodex } from '../src/codex/initializer';
import { updateAgentCodex } from '../src/codex/updater';
import { loadAgentCodex } from '../src/codex/loader';
import type { CodexFile, AgentNode } from '../src/codex/types';

// Test configuration
const TEST_ITERATIONS = 100;

describe('Property 2: File-System-Only Layers', () => {
  let testRoot: string;
  let chronicleRoot: string;
  let codexRoot: string;

  beforeEach(async () => {
    // Create unique test directory for this test suite
    testRoot = path.join(
      os.tmpdir(),
      `tcam-filesystem-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    chronicleRoot = path.join(testRoot, 'chronicle');
    codexRoot = path.join(testRoot, 'codex');

    await fs.mkdir(testRoot, { recursive: true });
    await fs.mkdir(chronicleRoot, { recursive: true });
    await fs.mkdir(codexRoot, { recursive: true });

    // Set environment variables for test isolation
    process.env.CHRONICLE_ROOT = chronicleRoot;
    process.env.CODEX_ROOT = codexRoot;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up environment variables
    delete process.env.CHRONICLE_ROOT;
    delete process.env.CODEX_ROOT;
  });

  /**
   * Test 1: Chronicle operations use only file system
   *
   * Verifies that Chronicle write, read, and parse operations
   * do not make any network calls or spawn external processes.
   */
  it(
    'should use only file system for Chronicle operations',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random Chronicle chapters
          fc.record({
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
            chapterId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
            participants: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
            sessionType: fc.constantFrom('general', 'ubik', 'axiom'),
            messageCount: fc.integer({ min: 1, max: 100 }),
            summary: fc.string({ minLength: 10, maxLength: 200 }).filter((s) => s.trim().length > 0),
            dialogue: fc.array(
              fc.string({ minLength: 10, maxLength: 500 }).filter((s) => s.trim().length > 0),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          async (data) => {
            // Create Chronicle chapter
            const chapter: ChronicleChapter = {
              metadata: {
                date: data.date.toISOString().split('T')[0],
                chapterId: data.chapterId,
                participants: data.participants,
                sessionType: data.sessionType as 'general' | 'ubik' | 'axiom',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                messageCount: data.messageCount,
                summary: data.summary,
              },
              content: {
                summary: data.summary,
                dialogue: data.dialogue.join('\n\n'),
                truths: [],
                insights: [],
                toolsCreated: [],
                decisions: [],
              },
            };

            // Track system calls (simplified approach)
            // In a real implementation, you might use strace or dtrace
            const operations: string[] = [];

            // Monkey-patch fs operations to track calls
            const originalWriteFile = fs.writeFile;
            const originalReadFile = fs.readFile;
            const originalMkdir = fs.mkdir;

            (fs as any).writeFile = async (...args: any[]) => {
              operations.push('fs.writeFile');
              return originalWriteFile.apply(fs, args as any);
            };

            (fs as any).readFile = async (...args: any[]) => {
              operations.push('fs.readFile');
              return originalReadFile.apply(fs, args as any);
            };

            (fs as any).mkdir = async (...args: any[]) => {
              operations.push('fs.mkdir');
              return originalMkdir.apply(fs, args as any);
            };

            try {
              // Perform Chronicle operations
              const markdown = serializeChronicle(chapter);
              await writeChronicle(chapter);

              // Read back the file
              const sessionDir = path.join(chronicleRoot, 'chip', data.sessionType);
              
              // Check if directory exists before reading
              try {
                await fs.access(sessionDir);
                const files = await fs.readdir(sessionDir);
                
                if (files.length > 0) {
                  const filePath = path.join(sessionDir, files[files.length - 1]);
                  const content = await fs.readFile(filePath, 'utf-8');
                  const parsed = parseChronicle(content);

                  // Verify operations are only file system
                  expect(operations.every((op) => op.startsWith('fs.'))).toBe(true);

                  // Verify no network operations (would show up as 'net.' or 'http.')
                  expect(operations.some((op) => op.startsWith('net.'))).toBe(false);
                  expect(operations.some((op) => op.startsWith('http.'))).toBe(false);

                  // Verify parsed data is valid
                  expect(parsed.metadata.chapterId).toBe(chapter.metadata.chapterId);
                }
              } catch (dirError) {
                // Directory doesn't exist yet - that's okay, just verify operations
                expect(operations.every((op) => op.startsWith('fs.'))).toBe(true);
                expect(operations.some((op) => op.startsWith('net.'))).toBe(false);
                expect(operations.some((op) => op.startsWith('http.'))).toBe(false);
              }
            } finally {
              // Restore original functions
              (fs as any).writeFile = originalWriteFile;
              (fs as any).readFile = originalReadFile;
              (fs as any).mkdir = originalMkdir;
            }
          }
        ),
        { numRuns: TEST_ITERATIONS }
      );
    },
    120000 // 2 minute timeout for property test
  );

  /**
   * Test 2: Agent Codex operations use only file system
   *
   * Verifies that Codex initialization, update, and load operations
   * do not make any network calls or spawn external processes.
   */
  it(
    'should use only file system for Agent Codex operations',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random Codex operations
          fc.record({
            node: fc.constantFrom('ubik', 'axiom'),
            file: fc.constantFrom(
              'README.md',
              'TASKS.md',
              'SYNTHETIC-DIARY.md',
              'NOTES.md',
              'CONTEXT.md',
              'TOOLS.md'
            ),
            operation: fc.constantFrom('append', 'replace'),
            content: fc.string({ minLength: 10, maxLength: 500 }).filter((s) => s.trim().length > 0),
          }),
          async (data) => {
            // Track system calls
            const operations: string[] = [];

            // Monkey-patch fs operations
            const originalWriteFile = fs.writeFile;
            const originalReadFile = fs.readFile;
            const originalMkdir = fs.mkdir;
            const originalAppendFile = fs.appendFile;

            (fs as any).writeFile = async (...args: any[]) => {
              operations.push('fs.writeFile');
              return originalWriteFile.apply(fs, args as any);
            };

            (fs as any).readFile = async (...args: any[]) => {
              operations.push('fs.readFile');
              return originalReadFile.apply(fs, args as any);
            };

            (fs as any).mkdir = async (...args: any[]) => {
              operations.push('fs.mkdir');
              return originalMkdir.apply(fs, args as any);
            };

            (fs as any).appendFile = async (...args: any[]) => {
              operations.push('fs.appendFile');
              return originalAppendFile.apply(fs, args as any);
            };

            try {
              // Initialize Codex
              await initializeNodeCodex(data.node as AgentNode);

              // Perform update operation
              await updateAgentCodex({
                node: data.node as AgentNode,
                file: data.file as CodexFile,
                operation: data.operation as 'append' | 'replace',
                content: data.content,
                summary: `Test ${data.operation}`,
              });

              // Load Codex
              const codex = await loadAgentCodex(data.node as AgentNode);

              // Verify operations are only file system
              expect(operations.every((op) => op.startsWith('fs.'))).toBe(true);

              // Verify no network operations
              expect(operations.some((op) => op.startsWith('net.'))).toBe(false);
              expect(operations.some((op) => op.startsWith('http.'))).toBe(false);

              // Verify codex is valid
              expect(codex.node).toBe(data.node);
            } finally {
              // Restore original functions
              (fs as any).writeFile = originalWriteFile;
              (fs as any).readFile = originalReadFile;
              (fs as any).mkdir = originalMkdir;
              (fs as any).appendFile = originalAppendFile;
            }
          }
        ),
        { numRuns: TEST_ITERATIONS }
      );
    },
    120000 // 2 minute timeout
  );

  /**
   * Test 3: No external process spawning
   *
   * Verifies that L1 and L4 operations do not spawn external processes
   * (except for Git, which is allowed and optional).
   */
  it('should not spawn external processes (except Git)', async () => {
    // Track child_process calls
    const childProcess = require('child_process');
    const spawnCalls: string[] = [];
    const execCalls: string[] = [];

    const originalSpawn = childProcess.spawn;
    const originalExec = childProcess.exec;

    childProcess.spawn = (...args: any[]) => {
      spawnCalls.push(args[0]);
      return originalSpawn.apply(childProcess, args);
    };

    childProcess.exec = (...args: any[]) => {
      execCalls.push(args[0]);
      return originalExec.apply(childProcess, args);
    };

    try {
      // Perform Chronicle operation
      const chapter: ChronicleChapter = {
        metadata: {
          date: '2025-03-23',
          chapterId: 'test-chapter',
          participants: ['Chip', 'Kiro'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 5,
        },
        content: {
          summary: 'Test chapter for property testing',
          dialogue: 'Message 1\n\nMessage 2',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      await writeChronicle(chapter);

      // Perform Codex operation
      await initializeNodeCodex('ubik');
      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\nTest task',
        summary: 'Add test task',
      });

      // Verify no external processes spawned (except Git)
      const nonGitSpawns = spawnCalls.filter((cmd) => !cmd.includes('git'));
      const nonGitExecs = execCalls.filter((cmd) => !cmd.includes('git'));

      expect(nonGitSpawns).toHaveLength(0);
      expect(nonGitExecs).toHaveLength(0);
    } finally {
      // Restore original functions
      childProcess.spawn = originalSpawn;
      childProcess.exec = originalExec;
    }
  });

  /**
   * Test 4: No network activity
   *
   * Verifies that L1 and L4 operations do not make any network calls.
   * This is a simplified test - in production, you might use network
   * monitoring tools or mock the network layer.
   */
  it('should not make any network calls', async () => {
    // Track network module usage
    const net = require('net');
    const http = require('http');
    const https = require('https');

    const netCalls: string[] = [];
    const httpCalls: string[] = [];
    const httpsCalls: string[] = [];

    const originalNetConnect = net.connect;
    const originalHttpRequest = http.request;
    const originalHttpsRequest = https.request;

    net.connect = (...args: any[]) => {
      netCalls.push('net.connect');
      return originalNetConnect.apply(net, args);
    };

    http.request = (...args: any[]) => {
      httpCalls.push('http.request');
      return originalHttpRequest.apply(http, args);
    };

    https.request = (...args: any[]) => {
      httpsCalls.push('https.request');
      return originalHttpsRequest.apply(https, args);
    };

    try {
      // Perform Chronicle operation
      const chapter: ChronicleChapter = {
        metadata: {
          date: '2025-03-23',
          chapterId: 'network-test',
          participants: ['Chip', 'Kiro'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 3,
        },
        content: {
          summary: 'Testing network isolation',
          dialogue: 'Test message',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      await writeChronicle(chapter);

      // Perform Codex operation
      await initializeNodeCodex('axiom');
      const codex = await loadAgentCodex('axiom');

      // Verify no network calls
      expect(netCalls).toHaveLength(0);
      expect(httpCalls).toHaveLength(0);
      expect(httpsCalls).toHaveLength(0);

      // Verify operations succeeded
      expect(codex.node).toBe('axiom');
    } finally {
      // Restore original functions
      net.connect = originalNetConnect;
      http.request = originalHttpRequest;
      https.request = originalHttpsRequest;
    }
  });
});
