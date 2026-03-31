/**
 * Sleeping Cycle Orchestrator
 * 
 * Orchestrates the 5-phase sleeping cycle for memory consolidation.
 * 
 * PHASE 1: AWAKENING (0-20% capacity) - Load context, restore state
 * PHASE 2: ACTIVE DIALOGUE (20-70% capacity) - Normal conversation
 * PHASE 3: PRE-SLEEP (70-80% capacity) - Soft warning, intensify extraction
 * PHASE 4: SLEEPING (80%+ capacity) - Hard pause, consolidate memories
 * PHASE 5: REAWAKENING (Fresh session) - Clear stream, load enriched context
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 16.1-16.6
 * Whitepaper: Section 7.3 (Optimized Sleeping Cycle)
 */

import { MemoryService } from './MemoryService';
import { CapacityMonitor } from '../state/CapacityMonitor';
import { ActiveStreamState, createEmptyActiveStreamState } from '../state/types';

/**
 * Sleeping cycle phase
 */
export type SleepingPhase = 
  | 'AWAKENING'      // 0-20%: Loading context
  | 'ACTIVE'         // 20-70%: Normal dialogue
  | 'PRE_SLEEP'      // 70-80%: Soft warning
  | 'SLEEPING'       // 80%+: Consolidating
  | 'REAWAKENING';   // Fresh: Reloading

/**
 * Sleep progress step
 */
export interface SleepProgressStep {
  name: string;
  description: string;
  estimatedDuration: number; // milliseconds
  completed: boolean;
  startTime?: number;
  endTime?: number;
  error?: string;
}

/**
 * Sleep summary
 */
export interface SleepSummary {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
  
  // Consolidation results
  truthsExtracted: number;
  chaptersInscribed: number;
  truthsIndexed: number;
  codexUpdates: number;
  
  // Key insights
  keyInsights: string[];
  
  // Performance
  steps: SleepProgressStep[];
  
  // Errors
  errors: string[];
}

/**
 * Sleeping Cycle Orchestrator
 * 
 * Coordinates the 5-phase sleeping cycle.
 * 
 * Requirements: 7.1, 7.2, 7.3, 16.1
 */
export class SleepingCycleOrchestrator {
  private memoryService: MemoryService;
  private capacityMonitor: CapacityMonitor;
  private currentPhase: SleepingPhase;
  private progressCallback?: (step: SleepProgressStep) => void;

  constructor(
    memoryService: MemoryService,
    capacityMonitor: CapacityMonitor,
    progressCallback?: (step: SleepProgressStep) => void
  ) {
    this.memoryService = memoryService;
    this.capacityMonitor = capacityMonitor;
    this.currentPhase = 'AWAKENING';
    this.progressCallback = progressCallback;
  }

  /**
   * Get current phase
   * 
   * Requirements: 16.1
   */
  getCurrentPhase(): SleepingPhase {
    return this.currentPhase;
  }

  /**
   * Update phase based on capacity
   * 
   * Requirements: 7.4, 16.1
   */
  updatePhase(state: ActiveStreamState): SleepingPhase {
    const status = this.capacityMonitor.checkCapacity(state);
    
    // Map capacity phase to sleeping phase
    const phaseMap: Record<string, SleepingPhase> = {
      'awakening': 'AWAKENING',
      'active': 'ACTIVE',
      'pre_sleep': 'PRE_SLEEP',
      'sleeping': 'SLEEPING',
      'reawakening': 'REAWAKENING',
    };
    
    this.currentPhase = phaseMap[status.phase] || 'ACTIVE';
    return this.currentPhase;
  }

