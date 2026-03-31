/**
 * TaskClassifier Tests
 * Unit tests + Property-based tests (Properties 1, 2, 3)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { TaskClassifier } from '../../src/gateway/TaskClassifier';
import { TaskType, ChatMessage, HIGH_ENTROPY_TASKS, LOW_ENTROPY_TASKS } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

const classifier = new TaskClassifier();

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const arbitraryChatMessage = (): fc.Arbitrary<ChatMessage> =>
  fc.record({
    role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
    content: fc.string({ minLength: 0, maxLength: 200 }),
  });

const arbitraryTaskType = (): fc.Arbitrary<TaskType> =>
  fc.constantFrom(...TaskClassifier.TASK_TYPES);

// ─── Property 1: Classification Validity ─────────────────────────────────────

describe('Property 1: Classification Validity', () => {
  it('always returns a valid taskType and entropy for any messages', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryChatMessage(), { minLength: 0, maxLength: 10 }),
        (messages) => {
          const result = classifier.classify(messages);
          expect(TaskClassifier.TASK_TYPES).toContain(result.taskType);
          expect(['high', 'low']).toContain(result.entropy);
        }
      )
    );
  });
});

// ─── Property 2: Entropy Mapping ─────────────────────────────────────────────

describe('Property 2: Entropy Mapping', () => {
  it('high-entropy tasks always return entropy=high', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HIGH_ENTROPY_TASKS),
        (taskType) => {
          expect(TaskClassifier.getEntropy(taskType)).toBe('high');
        }
      )
    );
  });

  it('low-entropy tasks always return entropy=low', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LOW_ENTROPY_TASKS),
        (taskType) => {
          expect(TaskClassifier.getEntropy(taskType)).toBe('low');
        }
      )
    );
  });

  it('classify() entropy matches getEntropy() for any taskHint', () => {
    fc.assert(
      fc.property(
        arbitraryTaskType(),
        fc.array(arbitraryChatMessage(), { minLength: 0, maxLength: 5 }),
        (taskType, messages) => {
          const result = classifier.classify(messages, taskType);
          expect(result.entropy).toBe(TaskClassifier.getEntropy(taskType));
        }
      )
    );
  });
});

// ─── Property 3: Hint Passthrough ────────────────────────────────────────────

describe('Property 3: Hint Passthrough', () => {
  it('taskHint overrides content-based classification', () => {
    fc.assert(
      fc.property(
        arbitraryTaskType(),
        fc.array(arbitraryChatMessage(), { minLength: 0, maxLength: 10 }),
        (taskHint, messages) => {
          const result = classifier.classify(messages, taskHint);
          expect(result.taskType).toBe(taskHint);
          expect(result.confidence).toBe('hint');
        }
      )
    );
  });
});

// ─── Unit Tests: Keyword Rules ────────────────────────────────────────────────

describe('Keyword classification rules', () => {
  const classify = (content: string) =>
    classifier.classify([{ role: 'user', content }]);

  describe('mcp-orchestration', () => {
    it('matches "mcp"', () => expect(classify('use mcp tool').taskType).toBe('mcp-orchestration'));
    it('matches "tool call"', () => expect(classify('make a tool call').taskType).toBe('mcp-orchestration'));
    it('matches "orchestrate"', () => expect(classify('orchestrate the agents').taskType).toBe('mcp-orchestration'));
  });

  describe('research-synthesis', () => {
    it('matches "research"', () => expect(classify('research quantum computing').taskType).toBe('research-synthesis'));
    it('matches "synthesize"', () => expect(classify('synthesize these findings').taskType).toBe('research-synthesis'));
    it('matches "analyze"', () => expect(classify('analyze the data').taskType).toBe('research-synthesis'));
    it('matches "insight"', () => expect(classify('give me insight on this').taskType).toBe('research-synthesis'));
  });

  describe('philosophical-dialogue', () => {
    it('matches "why"', () => expect(classify('why does this exist').taskType).toBe('philosophical-dialogue'));
    it('matches "consciousness"', () => expect(classify('what is consciousness').taskType).toBe('philosophical-dialogue'));
    it('matches "philosophy"', () => expect(classify('philosophical question').taskType).toBe('philosophical-dialogue'));
    it('matches "meaning"', () => expect(classify('what is the meaning of life').taskType).toBe('philosophical-dialogue'));
  });

  describe('code-generation', () => {
    it('matches "function"', () => expect(classify('write a function to sort').taskType).toBe('code-generation'));
    it('matches "implement"', () => expect(classify('implement this interface').taskType).toBe('code-generation'));
    it('matches "class"', () => expect(classify('create a class for users').taskType).toBe('code-generation'));
    it('matches "refactor"', () => expect(classify('refactor this code').taskType).toBe('code-generation'));
  });

  describe('testing-validation', () => {
    it('matches "test"', () => expect(classify('write a test for this').taskType).toBe('testing-validation'));
    it('matches "validate"', () => expect(classify('validate the input').taskType).toBe('testing-validation'));
    it('matches "assert"', () => expect(classify('assert the output is correct').taskType).toBe('testing-validation'));
    it('matches "verify"', () => expect(classify('verify this works').taskType).toBe('testing-validation'));
  });

  describe('chronicle-writing', () => {
    it('matches "chronicle"', () => expect(classify('write a chronicle entry').taskType).toBe('chronicle-writing'));
    it('matches "inscribe"', () => expect(classify('inscribe this chapter').taskType).toBe('chronicle-writing'));
    it('matches "chapter"', () => expect(classify('format this chapter').taskType).toBe('chronicle-writing'));
  });

  describe('truth-extraction', () => {
    it('matches "extract"', () => expect(classify('extract the facts').taskType).toBe('truth-extraction'));
    it('matches "truth"', () => expect(classify('find the truth in this').taskType).toBe('truth-extraction'));
    it('matches "fact"', () => expect(classify('what are the facts here').taskType).toBe('truth-extraction'));
  });

  describe('default fallback', () => {
    it('returns philosophical-dialogue with high entropy when no keywords match', () => {
      const result = classify('hello there, how are you today');
      expect(result.taskType).toBe('philosophical-dialogue');
      expect(result.entropy).toBe('high');
      expect(result.confidence).toBe('default');
    });

    it('returns default for empty message', () => {
      const result = classifier.classify([]);
      expect(result.taskType).toBe('philosophical-dialogue');
      expect(result.confidence).toBe('default');
    });
  });

  describe('entropy values', () => {
    it('mcp-orchestration is high entropy', () => expect(classify('mcp tool').entropy).toBe('high'));
    it('research-synthesis is high entropy', () => expect(classify('research this').entropy).toBe('high'));
    it('philosophical-dialogue is high entropy', () => expect(classify('why exist').entropy).toBe('high'));
    it('code-generation is low entropy', () => expect(classify('write a function').entropy).toBe('low'));
    it('testing-validation is low entropy', () => expect(classify('write a test').entropy).toBe('low'));
    it('chronicle-writing is low entropy', () => expect(classify('chronicle entry').entropy).toBe('low'));
    it('truth-extraction is low entropy', () => expect(classify('extract facts').entropy).toBe('low'));
  });
});
