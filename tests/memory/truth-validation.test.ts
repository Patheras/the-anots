/**
 * Tests for Truth Schema Validation
 * 
 * Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7
 */

import { validateTruth, createTruth, TruthSchema } from '../../src/memory/types';

describe('Truth Schema Validation', () => {
  describe('Valid Truths', () => {
    it('should validate a complete truth object', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'software engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
        metadata: {
          sessionId: 'session_123',
        },
      };

      expect(() => validateTruth(truth)).not.toThrow();
      const validated = validateTruth(truth);
      expect(validated.subject).toBe('Alice');
    });

    it('should validate truth without metadata', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Bob',
        predicate: 'likes',
        object: 'coding',
        confidence: 0.9,
        timestamp: new Date(),
        source: 'llm_extraction' as const,
      };

      expect(() => validateTruth(truth)).not.toThrow();
    });

    it('should validate truth with manual source', () => {
      const truth = {
        id: 'truth_123',
        subject: 'System',
        predicate: 'has',
        object: 'feature',
        confidence: 1.0,
        timestamp: new Date(),
        source: 'manual' as const,
      };

      expect(() => validateTruth(truth)).not.toThrow();
    });

    it('should validate truth with minimum confidence (0.0)', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Test',
        predicate: 'is',
        object: 'uncertain',
        confidence: 0.0,
        timestamp: new Date(),
        source: 'llm_extraction' as const,
      };

      expect(() => validateTruth(truth)).not.toThrow();
    });

    it('should validate truth with maximum confidence (1.0)', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Fact',
        predicate: 'is',
        object: 'certain',
        confidence: 1.0,
        timestamp: new Date(),
        source: 'manual' as const,
      };

      expect(() => validateTruth(truth)).not.toThrow();
    });
  });

  describe('Invalid Truths - Required Fields', () => {
    it('should reject truth with empty ID', () => {
      const truth = {
        id: '',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject truth with empty subject', () => {
      const truth = {
        id: 'truth_123',
        subject: '',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject truth with empty predicate', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: '',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject truth with empty object', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: '',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject truth without ID', () => {
      const truth = {
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });
  });

  describe('Invalid Truths - Confidence', () => {
    it('should reject confidence below 0.0', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: -0.1,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject confidence above 1.0', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 1.1,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject non-numeric confidence', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 'high' as any,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });
  });

  describe('Invalid Truths - Source', () => {
    it('should reject invalid source', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'invalid_source' as any,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject missing source', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
      };

      expect(() => validateTruth(truth)).toThrow();
    });
  });

  describe('Invalid Truths - Timestamp', () => {
    it('should reject non-date timestamp', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: '2025-03-24' as any,
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });

    it('should reject missing timestamp', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        source: 'mem0_extraction' as const,
      };

      expect(() => validateTruth(truth)).toThrow();
    });
  });

  describe('createTruth Helper', () => {
    it('should create truth with default values', () => {
      const truth = createTruth('Alice', 'works as', 'engineer');

      expect(truth.id).toBeDefined();
      expect(truth.subject).toBe('Alice');
      expect(truth.predicate).toBe('works as');
      expect(truth.object).toBe('engineer');
      expect(truth.confidence).toBe(0.95);
      expect(truth.timestamp).toBeInstanceOf(Date);
      expect(truth.source).toBe('llm_extraction');
    });

    it('should create truth with custom confidence', () => {
      const truth = createTruth('Bob', 'likes', 'coding', {
        confidence: 0.8,
      });

      expect(truth.confidence).toBe(0.8);
    });

    it('should create truth with custom source', () => {
      const truth = createTruth('System', 'has', 'feature', {
        source: 'manual',
      });

      expect(truth.source).toBe('manual');
    });

    it('should create truth with metadata', () => {
      const truth = createTruth('Alice', 'works at', 'Company', {
        metadata: {
          sessionId: 'session_123',
          userId: 'user_456',
        },
      });

      expect(truth.metadata).toBeDefined();
      expect(truth.metadata?.sessionId).toBe('session_123');
      expect(truth.metadata?.userId).toBe('user_456');
    });

    it('should generate unique IDs', () => {
      const truth1 = createTruth('A', 'B', 'C');
      const truth2 = createTruth('A', 'B', 'C');

      expect(truth1.id).not.toBe(truth2.id);
    });

    it('should create valid truths that pass validation', () => {
      const truth = createTruth('Alice', 'works as', 'engineer');

      expect(() => validateTruth(truth)).not.toThrow();
    });
  });

  describe('TruthSchema Direct Usage', () => {
    it('should parse valid truth', () => {
      const truth = {
        id: 'truth_123',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 0.95,
        timestamp: new Date(),
        source: 'mem0_extraction' as const,
      };

      const result = TruthSchema.parse(truth);
      expect(result).toEqual(truth);
    });

    it('should provide detailed error messages', () => {
      const truth = {
        id: '',
        subject: 'Alice',
        predicate: 'works as',
        object: 'engineer',
        confidence: 1.5,
        timestamp: new Date(),
        source: 'invalid' as any,
      };

      try {
        TruthSchema.parse(truth);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.errors).toBeDefined();
        expect(error.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
