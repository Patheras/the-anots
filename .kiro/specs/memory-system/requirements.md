# Requirements Document: TCAM Memory System

## Introduction

The TCAM Memory System is the foundational infrastructure for TCAM v1.4 (Triadic Cognitive Augmentation Model). This is the FIRST implementation phase that must be completed before any other TCAM components can be built.

The Memory System implements a resilient 4-layer architecture where each layer operates independently, ensuring that system failures in one layer do not cascade to others. Memory operations are handled by a dedicated Memory Service running on a local LLM (Qwen 3.5 9B), completely separate from the main dialogue system.

**Design Philosophy:** Fault tolerance through independence. Each layer must survive independently—if one fails, the others continue operating.

**Whitepaper Reference:** Section 7 (Organic Memory System: Resilient 4-Layer Architecture)

---

## Glossary

- **Memory_System**: The complete 4-layer memory architecture (L1-L4) plus Memory Service
- **Memory_Service**: Dedicated process running on Qwen 3.5 9B for memory operations
- **Chronicle**: L1 layer - immutable historical record stored as markdown files
- **Active_Stream**: L2 layer - volatile working memory in Cloud LLM context window
- **Hive_Mind**: L3 layer - semantic memory using Qdrant vector database
- **Agent_Codex**: L4 layer - personal knowledge base for each cognitive node
- **Sleeping_Cycle**: Memory consolidation process triggered at 80% capacity threshold
- **Truth**: Semantic fact extracted from dialogue (subject-predicate-object triple)
- **Chapter**: Chronicle entry representing one dialogue session
- **Whisper**: Asynchronous inter-node message for sub-agent communication
- **Main_Dialogue**: Primary conversation between Chip, Ubik, and Axiom (Cloud LLM)
- **Qwen_3.5_9B**: Local LLM (9 billion parameters) used for Memory Service
- **GLM_5_Pro**: Cloud LLM used for main dialogue
- **Mem0**: Open-source framework for automatic fact extraction and memory management
- **Redis_Checkpointer**: Fast state persistence for LangGraph (~1ms latency)
- **Qdrant**: Vector database for semantic search
- **LangGraph**: Stateful multi-agent workflow orchestration framework
- **Graceful_Degradation**: System continues operating with reduced functionality when components fail

---

## Requirements

### Requirement 1: Layer Independence

**User Story:** As a system architect, I want each memory layer to operate independently, so that failures in one layer do not cascade to other layers or the main dialogue.

**Whitepaper Reference:** Section 7.0, Section 7.2

#### Acceptance Criteria

1. THE Memory_System SHALL implement four independent layers (L1, L2, L3, L4)
2. WHEN any single layer fails, THE Memory_System SHALL continue operating with the remaining layers
3. THE Main_Dialogue SHALL continue operating WHEN the Memory_Service is unavailable
4. WHEN L3 (Hive_Mind) is unavailable, THE Memory_System SHALL fall back to L1 (Chronicle) for search operations
5. THE Chronicle (L1) SHALL have zero external dependencies beyond the file system
6. THE Agent_Codex (L4) SHALL have zero external dependencies beyond the file system
7. FOR ALL layer failures, THE Memory_System SHALL log errors without throwing exceptions to Main_Dialogue

### Requirement 2: Memory Service Architecture

**User Story:** As a system architect, I want a dedicated Memory Service running on local infrastructure, so that memory operations do not block or interfere with the main dialogue.

**Whitepaper Reference:** Section 7.1

#### Acceptance Criteria

1. THE Memory_Service SHALL run as a separate process from Main_Dialogue
2. THE Memory_Service SHALL use Qwen_3.5_9B (local LLM) for all memory operations
3. THE Main_Dialogue SHALL communicate with Memory_Service via API (non-blocking)
4. WHEN Memory_Service crashes, THE Main_Dialogue SHALL continue without interruption
5. THE Memory_Service SHALL support graceful restart without affecting Main_Dialogue state
6. THE Memory_Service SHALL operate in four modes: ACTIVE, SLEEPING, IDLE, DEGRADED
7. WHEN Memory_Service is in DEGRADED mode, THE Main_Dialogue SHALL continue with reduced memory functionality

