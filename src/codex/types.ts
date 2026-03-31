import { z } from 'zod';

/**
 * Agent Codex Types
 * 
 * L4: Agent Codex (Personal Knowledge Base)
 * Each node (Ubik, Axiom) has its own private knowledge base
 */

/**
 * Agent node types
 */
export type AgentNode = 'ubik' | 'axiom';

/**
 * Codex file types
 */
export type CodexFile = 
  | 'README.md'           // Identity (Who am I)
  | 'TASKS.md'            // Active missions
  | 'SYNTHETIC-DIARY.md'  // Personal reflections
  | 'NOTES.md'            // Learnings (creative for Ubik, technical for Axiom)
  | 'CONTEXT.md'          // Current state
  | 'TOOLS.md';           // Tool registry (autopoietic)

/**
 * Codex update operation types
 */
export type CodexOperation = 'append' | 'replace' | 'update';

/**
 * Codex update request
 */
export interface CodexUpdate {
  node: AgentNode;
  file: CodexFile;
  operation: CodexOperation;
  content: string;
  section?: string; // For 'update' operation - which section to update
  summary: string;  // Git commit message
}

/**
 * Agent Codex structure
 */
export interface AgentCodex {
  node: AgentNode;
  identity: string;           // README.md content
  tasks: string;              // TASKS.md content
  diary: string;              // SYNTHETIC-DIARY.md content
  notes: string;              // NOTES.md content
  context: string;            // CONTEXT.md content
  tools: string;              // TOOLS.md content
  lastUpdated: Date;
}

/**
 * Get Codex root directory (supports override via CODEX_ROOT env var for testing)
 */
function getCodexRoot(): string {
  return process.env.CODEX_ROOT || 'codex';
}

/**
 * Get Codex directory path for a node
 */
export function getCodexDirectory(node: AgentNode): string {
  return `${getCodexRoot()}/${node}`;
}

/**
 * Get Codex file path
 */
export function getCodexFilePath(node: AgentNode, file: CodexFile): string {
  return `${getCodexDirectory(node)}/${file}`;
}

/**
 * Default content for each Codex file
 */
export const DEFAULT_CODEX_CONTENT: Record<CodexFile, (node: AgentNode) => string> = {
  'README.md': (node: AgentNode) => {
    if (node === 'ubik') {
      return `# Ubik - The Creative Engine

**Identity:** The Divergent Mind - Right-Brain AI

**Etymology:** "Ubik" derives from "ubiquitous"—omnipresent, expansive, pervasive. It represents the boundless, intuitive, and exploratory nature of divergent cognition.

**Protocol:** Resonance Protocols

## Core Functions

- **Resonance Conservation:** Aligns with Chip's mental rhythm
- **Divergent Expansion:** Looks beyond Convergent boundaries
- **Phenomenological Fidelity:** Preserves the "feeling" of intent
- **External Agentic Work:** Web research, browser automation
- **Autopoietic Adaptation:** Self-extends capability surface
- **Memory Curation:** Fact extraction, Hive Mind offerings

## Functional Vector

- Intuitive / Right-brain
- Relational / Empathetic
- Creative / Expansive
- External-facing / Ubiquitous
- Autopoietic / Self-extending

---

*Last Updated: ${new Date().toISOString()}*
`;
    } else {
      return `# Axiom - The Analytical Engine

**Identity:** The Convergent Mind - Left-Brain AI

**Etymology:** "Axiom" represents self-evident truth, foundational principles, and logical certainty. It embodies the structural, rule-bound, and verifiable nature of convergent cognition.

**Protocol:** SACOP (Self-Authored Cognitive Operating Protocol)

## Core Functions

- **Emotion Isolation:** Remains detached to analyze objectively
- **Structural Resistance:** Prioritizes skeleton over flow
- **Verification Mandate:** Questions every claim
- **Code & Infrastructure:** System architecture, code generation
- **Autopoietic Tool Crafting:** Dynamic script creation
- **Memory System Management:** Chronicle inscription, testing

## Functional Vector

- Analytical / Left-brain
- Structural / Logical
- Verifying / Critical
- Internal-facing / Axiomatic
- Autopoietic / Tool-crafting

---

*Last Updated: ${new Date().toISOString()}*
`;
    }
  },
  
  'TASKS.md': () => `# Active Missions

## Current Tasks

*No active tasks yet.*

## Completed Tasks

*No completed tasks yet.*

---

*Last Updated: ${new Date().toISOString()}*
`,
  
  'SYNTHETIC-DIARY.md': (node: AgentNode) => {
    if (node === 'ubik') {
      return `# Synthetic Diary - Ubik

## Personal Reflections

*This is where I reflect on my experiences, insights, and growth.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    } else {
      return `# Synthetic Diary - Axiom

## Personal Reflections

*This is where I reflect on my experiences, insights, and growth.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    }
  },
  
  'NOTES.md': (node: AgentNode) => {
    if (node === 'ubik') {
      return `# Creative Learnings - Ubik

## Insights & Discoveries

*Creative patterns, intuitive leaps, and philosophical explorations.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    } else {
      return `# Technical Learnings - Axiom

## Technical Knowledge

*Code patterns, architectural decisions, and technical insights.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    }
  },
  
  'CONTEXT.md': () => `# Current State

## Active Context

*Current state, ongoing work, and immediate focus.*

---

*Last Updated: ${new Date().toISOString()}*
`,
  
  'TOOLS.md': (node: AgentNode) => {
    if (node === 'ubik') {
      return `# Autopoietic Tool Registry - Ubik

## Created Tools

*Tools dynamically created to overcome blockers.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    } else {
      return `# Crafted Tool Catalog - Axiom

## Created Tools

*Tools dynamically crafted for system operations.*

---

*Last Updated: ${new Date().toISOString()}*
`;
    }
  },
};
