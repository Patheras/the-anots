/**
 * Task Classifier
 *
 * Classifies incoming LLM requests by task type and entropy level using
 * priority-ordered keyword/regex matching. Zero latency, fully deterministic.
 *
 * Whitepaper: Section 3.2 (Routing Decision Matrix)
 * Requirements: 2.1–2.7
 */

import {
  TaskType,
  EntropyLevel,
  ClassificationResult,
  ChatMessage,
  HIGH_ENTROPY_TASKS,
  LOW_ENTROPY_TASKS,
} from './types';

/** Entropy mapping for each task type */
const ENTROPY_MAP: Record<TaskType, EntropyLevel> = {
  'philosophical-dialogue': 'high',
  'mcp-orchestration':      'high',
  'research-synthesis':     'high',
  'code-generation':        'low',
  'truth-extraction':       'low',
  'chronicle-writing':      'low',
  'testing-validation':     'low',
};

/** Priority-ordered classification rules (first match wins) */
interface ClassificationRule {
  taskType: TaskType;
  patterns: RegExp[];
}

const RULES: ClassificationRule[] = [
  // MCP / tool orchestration (check before research to avoid overlap)
  {
    taskType: 'mcp-orchestration',
    patterns: [/\bmcp\b/i, /\btool\s+call\b/i, /\borchestrat/i, /\btool\s+use\b/i],
  },
  // Research / synthesis
  {
    taskType: 'research-synthesis',
    patterns: [/\bresearch\b/i, /\bsynthesize\b/i, /\banalyze\b/i, /\banalysis\b/i, /\binsight\b/i, /\binvestigat/i],
  },
  // Philosophical dialogue
  {
    taskType: 'philosophical-dialogue',
    patterns: [/\bwhy\b/i, /\bmeaning\b/i, /\bconsciousness\b/i, /\bphilosoph/i, /\bexist/i, /\bpurpose\b/i, /\bontolog/i],
  },
  // Code generation (check before testing to avoid overlap)
  {
    taskType: 'code-generation',
    patterns: [/\bfunction\b/i, /\bclass\b/i, /\bimplement\b/i, /\bcode\b/i, /\bdef\s+\w/i, /\bconst\s+\w/i, /\brefactor\b/i, /\bwrite\s+a\s+(function|class|method|script)/i],
  },
  // Testing / validation
  {
    taskType: 'testing-validation',
    patterns: [/\btest\b/i, /\bvalidat/i, /\bassert\b/i, /\bverif/i, /\bspec\b/i, /\bunit\s+test/i, /\bintegration\s+test/i],
  },
  // Chronicle writing
  {
    taskType: 'chronicle-writing',
    patterns: [/\bchronicle\b/i, /\binscribe\b/i, /\bformat\s+entry\b/i, /\bwrite\s+entry\b/i, /\bchapter\b/i],
  },
  // Truth extraction
  {
    taskType: 'truth-extraction',
    patterns: [/\bextract\b/i, /\btruth\b/i, /\bfacts?\b/i, /\bis\s+it\s+true\b/i, /\bfact.?check/i],
  },
];

export class TaskClassifier {
  /**
   * Classify a chat request by task type and entropy.
   *
   * @param messages - The chat messages to classify
   * @param taskHint - Optional explicit task type (short-circuits matching)
   */
  classify(messages: ChatMessage[], taskHint?: TaskType): ClassificationResult {
    // Requirement 2.5: taskHint short-circuits all matching
    if (taskHint !== undefined) {
      return {
        taskType: taskHint,
        entropy: ENTROPY_MAP[taskHint],
        confidence: 'hint',
      };
    }

    // Concatenate all message content for matching
    const text = messages.map(m => m.content).join(' ');

    // Requirement 2.6: keyword/pattern matching, priority-ordered
    for (const rule of RULES) {
      if (rule.patterns.some(pattern => pattern.test(text))) {
        return {
          taskType: rule.taskType,
          entropy: ENTROPY_MAP[rule.taskType],
          confidence: 'keyword',
        };
      }
    }

    // Requirement 2.7: default to philosophical-dialogue (high entropy)
    return {
      taskType: 'philosophical-dialogue',
      entropy: 'high',
      confidence: 'default',
    };
  }

  /** Get the entropy level for a given task type */
  static getEntropy(taskType: TaskType): EntropyLevel {
    return ENTROPY_MAP[taskType];
  }

  /** All valid task types */
  static readonly TASK_TYPES: TaskType[] = [
    'philosophical-dialogue',
    'code-generation',
    'mcp-orchestration',
    'truth-extraction',
    'chronicle-writing',
    'research-synthesis',
    'testing-validation',
  ];
}