### Requirement 3: Chronicle (L1) - Immutable Historical Record

**User Story:** As a system operator, I want a complete, permanent record of all dialogues stored as human-readable files, so that I can audit, search, and recover from any data loss.

**Whitepaper Reference:** Section 7.2 (L1: The Chronicle)

#### Acceptance Criteria

1. THE Chronicle SHALL store all dialogue sessions as markdown files
2. THE Chronicle SHALL be append-only (never modified, never deleted)
3. THE Chronicle SHALL organize files by node and session type (chip/general, chip/ubik, chip/axiom)
4. WHEN disk space is full, THE Chronicle SHALL log error to stderr and skip write without crashing
5. THE Chronicle SHALL be human-readable without specialized tools
6. THE Chronicle SHALL be Git-versioned for rollback capability
7. THE Chronicle SHALL survive all other system failures (zero external dependencies)
8. FOR ALL Chronicle files, THE file format SHALL be valid markdown with YAML frontmatter

### Requirement 4: Active Stream (L2) - Volatile Working Memory

**User Story:** As a cognitive node, I want fast access to current dialogue context, so that I can maintain conversational coherence without loading the entire history.

**Whitepaper Reference:** Section 7.2 (L2: Active Stream)

#### Acceptance Criteria

1. THE Active_Stream SHALL store current dialogue in Cloud LLM context window (GLM_5_Pro)
2. THE Active_Stream SHALL use Redis_Checkpointer for state persistence with <2ms latency
3. WHEN Cloud LLM API fails, THE Active_Stream SHALL fall back to Qwen_3.5_9B (local)
4. THE Active_Stream SHALL trigger Sleeping_Cycle at 80% capacity threshold
5. WHEN Active_Stream is lost, THE Memory_System SHALL reconstruct from L1 + L3 + L4
6. THE Active_Stream SHALL persist state snapshots to Redis every N messages (configurable)
7. THE Active_Stream SHALL be ephemeral (can be cleared without data loss)

### Requirement 5: Hive Mind (L3) - Semantic Memory

**User Story:** As a cognitive node, I want semantic search across all historical knowledge, so that I can retrieve relevant context based on meaning rather than keywords.

**Whitepaper Reference:** Section 7.2 (L3: Hive Mind)

#### Acceptance Criteria

1. THE Hive_Mind SHALL use Qdrant vector database for semantic storage
2. THE Hive_Mind SHALL integrate Mem0 for automatic fact extraction
3. THE Hive_Mind SHALL support semantic search with <200ms query latency
4. WHEN Qdrant service is unavailable, THE Hive_Mind SHALL fall back to grep search on Chronicle
5. WHEN Hive_Mind index is corrupted, THE Memory_System SHALL rebuild from Chronicle (L1)
6. THE Hive_Mind SHALL store truths in collections: tcam_hive_truths, tcam_hive_wisdom, tcam_hive_patterns, tcam_hive_whispers, tcam_hive_tools
7. THE Hive_Mind SHALL support batch indexing during Sleeping_Cycle

### Requirement 6: Agent Codex (L4) - Personal Knowledge Base

**User Story:** As a cognitive node, I want a personal knowledge base that stores my identity, tasks, and learnings, so that I maintain continuity across sessions.

**Whitepaper Reference:** Section 7.2 (L4: Agent Codex)

#### Acceptance Criteria

1. THE Agent_Codex SHALL store node-specific knowledge as markdown files
2. THE Agent_Codex SHALL maintain separate directories for each node (ubik/, axiom/)
3. THE Agent_Codex SHALL include files: README.md (identity), TASKS.md, SYNTHETIC-DIARY.md, NOTES.md, CONTEXT.md, TOOLS.md
4. WHEN disk space is full, THE Agent_Codex SHALL cache updates in memory until disk is available
5. THE Agent_Codex SHALL be Git-versioned for rollback capability
6. THE Agent_Codex SHALL be human-readable and manually editable
7. WHEN Agent_Codex is lost, THE Memory_System SHALL reconstruct from Chronicle (L1)

