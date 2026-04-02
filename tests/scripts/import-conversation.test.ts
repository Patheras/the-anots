/**
 * Import Module Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parseConversationFile } from '../../src/import/parsers';

describe('Import Module', () => {
  const testDir = 'data/import/test';

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseConversationFile', () => {
    it('should parse JSON array format', async () => {
      const testFile = path.join(testDir, 'test-array.json');
      const data = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      await fs.writeFile(testFile, JSON.stringify(data, null, 2));

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toBe('Hi there!');
    });

    it('should parse JSON object format with metadata', async () => {
      const testFile = path.join(testDir, 'test-object.json');
      const data = {
        metadata: {
          title: 'Test Conversation',
          date: '2024-01-15',
          participants: ['chip', 'ubik'],
        },
        messages: [
          { role: 'user', content: 'Test message' },
        ],
      };

      await fs.writeFile(testFile, JSON.stringify(data, null, 2));

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(1);
      expect(result.metadata?.title).toBe('Test Conversation');
      expect(result.metadata?.date).toBe('2024-01-15');
      expect(result.metadata?.participants).toEqual(['chip', 'ubik']);
    });

    it('should parse Markdown format', async () => {
      const testFile = path.join(testDir, 'test.md');
      const markdown = `# Test Conversation

## User
Hello, how are you?

## Assistant
I'm doing well, thank you!

## User
That's great to hear.
`;

      await fs.writeFile(testFile, markdown);

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, how are you?');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toBe("I'm doing well, thank you!");
      expect(result.messages[2].role).toBe('user');
      expect(result.messages[2].content).toBe("That's great to hear.");
      expect(result.metadata?.title).toBe('Test Conversation');
    });

    it('should handle Markdown with system messages', async () => {
      const testFile = path.join(testDir, 'test-system.md');
      const markdown = `## System
You are a helpful assistant.

## User
Hello!

## Assistant
Hi there!
`;

      await fs.writeFile(testFile, markdown);

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[2].role).toBe('assistant');
    });

    it('should throw error for unsupported format', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Plain text content');

      await expect(parseConversationFile(testFile)).rejects.toThrow(
        'Unsupported file format'
      );
    });

    it('should throw error for invalid JSON', async () => {
      const testFile = path.join(testDir, 'invalid.json');
      await fs.writeFile(testFile, '{ invalid json }');

      await expect(parseConversationFile(testFile)).rejects.toThrow();
    });

    it('should throw error for invalid JSON structure', async () => {
      const testFile = path.join(testDir, 'invalid-structure.json');
      const data = { foo: 'bar' }; // Missing messages array

      await fs.writeFile(testFile, JSON.stringify(data));

      await expect(parseConversationFile(testFile)).rejects.toThrow(
        'Invalid JSON format'
      );
    });

    it('should handle empty Markdown file', async () => {
      const testFile = path.join(testDir, 'empty.md');
      await fs.writeFile(testFile, '');

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(0);
    });

    it('should handle Markdown with only title', async () => {
      const testFile = path.join(testDir, 'title-only.md');
      await fs.writeFile(testFile, '# My Conversation\n\nSome text but no messages.');

      const result = await parseConversationFile(testFile);

      expect(result.metadata?.title).toBe('My Conversation');
      expect(result.messages).toHaveLength(0);
    });

    it('should preserve message timestamps', async () => {
      const testFile = path.join(testDir, 'timestamps.json');
      const data = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          role: 'assistant',
          content: 'Hi',
          timestamp: '2024-01-15T10:01:00Z',
        },
      ];

      await fs.writeFile(testFile, JSON.stringify(data, null, 2));

      const result = await parseConversationFile(testFile);

      expect(result.messages[0].timestamp).toBe('2024-01-15T10:00:00Z');
      expect(result.messages[1].timestamp).toBe('2024-01-15T10:01:00Z');
    });

    it('should preserve message metadata', async () => {
      const testFile = path.join(testDir, 'metadata.json');
      const data = [
        {
          role: 'user',
          content: 'Hello',
          metadata: { source: 'web', userId: '123' },
        },
      ];

      await fs.writeFile(testFile, JSON.stringify(data, null, 2));

      const result = await parseConversationFile(testFile);

      expect(result.messages[0].metadata).toEqual({
        source: 'web',
        userId: '123',
      });
    });

    it('should handle large conversation files', async () => {
      const testFile = path.join(testDir, 'large.json');
      const messages = [];

      // Generate 1000 messages
      for (let i = 0; i < 1000; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }

      await fs.writeFile(testFile, JSON.stringify(messages, null, 2));

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(1000);
      expect(result.messages[0].content).toBe('Message 0');
      expect(result.messages[999].content).toBe('Message 999');
    });

    it('should handle Markdown with multiline messages', async () => {
      const testFile = path.join(testDir, 'multiline.md');
      const markdown = `## User
This is a long message
that spans multiple lines
and has several paragraphs.

It even has blank lines.

## Assistant
I understand your
multiline message.
`;

      await fs.writeFile(testFile, markdown);

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toContain('multiple lines');
      expect(result.messages[0].content).toContain('blank lines');
      expect(result.messages[1].content).toContain('multiline message');
    });

    it('should handle Markdown with code blocks', async () => {
      const testFile = path.join(testDir, 'code.md');
      const markdown = `## User
Can you help with this code?

\`\`\`typescript
function hello() {
  console.log("Hello");
}
\`\`\`

## Assistant
Sure, I can help!
`;

      await fs.writeFile(testFile, markdown);

      const result = await parseConversationFile(testFile);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toContain('```typescript');
      expect(result.messages[0].content).toContain('function hello()');
    });
  });
});