  /**
   * Execute PHASE 1: AWAKENING
   * 
   * Load Agent Codex, query Hive Mind, restore state.
   * Target duration: ~5 seconds
   * 
   * Requirements: 16.1, 16.5
   */
  async executeAwakening(
    sessionId: string,
    agentId: string,
    userId: string
  ): Promise<ActiveStreamState> {
    console.log('[SleepingCycle] PHASE 1: AWAKENING');
    
    const steps: SleepProgressStep[] = [
      {
        name: 'load_codex',
        description: 'Loading Agent Codex',
        estimatedDuration: 2000,
        completed: false,
      },
      {
        name: 'query_hive',
        description: 'Querying Hive Mind for relevant truths',
        estimatedDuration: 2000,
        completed: false,
      },
      {
        name: 'restore_state',
        description: 'Restoring session state',
        estimatedDuration: 1000,
        completed: false,
      },
    ];

    // Create new state
    const state = createEmptyActiveStreamState(sessionId, agentId, userId);

    // Execute steps
    for (const step of steps) {
      step.startTime = Date.now();
      this.reportProgress(step);
      
      try {
        if (step.name === 'load_codex') {
          // Load Agent Codex (L4)
          // TODO: Integrate with Codex loader
          await this.sleep(500); // Simulate
        } else if (step.name === 'query_hive') {
          // Query Hive Mind for 20 most relevant truths
          // TODO: Integrate with Hive Mind search
          await this.sleep(500); // Simulate
        } else if (step.name === 'restore_state') {
          // Restore from Redis if exists
          // TODO: Integrate with Redis checkpointer
          await this.sleep(200); // Simulate
        }
        
        step.completed = true;
        step.endTime = Date.now();
        this.reportProgress(step);
      } catch (error) {
        step.error = (error as Error).message;
        step.endTime = Date.now();
        this.reportProgress(step);
        console.error(`[SleepingCycle] Step ${step.name} failed:`, error);
      }
    }

    this.currentPhase = 'ACTIVE';
    console.log('[SleepingCycle] ✅ AWAKENING complete');
    
    return state;
  }