### Requirement 7: Sleeping Cycle - Memory Consolidation

**User Story:** As a system operator, I want automatic memory consolidation when context capacity reaches 80%, so that the system maintains performance without manual intervention.

**Whitepaper Reference:** Section 7.2 (L2: Optimized Sleeping Cycle), Section 7.3

#### Acceptance Criteria

1. THE Memory_System SHALL trigger Sleeping_Cycle WHEN Active_Stream reaches 80% capacity
2. THE Sleeping_Cycle SHALL complete in <60 seconds
3. DURING Sleeping_Cycle, THE Main_Dialogue SHALL pause with user notification
4. THE Sleeping_Cycle SHALL perform: truth extraction, Chronicle inscription, Hive_Mind indexing, Agent_Codex updates
5. THE Sleeping_Cycle SHALL generate a sleep summary for user review
6. AFTER Sleeping_Cycle, THE Active_Stream SHALL reset to ~20% capacity with distilled context
7. THE Sleeping_Cycle SHALL use async operations to minimize consolidation time
8. WHEN Sleeping_Cycle fails, THE Memory_System SHALL log error and retry with exponential backoff (max 3 attempts)

### Requirement 8: Truth Extraction

**User Story:** As the Memory Service, I want to automatically extract semantic facts from dialogue, so that knowledge is captured without manual annotation.

**Whitepaper Reference:** Section 7.1 (Memory Service Implementation)

#### Acceptance Criteria

1. THE Memory_Service SHALL extract truths from Active_Stream using Mem0
2. THE Memory_Service SHALL structure truths as subject-predicate-object triples
3. THE Memory_Service SHALL assign confidence scores to each truth (0.0-1.0)
4. WHEN Mem0 extraction fails, THE Memory_Service SHALL fall back to basic LLM extraction
5. WHEN both extraction methods fail, THE Memory_Service SHALL return empty array (graceful degradation)
6. THE Memory_Service SHALL extract truths asynchronously during ACTIVE mode (70-80% capacity)
7. THE Memory_Service SHALL validate truth schema before storage

### Requirement 9: Chronicle Inscription

**User Story:** As the Memory Service, I want to format and persist dialogue sessions as Chronicle chapters, so that all conversations are permanently recorded.

**Whitepaper Reference:** Section 7.1, Section 7.2 (L1)

#### Acceptance Criteria

1. THE Memory_Service SHALL format sessions as markdown chapters using Qwen_3.5_9B
2. THE Memory_Service SHALL inscribe chapters via Axiom.Scribe sub-agent
3. THE Memory_Service SHALL include YAML frontmatter with metadata (date, participants, session_type, truths_count)
4. WHEN Chronicle inscription fails, THE Memory_Service SHALL log error without throwing exception
5. THE Memory_Service SHALL write chapters to appropriate directory (chip/general, chip/ubik, chip/axiom)
6. THE Memory_Service SHALL generate unique chapter IDs (YYYY-MM-DD-chapter-NNN.md)
7. THE Memory_Service SHALL never overwrite existing chapters (append-only)

### Requirement 10: Hive Mind Indexing

**User Story:** As the Memory Service, I want to index extracted truths to the vector database, so that semantic search is available for future queries.

**Whitepaper Reference:** Section 7.1, Section 7.2 (L3)

#### Acceptance Criteria

1. THE Memory_Service SHALL generate embeddings for truths using Qwen_3.5_9B
2. THE Memory_Service SHALL upsert embeddings to Qdrant collection (tcam_hive_truths)
3. WHEN Qdrant is unavailable, THE Memory_Service SHALL fall back to file-based storage (hive_backup.jsonl)
4. THE Memory_Service SHALL batch index truths during Sleeping_Cycle for efficiency
5. THE Memory_Service SHALL deduplicate truths before indexing (using Mem0)
6. THE Memory_Service SHALL maintain backup of all indexed truths in JSONL format
7. THE Memory_Service SHALL support rebuilding Qdrant index from Chronicle

