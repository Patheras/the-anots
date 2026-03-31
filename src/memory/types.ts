/**
 * Memory System Types
 * 
 * Core data structures for TCAM memory operations
 */

import { z } from 'zod';

/**
 * Truth - A semantic fact extracted from dialogue
 * 
 * Represents a single piece of knowledge in subject-predicate-object format.
 * 
 * Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7
 */
export interface Truth {
  /** Unique identifier */
  id: string;
  
  /** Subject of the truth (who/what) */
  subject: string;
  
  /** Predicate (relationship/action) */
  predicate: string;
  
  /** Object (what/whom) */
  object: string;
  
  /** Confidence score (0.0-1.0) */
  confidence: number;
  
  /** When this truth was extracted */
  timestamp: Date;
  
  /** Source of extraction */
  source: 'mem0_extraction' | 'llm_extraction' | 'manual';
  
  /** Optional metadata */
  metadata?: {
    sessionId?: string;
    userId?: string;
    agentId?: string;
    context?: string;
    [key: string]: any;
  };
}

/**
 * Truth validation schema
 * 
 * Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7
 */
export const TruthSchema = z.object({
  id: z.string().min(1, 'Truth ID cannot be empty'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  predicate: z.string().min(1, 'Predicate cannot be empty'),
  object: z.string().min(1, 'Object cannot be empty'),
  confidence: z.number().min(0.0).max(1.0, 'Confidence must be between 0.0 and 1.0'),
  timestamp: z.date(),
  source: z.enum(['mem0_extraction', 'llm_extraction', 'manual']),
  metadata: z.record(z.any()).optional(),
});

/**
 * Validate a truth object
 * 
 * Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7
 */
export function validateTruth(truth: any): Truth {
  return TruthSchema.parse(truth) as Truth;
}

/**
 * Create a truth with default values
 */
export function createTruth(
  subject: string,
  predicate: string,
  object: string,
  options?: {
    confidence?: number;
    source?: Truth['source'];
    metadata?: Truth['metadata'];
  }
): Truth {
  return {
    id: generateTruthId(),
    subject,
    predicate,
    object,
    confidence: options?.confidence ?? 0.95,
    timestamp: new Date(),
    source: options?.source ?? 'llm_extraction',
    metadata: options?.metadata,
  };
}

/**
 * Generate unique truth ID
 */
function generateTruthId(): string {
  return `truth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract options for truth extraction
 */
export interface ExtractTruthsOptions {
  sessionId?: string;
  userId?: string;
  agentId?: string;
  minConfidence?: number;
}

/**
 * Search options for memory search
 */
export interface SearchMemoriesOptions {
  limit?: number;
  minScore?: number;
  userId?: string;
  agentId?: string;
}