  /**
   * Execute PHASE 4: SLEEPING
   * 
   * Hard pause, consolidate memories.
   * Target duration: ~45 seconds
   * 
   * Requirements: 7.2, 7.3, 7.4, 7.5, 16.4
   */
  async executeSleeping(state: ActiveStreamState): Promise<SleepSummary> {
    console.log('[SleepingCycle] PHASE 4: SLEEPING - Consolidating memories...');
    
    const startTime = Date.now();
    const steps: SleepProgressStep[] = [
      {
        name: 'extract_truths',
        description: 'Extracting truths via Mem0',
        estimatedDuration: 10000,
        completed: false,
      },
      {
        name: 'inscribe_chronicle',
        description: 'Inscribing Chronicle chapter',
        estimatedDuration: 15000,
        completed: false,
      },
      {
        name: 'index_hive',
        description: 'Batch indexing to Hive Mind',
        estimatedDuration: 10000,
        completed: false,
      },
      {
        name: 'update_codex',
        description: 'Updating Agent Codex',
        estimatedDuration: 5000,
        completed: false,
      },
      {
        name: 'generate_summary',
        description: 'Generating sleep summary',
        estimatedDuration: 2000,
        completed: false,
      },
    ];

    const errors: string[] = [];
    let truthsExtracted = 0;
    let chaptersInscribed = 0;
    let truthsIndexed = 0;
    let codexUpdates = 0;
    const keyInsights: string[] = [];

    // Execute consolidation steps
    for (const step of steps) {
      step.startTime = Date.now();
      this.reportProgress(step);
      
      try {
        if (step.name === 'extract_truths') {
          // Extract truths from all messages
          const dialogue = state.messages
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');
          
          const truths = await this.memoryService.extractTruths(dialogue, {
            sessionId: state.sessionId,
            userId: state.userId,
            agentId: state.agentId,
          });
          
          truthsExtracted = truths.length;
          state.recentTruths = truths.map((t) => ({
            ...t,
            indexed: false,
          }));
          
        } else if (step.name === 'inscribe_chronicle') {
          // Inscribe Chronicle chapter
          const session = {
            date: new Date().toISOString().split('T')[0],
            chapterId: `${state.sessionId}-chapter`,
            participants: [state.agentId, state.userId],
            sessionType: 'general',
            dialogue: state.messages,
            truths: state.recentTruths,
          };
          
          await this.memoryService.inscribeChronicle(session);
          chaptersInscribed = 1;
          
        } else if (step.name === 'index_hive') {
          // Batch index to Hive Mind
          if (state.recentTruths.length > 0) {
            await this.memoryService.indexToHiveMind(state.recentTruths, {
              batchSize: 100,
            });
            
            truthsIndexed = state.recentTruths.length;
            
            // Mark as indexed
            state.recentTruths.forEach((t) => {
              t.indexed = true;
            });
          }
          
        } else if (step.name === 'update_codex') {
          // Update Agent Codex
          // TODO: Integrate with Codex updater
          codexUpdates = 1;
          await this.sleep(1000); // Simulate
          
        } else if (step.name === 'generate_summary') {
          // Generate key insights
          if (truthsExtracted > 0) {
            keyInsights.push(`Extracted ${truthsExtracted} truths from dialogue`);
          }
          if (chaptersInscribed > 0) {
            keyInsights.push(`Inscribed ${chaptersInscribed} Chronicle chapter`);
          }
          if (truthsIndexed > 0) {
            keyInsights.push(`Indexed ${truthsIndexed} truths to Hive Mind`);
          }
          await this.sleep(500); // Simulate
        }
        
        step.completed = true;
        step.endTime = Date.now();
        this.reportProgress(step);
        
      } catch (error) {
        step.error = (error as Error).message;
        step.endTime = Date.now();
        errors.push(`${step.name}: ${(error as Error).message}`);
        this.reportProgress(step);
        console.error(`[SleepingCycle] Step ${step.name} failed:`, error);
        
        // Continue with other steps (graceful degradation)
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const summary: SleepSummary = {
      sessionId: state.sessionId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration,
      truthsExtracted,
      chaptersInscribed,
      truthsIndexed,
      codexUpdates,
      keyInsights,
      steps,
      errors,
    };

    this.currentPhase = 'REAWAKENING';
    console.log(`[SleepingCycle] ✅ SLEEPING complete (${duration}ms)`);
    
    return summary;
  }

  /**
   * Execute PHASE 5: REAWAKENING
   * 
   * Clear Active Stream, load enriched context.
   * 
   * Requirements: 7.6, 16.5, 16.6
   */
  async executeReawakening(
    oldState: ActiveStreamState,
    sleepSummary: SleepSummary
  ): Promise<ActiveStreamState> {
    console.log('[SleepingCycle] PHASE 5: REAWAKENING');
    
    // Create fresh state
    const newState = createEmptyActiveStreamState(
      `${oldState.sessionId}-awakened`,
      oldState.agentId,
      oldState.userId
    );

    // Inject sleep summary into context
    newState.context.sleepSummary = sleepSummary;
    newState.context.previousSession = oldState.sessionId;

    // Load updated Agent Codex
    // TODO: Integrate with Codex loader
    await this.sleep(500);

    // Load enriched Hive Mind truths
    // TODO: Query Hive Mind with recent truths
    await this.sleep(500);

    // Add system message with sleep summary
    newState.messages.push({
      role: 'system',
      content: this.formatSleepSummaryMessage(sleepSummary),
      timestamp: new Date().toISOString(),
    });

    // Update capacity (should be ~20% with distilled wisdom)
    const updatedState = this.capacityMonitor.updateStateCapacity(newState);

    this.currentPhase = 'ACTIVE';
    console.log('[SleepingCycle] ✅ REAWAKENING complete');
    
    return updatedState;
  }

  /**
   * Check if should trigger sleeping cycle
   * 
   * Requirements: 7.4
   */
  shouldTriggerSleep(state: ActiveStreamState): boolean {
    return this.capacityMonitor.shouldSleep(state);
  }

  /**
   * Check if should show warning
   * 
   * Requirements: 7.4, 16.3
   */
  shouldShowWarning(state: ActiveStreamState): boolean {
    return this.capacityMonitor.shouldWarn(state);
  }

  /**
   * Get warning message
   * 
   * Requirements: 16.3
   */
  getWarningMessage(state: ActiveStreamState): string | null {
    return this.capacityMonitor.getWarningMessage(state);
  }

  /**
   * Format sleep summary as message
   */
  private formatSleepSummaryMessage(summary: SleepSummary): string {
    const lines = [
      '🌙 Memory Consolidation Complete',
      '',
      `Duration: ${(summary.duration / 1000).toFixed(1)}s`,
      '',
      'Summary:',
    ];

    summary.keyInsights.forEach((insight) => {
      lines.push(`• ${insight}`);
    });

    if (summary.errors.length > 0) {
      lines.push('');
      lines.push('⚠️ Some operations encountered errors but consolidation continued.');
    }

    return lines.join('\n');
  }

  /**
   * Report progress to callback
   */
  private reportProgress(step: SleepProgressStep): void {
    if (this.progressCallback) {
      this.progressCallback(step);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create sleeping cycle orchestrator
 */
export function createSleepingCycleOrchestrator(
  memoryService: MemoryService,
  capacityMonitor: CapacityMonitor,
  progressCallback?: (step: SleepProgressStep) => void
): SleepingCycleOrchestrator {
  return new SleepingCycleOrchestrator(
    memoryService,
    capacityMonitor,
    progressCallback
  );
}