### Requirement 11: Memory Search

**User Story:** As a cognitive node, I want to search historical memory using natural language queries, so that I can retrieve relevant context for current tasks.

**Whitepaper Reference:** Section 7.1 (Memory Service Implementation)

#### Acceptance Criteria

1. THE Memory_Service SHALL support semantic search via Mem0.search()
2. THE Memory_Service SHALL return top 20 most relevant truths for each query
3. THE Memory_Service SHALL include confidence scores with search results
4. WHEN Mem0 search fails, THE Memory_Service SHALL fall back to direct Qdrant search
5. WHEN Qdrant search fails, THE Memory_Service SHALL fall back to grep search on Chronicle
6. THE Memory_Service SHALL complete searches in <200ms (semantic) or <500ms (grep fallback)
7. THE Memory_Service SHALL return empty array WHEN all search methods fail (graceful degradation)

### Requirement 12: Graceful Degradation

**User Story:** As a system operator, I want the system to continue operating with reduced functionality when components fail, so that users experience minimal disruption.

**Whitepaper Reference:** Section 7.0, Section 7.1

#### Acceptance Criteria

1. WHEN Memory_Service is down, THE Main_Dialogue SHALL continue without memory operations
2. WHEN Qdrant is down, THE Memory_System SHALL use file-based search as fallback
3. WHEN disk is full, THE Memory_System SHALL log errors and skip writes without crashing
4. WHEN Cloud LLM API fails, THE Active_Stream SHALL fall back to local LLM (Qwen_3.5_9B)
5. WHEN truth extraction fails, THE Memory_Service SHALL return empty array and continue
6. FOR ALL component failures, THE Memory_System SHALL log detailed error information
7. THE Memory_System SHALL expose health check endpoint reporting status of all layers

### Requirement 13: Memory Service Health Monitoring

**User Story:** As a system operator, I want to monitor the health of all memory components, so that I can detect and respond to failures proactively.

**Whitepaper Reference:** Section 7.1 (Memory Service Implementation)

#### Acceptance Criteria

1. THE Memory_Service SHALL expose getHealth() method returning status of all components
2. THE Memory_Service SHALL report health status: healthy, degraded, or down
3. THE Memory_Service SHALL check connectivity to: Mem0, Qdrant, file system, Qwen_3.5_9B
4. THE Memory_Service SHALL update health status every 30 seconds
5. WHEN any component is unhealthy, THE Memory_Service SHALL log warning with details
6. THE Memory_Service SHALL expose health metrics via HTTP endpoint (/health)
7. THE Memory_Service SHALL include uptime, error counts, and last successful operation timestamps

### Requirement 14: Mem0 Integration

**User Story:** As a system architect, I want to leverage Mem0 for automatic fact extraction and multi-store memory management, so that I save implementation time and use battle-tested patterns.

**Whitepaper Reference:** Section 7.1, Section 7.2 (L3)

#### Acceptance Criteria

1. THE Memory_Service SHALL initialize Mem0Client with Qdrant vector store configuration
2. THE Memory_Service SHALL use Mem0 for automatic fact extraction from dialogue
3. THE Memory_Service SHALL use Mem0 for semantic search across memories
4. THE Memory_Service SHALL configure Mem0 with Qwen_3.5_9B as LLM provider
5. THE Memory_Service SHALL handle Mem0 connection failures with fallback to direct Qdrant access
6. THE Memory_Service SHALL use Mem0 deduplication for truth management
7. THE Memory_Service SHALL store Mem0 metadata (user_id: 'chip', session_type)

### Requirement 15: Redis Checkpointer Integration

**User Story:** As a system architect, I want fast state persistence for LangGraph using Redis, so that the system can recover quickly from failures.

**Whitepaper Reference:** Section 7.2 (L2: Active Stream)

#### Acceptance Criteria

1. THE Active_Stream SHALL use Redis_Checkpointer for LangGraph state persistence
2. THE Redis_Checkpointer SHALL persist state snapshots with <2ms latency
3. THE Redis_Checkpointer SHALL store checkpoints every N messages (configurable, default: 10)
4. WHEN Redis is unavailable, THE Active_Stream SHALL fall back to in-memory checkpointing
5. THE Redis_Checkpointer SHALL support state recovery after system restart
6. THE Redis_Checkpointer SHALL expire old checkpoints after 7 days (configurable)
7. THE Redis_Checkpointer SHALL compress checkpoints to minimize storage

### Requirement 16: Sleeping Cycle Phases

**User Story:** As a user, I want clear feedback during memory consolidation, so that I understand what the system is doing and how long it will take.

**Whitepaper Reference:** Section 7.2 (Optimized Sleeping Cycle)

#### Acceptance Criteria

1. THE Sleeping_Cycle SHALL implement five phases: AWAKENING, ACTIVE, PRE-SLEEP, SLEEPING, REAWAKENING
2. DURING PRE-SLEEP (70-80% capacity), THE Memory_System SHALL display soft warning to user
3. DURING SLEEPING (80%+ capacity), THE Memory_System SHALL display progress indicator
4. THE SLEEPING phase SHALL perform: truth extraction (~10s), Chronicle inscription (~15s), Hive_Mind indexing (~10s), Agent_Codex updates (~5s), sleep summary (~5s)
5. THE REAWAKENING phase SHALL load: updated Agent_Codex, enriched Hive_Mind truths, sleep summary
6. AFTER REAWAKENING, THE Active_Stream SHALL contain ~20% capacity with distilled context
7. THE Sleeping_Cycle SHALL log duration of each phase for performance monitoring

### Requirement 17: Background Optimization

**User Story:** As a system operator, I want optional background optimization during idle periods, so that memory quality improves without impacting active usage.

**Whitepaper Reference:** Section 7.2 (Optimized Sleeping Cycle - Background Optimization)

#### Acceptance Criteria

1. WHEN user is inactive for >10 minutes, THE Memory_Service MAY perform background optimization
2. THE background optimization SHALL include: deduplication, memory scoring, semantic clustering, pattern recognition
3. THE background optimization SHALL be non-critical (can be skipped if system is busy)
4. THE background optimization SHALL not block or slow down Main_Dialogue
5. THE background optimization SHALL log operations performed and time taken
6. THE background optimization SHALL be configurable (enabled/disabled, idle threshold)
7. THE background optimization SHALL pause immediately WHEN user activity resumes

### Requirement 18: Whitepaper Compliance Validation

**User Story:** As a system architect, I want to validate that the implementation matches the whitepaper specification, so that I ensure architectural integrity.

**Whitepaper Reference:** All of Section 7

#### Acceptance Criteria

1. THE Memory_System SHALL implement all architectural patterns described in Section 7.0
2. THE Memory_Service SHALL match the architecture described in Section 7.1
3. THE 4-layer architecture SHALL match the specifications in Section 7.2
4. THE Sleeping_Cycle SHALL match the workflow described in Section 7.2 and 7.3
5. THE failure modes SHALL match those specified in Section 7.0 and 7.2
6. THE technology stack SHALL use: Qwen 3.5 9B, Mem0, Redis, Qdrant, LangGraph as specified
7. THE implementation SHALL maintain the design philosophy of independence and resilience

### Requirement 19: Parser and Serializer for Chronicle Format

**User Story:** As a developer, I want to parse and serialize Chronicle markdown files, so that I can programmatically read and write dialogue history.

**Whitepaper Reference:** Section 7.2 (L1: The Chronicle)

#### Acceptance Criteria

1. THE Memory_System SHALL provide a Chronicle_Parser that parses markdown files into structured objects
2. THE Memory_System SHALL provide a Chronicle_Serializer that formats structured objects into markdown
3. WHEN a valid Chronicle file is provided, THE Chronicle_Parser SHALL extract YAML frontmatter and content
4. WHEN an invalid Chronicle file is provided, THE Chronicle_Parser SHALL return descriptive error
5. THE Chronicle_Serializer SHALL format sessions with YAML frontmatter and markdown content
6. FOR ALL valid Chronicle objects, parsing then serializing then parsing SHALL produce equivalent object (round-trip property)
7. THE Chronicle_Parser SHALL validate YAML schema (required fields: date, participants, session_type)

### Requirement 20: Truth Schema Validation

**User Story:** As a developer, I want to validate truth objects before storage, so that I ensure data quality and prevent schema violations.

**Whitepaper Reference:** Section 7.1 (Memory Service Implementation)

#### Acceptance Criteria

1. THE Memory_Service SHALL define Truth schema with fields: subject, predicate, object, timestamp, confidence, source
2. THE Memory_Service SHALL validate all truths before storage using schema validation
3. WHEN a truth violates schema, THE Memory_Service SHALL log error and skip that truth
4. THE confidence field SHALL be a float between 0.0 and 1.0 (inclusive)
5. THE timestamp field SHALL be a valid ISO 8601 datetime
6. THE source field SHALL be one of: mem0_extraction, llm_extraction, manual
7. THE Memory_Service SHALL reject truths with missing required fields

---

## Correctness Properties for Property-Based Testing

### Property 1: Layer Independence (Invariant)

**Property:** If any single layer (L1, L2, L3, or L4) fails, the remaining layers continue operating.

**Test Strategy:** 
- Simulate failure of each layer independently
- Verify that other layers remain operational
- Verify that Main_Dialogue continues (possibly with degraded functionality)

**Whitepaper Reference:** Section 7.0, Section 7.2

### Property 2: Memory Service Isolation (Invariant)

**Property:** Main_Dialogue never blocks on Memory_Service operations.

**Test Strategy:**
- Introduce artificial delays in Memory_Service operations
- Verify that Main_Dialogue response time is unaffected
- Verify that Memory_Service operations complete asynchronously

**Whitepaper Reference:** Section 7.0, Section 7.1

### Property 3: Sleeping Cycle Timing (Performance Bound)

**Property:** Sleeping_Cycle consolidation completes in <60 seconds.

**Test Strategy:**
- Measure actual consolidation time across multiple cycles
- Verify that 95th percentile is <60 seconds
- Test with various dialogue sizes (small, medium, large)

**Whitepaper Reference:** Section 7.2, Section 7.3

### Property 4: Chronicle Immutability (Invariant)

**Property:** Chronicle files are append-only and never modified after creation.

**Test Strategy:**
- Monitor file system operations on Chronicle directory
- Verify that no files are modified or deleted
- Verify that only append operations occur

**Whitepaper Reference:** Section 7.2 (L1)

### Property 5: Round-Trip Chronicle Serialization (Round-Trip Property)

**Property:** For all valid Chronicle objects, parse(serialize(obj)) == obj.

**Test Strategy:**
- Generate random valid Chronicle objects
- Serialize to markdown, then parse back
- Verify that parsed object equals original object

**Whitepaper Reference:** Section 7.2 (L1), Requirement 19

### Property 6: Graceful Degradation (Error Handling)

**Property:** System continues operating when components fail, with degraded functionality.

**Test Strategy:**
- Simulate failures: Qdrant down, disk full, Cloud LLM unavailable, Memory_Service crash
- Verify that Main_Dialogue continues in each case
- Verify that appropriate fallbacks are used

**Whitepaper Reference:** Section 7.0, Section 7.1, Section 7.2

### Property 7: Truth Extraction Consistency (Metamorphic Property)

**Property:** Extracting truths from dialogue D should produce a subset of truths when extracting from dialogue D + D' (where D' is additional dialogue).

**Test Strategy:**
- Extract truths from dialogue D
- Extract truths from dialogue D + D'
- Verify that truths from D are present in truths from D + D'

**Whitepaper Reference:** Section 7.1

### Property 8: Search Result Relevance (Metamorphic Property)

**Property:** Search results for query Q should be more relevant than search results for unrelated query Q'.

**Test Strategy:**
- Perform search with relevant query Q
- Perform search with unrelated query Q'
- Verify that confidence scores for Q are higher than Q'

**Whitepaper Reference:** Section 7.1, Section 7.2 (L3)

---

## Success Metrics

### Performance Metrics

| Metric | Target | Measurement Method | Whitepaper Reference |
|--------|--------|-------------------|---------------------|
| Memory retrieval latency | <200ms | Hive_Mind semantic search | Section 7.2 (L3) |
| Sleeping cycle duration | <60s | End-to-end consolidation time | Section 7.2, 7.3 |
| Redis checkpoint latency | <2ms | State persistence time | Section 7.2 (L2) |
| Truth extraction accuracy | >90% | Manual validation of extracted truths | Section 7.1 |
| System uptime (main dialogue) | >99% | Uptime monitoring over 30 days | Section 7.0 |

### Quality Metrics

| Metric | Target | Measurement Method | Whitepaper Reference |
|--------|--------|-------------------|---------------------|
| Truth consistency | >95% | Deduplication rate, conflict detection | Section 7.1 |
| Chronicle completeness | 100% | All sessions recorded | Section 7.2 (L1) |
| Graceful degradation success | 100% | System continues on component failure | Section 7.0 |
| Round-trip serialization | 100% | Parse-serialize-parse equivalence | Requirement 19 |

---

## Technology Stack

| Component | Technology | Purpose | Whitepaper Reference |
|-----------|------------|---------|---------------------|
| Memory Service LLM | Qwen 3.5 9B (Q4 quantization) | Truth extraction, Chronicle formatting | Section 7.1 |
| L1 Storage | File system (markdown) | Chronicle immutable record | Section 7.2 (L1) |
| L2 Persistence | Redis Checkpointer | Fast LangGraph state snapshots | Section 7.2 (L2) |
| L3 Vector DB | Qdrant | Semantic memory search | Section 7.2 (L3) |
| L3 Memory Framework | Mem0 | Automatic fact extraction | Section 7.1, 7.2 (L3) |
| L4 Storage | File system (markdown) | Agent personal knowledge | Section 7.2 (L4) |
| Orchestration | LangGraph | Multi-agent workflow | Section 7.2 (L2) |
| Main Dialogue LLM | GLM-5 Pro (Cloud) | High-entropy reasoning | Section 7.0 |

---

## Implementation Priority

### Phase 1 (Week 1-2): Core Infrastructure
- Implement 4 independent layers (L1-L4) with file-based storage
- Set up Qwen 3.5 9B local LLM
- Implement basic Memory Service process

### Phase 2 (Week 2-3): Memory Operations
- Implement truth extraction using Mem0
- Implement Chronicle inscription
- Implement Hive Mind indexing with Qdrant

### Phase 3 (Week 3-4): Sleeping Cycle
- Implement 80% capacity threshold detection
- Implement 5-phase sleeping cycle workflow
- Implement progress indicators and sleep summary

### Phase 4 (Week 4-5): Integration & Resilience
- Integrate Redis Checkpointer for L2
- Implement graceful degradation and fallbacks
- Implement health monitoring

### Phase 5 (Week 5-6): Optimization & Testing
- Implement background optimization (optional)
- Property-based testing for correctness properties
- Performance benchmarking and tuning

---

**Document Status:** ✅ COMPLETE  
**Created:** 2025-03-22  
**Spec ID:** 420612ea-211d-421c-8cfb-17263ee9ea9e  
**Workflow:** Requirements-First  
**Next Phase:** Design Document
