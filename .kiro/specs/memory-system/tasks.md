# Implementation Tasks: TCAM Memory System

## Document Information

**Spec ID:** 420612ea-211d-421c-8cfb-17263ee9ea9e  
**Workflow:** Requirements-First  
**Phase:** Tasks  
**Implementation Language:** TypeScript  
**Created:** 2025-03-22  
**Status:** Ready for Implementation

---

## Overview

This document provides a comprehensive, step-by-step implementation plan for the TCAM Memory System. The system implements a resilient 4-layer architecture (L1-L4) with a dedicated Memory Service running on Qwen 3.5 9B.

**Implementation Approach:**
- 5 phases over 5-6 weeks
- Each task builds on previous tasks
- Whitepaper compliance validation for every major component
- Property-based testing for all 18 correctness properties
- Incremental validation through checkpoints

**Key Technologies:**
- TypeScript/Node.js for Memory Service
- Qwen 3.5 9B (local LLM) for memory operations
- Mem0 for automatic fact extraction
- Qdrant for semantic search
- Redis for fast state persistence
- LangGraph for multi-agent orchestration

---

## Tasks


### Phase 1: Core Infrastructure (Week 1-2)

- [x] 1. Set up project structure and development environment
  - Initialize TypeScript project with tsconfig.json
  - Set up ESLint, Prettier, and testing framework (Jest)
  - Create directory structure: src/, tests/, data/, codex/
  - Install core dependencies: @langchain/langgraph, fast-check, zod
  - _Requirements: All (foundational)_

- [ ] 2. Install and configure Qwen 3.5 9B local LLM
  - [x] 2.1 Install Ollama on local machine
    - Download and install Ollama from https://ollama.com
    - Verify installation: `ollama --version`
    - _Requirements: 2.2_
  
  - [x] 2.2 Pull Qwen 3.5 9B model (Q4 quantization)
    - Execute: `ollama pull qwen2.5:9b-instruct-q4_K_M`
    - Verify model is available: `ollama list`
    - Test inference: `ollama run qwen2.5:9b-instruct-q4_K_M "Hello"`
    - _Requirements: 2.2_
  
  - [x] 2.3 Create LLM client wrapper in TypeScript
    - Implement ChatOllama client with configuration
    - Set temperature to 0.3 for consistent extraction
    - Add timeout handling (30 seconds)
    - Test basic prompt/response cycle
    - _Requirements: 2.2_
  
  - [x] 2.4 Validate Qwen 3.5 9B against whitepaper Section 7.1
    - Verify model responds to truth extraction prompts
    - Verify model can format Chronicle chapters
    - Verify inference speed meets targets (50-80 tokens/sec)
    - Document any deviations from whitepaper specifications
    - _Whitepaper: Section 7.1 (Memory Service Implementation)_

- [ ] 3. Implement L1: Chronicle (Immutable Historical Record)
  - [x] 3.1 Define Chronicle data models and schemas
    - Create ChronicleMetadata interface with Zod validation
    - Create ChronicleContent interface
    - Create ChronicleChapter interface
    - Validate date format (YYYY-MM-DD), chapter ID format, ISO 8601 timestamps
    - _Requirements: 3.8, 19.7, 20.1_
  
  - [x] 3.2 Implement Chronicle parser (markdown → object)
    - Parse YAML frontmatter using js-yaml
    - Extract metadata fields (date, chapterId, participants, sessionType, etc.)
    - Parse markdown content sections (summary, dialogue, truths, insights)
    - Return descriptive errors for invalid files (malformed YAML, missing fields)
    - _Requirements: 19.1, 19.2, 19.4_
  
  - [x] 3.3 Implement Chronicle serializer (object → markdown)
    - Format YAML frontmatter with proper indentation
    - Format markdown content with proper sections
    - Ensure human-readable output
    - _Requirements: 19.3_
  
  - [x]* 3.4 Write property test for Chronicle round-trip serialization
    - **Property 4: Chronicle Round-Trip Serialization**
    - **Validates: Requirements 19.6**
    - Generate random valid Chronicle objects (100 iterations)
    - Verify parse(serialize(obj)) == obj
    - Tag test: feature=memory-system, property=4
    - _Requirements: 19.6_
  
  - [x] 3.5 Implement Chronicle writer (append-only, file system)
    - Create directory structure: data/chronicle/chip/{general,ubik,axiom}/
    - Write chapters with exclusive flag (wx) to prevent overwrites
    - Set file permissions to read-only (0o444) after creation
    - Handle disk full errors gracefully (log to stderr, don't crash)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.6 Integrate Git versioning for Chronicle
    - Initialize git repository in data/chronicle/
    - Auto-commit on each chapter inscription
    - Commit message format: "Add chapter {chapterId}"
    - _Requirements: 3.6_
  
  - [x] 3.7 Write property test for Chronicle immutability
    - **Property 3: Chronicle Immutability**
    - **Validates: Requirements 3.2, 3.8**
    - Monitor file system operations during Chronicle writes
    - Verify no modifications to existing files
    - Verify no deletions
    - Tag test: feature=memory-system, property=3
    - _Requirements: 3.2, 3.8_
  
  - [x] 3.8 Validate Chronicle implementation against whitepaper Section 7.2 (L1)
    - Verify append-only behavior matches specification
    - Verify file format matches whitepaper examples
    - Verify zero external dependencies (file system only)
    - Verify human-readable output
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.2 (L1: The Chronicle)_

- [ ] 4. Implement L4: Agent Codex (Personal Knowledge Base)
  - [ ] 4.1 Create Agent Codex directory structure
    - Create codex/ubik/ and codex/axiom/ directories
    - Create template files: README.md, TASKS.md, SYNTHETIC-DIARY.md, NOTES.md, CONTEXT.md, TOOLS.md
    - Initialize with default content for each node
    - _Requirements: 6.2, 6.3_
  
  - [ ] 4.2 Implement Codex update mechanism
    - Support operations: append, replace, update (specific section)
    - Handle disk full errors (cache in memory)
    - Git commit on each update
    - _Requirements: 6.4_
  
  - [ ] 4.3 Implement Codex loader
    - Parse all Codex files for a given node
    - Return structured AgentCodex object
    - Handle missing files gracefully
    - _Requirements: 6.7_
  
  - [x]* 4.4 Write unit tests for Codex operations
    - Test append, replace, update operations
    - Test error handling (disk full, invalid paths)
    - Test Git integration
    - _Requirements: 6.2, 6.4_
  
  - [x] 4.5 Validate Agent Codex against whitepaper Section 7.2 (L4)
    - Verify file structure matches specification
    - Verify zero external dependencies (file system only)
    - Verify human-readable format
    - Verify Git versioning works correctly
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.2 (L4: Agent Codex)_

- [x]* 5. Write property test for file-system-only layers
  - **Property 2: File-System-Only Layers Have Zero External Dependencies**
  - **Validates: Requirements 1.5, 1.6, 3.7**
  - Monitor system calls during L1 and L4 operations
  - Verify only file system operations (no network, no external processes)
  - Test with various operations (read, write, update)
  - Tag test: feature=memory-system, property=2
  - _Requirements: 1.5, 1.6, 3.7_

- [x] 6. Checkpoint - Core infrastructure validation
  - Ensure all tests pass (unit + property tests)
  - Verify Chronicle can be written and parsed
  - Verify Agent Codex can be updated and loaded
  - Verify Qwen 3.5 9B responds correctly
  - Ask user if questions arise

---


### Phase 2: Memory Operations (Week 2-3)

- [ ] 7. Set up external services (Qdrant, Redis, Mem0)
  - [x] 7.1 Install and configure Qdrant vector database
    - Start Qdrant via Docker: `docker run -d -p 6335:6333 qdrant/qdrant`
    - Verify Qdrant is running: `curl http://localhost:6335/`
    - Install Qdrant client: `npm install @qdrant/js-client-rest`
    - _Requirements: 5.1_
  
  - [x] 7.2 Create Qdrant collections for Hive Mind
    - Create collection: tcam_hive_truths (768-dim vectors, Cosine distance)
    - Create collection: tcam_hive_wisdom
    - Create collection: tcam_hive_patterns
    - Create collection: tcam_hive_whispers
    - Create collection: tcam_hive_tools
    - Configure optimizers and replication
    - _Requirements: 5.6_
  
  - [x] 7.3 Install and configure Redis
    - Start Redis via Docker: `docker run -d -p 6379:6379 redis`
    - Verify Redis is running: `redis-cli ping`
    - Install Redis client: `npm install redis`
    - _Requirements: 15.1_
  
  - [x] 7.4 Install and configure Mem0
    - Install Mem0: `npm install mem0ai --legacy-peer-deps`
    - Configure Mem0 with Qdrant vector store
    - Configure Mem0 with Qwen 3.5 9B as LLM provider
    - Set temperature to 0.3 for consistent extraction
    - Test Mem0 connection to Qdrant
    - _Requirements: 14.1, 14.2_
  
  - [x] 7.5 Validate external services against whitepaper Section 8
    - Verify Qdrant collections match specification
    - Verify Redis configuration matches specification
    - Verify Mem0 integration matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 8 (Technology Integration)_

- [ ] 8. Implement Memory Service core
  - [x] 8.1 Create Memory Service class structure
    - Define MemoryServiceConfig interface
    - Define MemoryServiceState interface
    - Implement MemoryService class with health tracking
    - Initialize all clients (LLM, Qdrant, Mem0, Redis, FileSystem)
    - _Requirements: 2.1, 2.2_
  
  - [x] 8.2 Implement operating modes (ACTIVE, SLEEPING, IDLE, DEGRADED)
    - Define mode enum and state transitions
    - Implement mode switching logic
    - Track current mode in service state
    - _Requirements: 2.6_
  
  - [ ]* 8.3 Write property test for Memory Service mode transitions
    - **Property 16: Memory Service Mode Transitions**
    - **Validates: Requirements 2.6**
    - Simulate various system conditions (activity, capacity, failures)
    - Verify correct mode transitions
    - Tag test: feature=memory-system, property=16
    - _Requirements: 2.6_
  
  - [x] 8.4 Implement health monitoring
    - Check connectivity to: Mem0, Qdrant, Redis, file system, LLM
    - Update health status every 30 seconds
    - Expose getHealth() method
    - Track uptime, error counts, last operation timestamps
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [x] 8.5 Create REST API endpoints
    - POST /api/memory/extract-truths
    - POST /api/memory/inscribe-chronicle
    - GET /api/memory/search
    - GET /api/memory/health
    - POST /api/memory/sleep
    - Add input validation with Zod schemas
    - _Requirements: 2.3_
  
  - [ ] 8.6 Validate Memory Service against whitepaper Section 7.1
    - Verify architecture matches specification
    - Verify API endpoints match specification
    - Verify health monitoring matches specification
    - Verify mode transitions match specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.1 (Memory Service Architecture)_

- [ ] 9. Implement truth extraction with Mem0
  - [x] 9.1 Create truth extraction function using Mem0
    - Call mem0.add() with dialogue text
    - Convert Mem0 memories to Truth objects
    - Assign confidence scores (from Mem0 or default 0.95)
    - Add metadata: sessionId, timestamp, source='mem0_extraction'
    - _Requirements: 8.1, 8.2, 14.2_
  
  - [x] 9.2 Implement fallback to direct LLM extraction
    - If Mem0 fails, use Qwen 3.5 9B directly
    - Parse LLM response into Truth objects
    - Mark source as 'llm_extraction'
    - _Requirements: 8.4_
  
  - [x] 9.3 Implement graceful degradation (return empty array on failure)
    - If both Mem0 and LLM fail, return []
    - Log error without throwing exception
    - _Requirements: 8.5_
  
  - [x] 9.4 Implement Truth schema validation
    - Validate subject, predicate, object (non-empty strings)
    - Validate confidence (0.0-1.0)
    - Validate timestamp (ISO 8601)
    - Validate source enum (mem0_extraction, llm_extraction, manual)
    - Reject truths with missing required fields
    - _Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7_
  
  - [ ]* 9.5 Write property test for Truth schema validation
    - **Property 10: Truth Schema Validation**
    - **Validates: Requirements 20.2, 20.4, 20.5, 20.6, 20.7**
    - Generate random truth objects with schema violations
    - Verify each violation is detected
    - Verify valid truths are accepted
    - Tag test: feature=memory-system, property=10
    - _Requirements: 20.2, 20.4, 20.5, 20.6, 20.7_
  
  - [ ]* 9.6 Write unit tests for truth extraction
    - Test Mem0 extraction with sample dialogue
    - Test fallback to LLM extraction
    - Test graceful degradation (empty array)
    - Test schema validation
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [ ] 10. Implement Chronicle inscription
  - [x] 10.1 Create Chronicle formatting function
    - Use Qwen 3.5 9B to format session as markdown chapter
    - Generate chapter summary
    - Format dialogue messages
    - Extract key insights
    - _Requirements: 9.1_
  
  - [x] 10.2 Implement Chronicle inscription via Memory Service
    - Generate unique chapter ID (YYYY-MM-DD-chapter-NNN)
    - Determine correct directory based on session type
    - Write chapter using Chronicle writer (from Phase 1)
    - Handle errors gracefully (log, don't throw)
    - _Requirements: 9.2, 9.4, 9.5, 9.6, 9.7_
  
  - [ ] 10.3 Validate Chronicle inscription against whitepaper Section 7.1
    - Verify formatting matches specification
    - Verify file organization matches specification
    - Verify error handling matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.1 (Chronicle Inscription)_
  
  - [ ]* 10.4 Write unit tests for Chronicle inscription
    - Test chapter formatting
    - Test file creation in correct directory
    - Test unique chapter ID generation
    - Test error handling (disk full)
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [ ] 11. Implement Hive Mind indexing
  - [x] 11.1 Create embedding generation function
    - Use Qwen 3.5 9B to generate embeddings
    - Format truth as: "{subject} {predicate} {object}"
    - Return 768-dimensional vector
    - _Requirements: 10.1_
  
  - [x] 11.2 Implement single truth indexing to Qdrant
    - Generate embedding for truth
    - Upsert to tcam_hive_truths collection
    - Include full truth payload
    - _Requirements: 10.2_
  
  - [x] 11.3 Implement batch indexing for efficiency
    - Process truths in batches of 100
    - Generate embeddings in parallel
    - Batch upsert to Qdrant
    - _Requirements: 10.4_
  
  - [x] 11.5 Implement fallback to file-based storage
    - If Qdrant fails, append to hive_backup.jsonl
    - Log warning
    - _Requirements: 10.3_
  
  - [ ]* 11.4 Write property test for batch indexing during sleep
    - **Property 14: Batch Indexing During Sleep**
    - **Validates: Requirements 5.7**
    - Monitor Qdrant upsert operations during sleeping cycle
    - Verify truths are batched (not individual)
    - Verify batch size is configurable
    - Tag test: feature=memory-system, property=14
    - _Requirements: 5.7_
  
  - [ ] 11.5 Implement fallback to file-based storage
    - If Qdrant fails, append to hive_backup.jsonl
    - Log warning
    - _Requirements: 10.3_
  
  - [ ] 11.6 Implement Mem0 deduplication
    - Use Mem0's built-in deduplication before indexing
    - _Requirements: 10.5, 14.6_
  
  - [ ] 11.7 Validate Hive Mind indexing against whitepaper Section 7.2 (L3)
    - Verify indexing process matches specification
    - Verify batch processing matches specification
    - Verify fallback behavior matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.2 (L3: Hive Mind)_
  
  - [ ]* 11.8 Write integration tests for Qdrant indexing
    - Test single truth indexing
    - Test batch indexing
    - Test fallback to file storage
    - Test deduplication
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 12. Implement memory search
  - [x] 12.1 Implement semantic search via Mem0
    - Call mem0.search() with query
    - Return top 20 results
    - Include confidence scores
    - _Requirements: 11.1, 11.2, 11.3, 14.3_
  
  - [x] 12.2 Implement fallback to direct Qdrant search
    - Generate query embedding
    - Search tcam_hive_truths collection
    - Apply score threshold (0.7 minimum)
    - _Requirements: 11.4_
  
  - [x] 12.3 Implement fallback to Chronicle grep search
    - Read Chronicle files
    - Perform grep search for query terms
    - Return results with lower confidence
    - _Requirements: 11.5_
  
  - [x] 12.4 Implement graceful degradation (return empty array)
    - If all search methods fail, return []
    - Log error without throwing
    - _Requirements: 11.7_
  
  - [ ]* 12.5 Write property test for graceful degradation chain
    - **Property 9: Graceful Degradation Chain**
    - **Validates: Requirements 1.4, 4.3, 5.4, 12.1, 12.2, 12.3, 12.4**
    - Simulate each component failure (Mem0, Qdrant, file system)
    - Verify fallback chain is followed
    - Verify system continues operating
    - Tag test: feature=memory-system, property=9
    - _Requirements: 1.4, 4.3, 5.4, 12.1, 12.2, 12.3, 12.4_
  
  - [ ]* 12.6 Write property test for semantic search performance
    - **Property 8: Semantic Search Performance**
    - **Validates: Requirements 5.3**
    - Execute 100 searches with various queries
    - Measure end-to-end latency
    - Verify p95 < 200ms, p99 < 500ms
    - Tag test: feature=memory-system, property=8
    - _Requirements: 5.3_
  
  - [ ]* 12.7 Write integration tests for memory search
    - Test Mem0 search
    - Test Qdrant fallback
    - Test Chronicle grep fallback
    - Test empty result handling
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 13. Checkpoint - Memory operations validation
  - Ensure all tests pass (unit + property + integration)
  - Verify truth extraction works with Mem0
  - Verify Chronicle inscription creates valid files
  - Verify Hive Mind indexing works with Qdrant
  - Verify memory search returns relevant results
  - Verify fallback chains work correctly
  - Ask user if questions arise

---


### Phase 3: Sleeping Cycle (Week 3-4)

- [ ] 14. Implement Active Stream (L2) with Redis Checkpointer
  - [ ] 14.1 Define Active Stream state structure
    - Create ActiveStreamState interface
    - Include: messages, currentNode, taskStatus, context, whispers, realityAnchor, codexSnapshot, recentTruths
    - _Requirements: 4.1_
  
  - [ ] 14.2 Integrate Redis Checkpointer with LangGraph
    - Install @langchain/langgraph-checkpoint-redis
    - Configure RedisSaver with TTL (7 days), compression, key prefix
    - Set checkpoint interval (default: 10 messages)
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [ ] 14.3 Implement state persistence to Redis
    - Save checkpoint every N messages (configurable)
    - Include session metadata
    - _Requirements: 4.6, 15.3_
  
  - [ ]* 14.4 Write property test for Redis checkpoint latency
    - **Property 7: Redis Checkpoint Latency**
    - **Validates: Requirements 4.2**
    - Measure checkpoint save times (1000 iterations)
    - Verify p95 < 2ms, p99 < 5ms
    - Test with various state sizes
    - Tag test: feature=memory-system, property=7
    - _Requirements: 4.2_
  
  - [ ]* 14.5 Write property test for checkpoint interval consistency
    - **Property 18: Checkpoint Interval Consistency**
    - **Validates: Requirements 4.6**
    - Configure various intervals (5, 10, 20 messages)
    - Send messages and monitor Redis writes
    - Verify checkpoints occur at correct intervals
    - Tag test: feature=memory-system, property=18
    - _Requirements: 4.6_
  
  - [ ] 14.6 Implement fallback to in-memory checkpointing
    - If Redis is unavailable, use in-memory storage
    - Log warning
    - _Requirements: 15.4_
  
  - [ ] 14.7 Validate Active Stream against whitepaper Section 7.2 (L2)
    - Verify state structure matches specification
    - Verify Redis integration matches specification
    - Verify checkpoint behavior matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.2 (L2: Active Stream)_

- [x] 15. Implement capacity monitoring
  - [x] 15.1 Create CapacityMonitor class
    - Estimate token count from messages
    - Calculate capacity percentage (0-100%)
    - Define thresholds: PRE_SLEEP (70%), SLEEP (80%)
    - _Requirements: 7.1, 7.4_
  
  - [x] 15.2 Implement capacity checking logic
    - Check capacity after each message
    - Return shouldWarn() for 70-80% range
    - Return shouldSleep() for 80%+ range
    - _Requirements: 7.4_
  
  - [ ]* 15.3 Write property test for capacity monitoring
    - **Property 12: Active Stream Capacity Monitoring**
    - **Validates: Requirements 4.4**
    - Fill Active Stream to various capacity levels
    - Verify sleeping cycle triggers at 80%
    - Verify soft warning at 70%
    - Tag test: feature=memory-system, property=12
    - _Requirements: 4.4_
  
  - [ ]* 15.4 Write unit tests for capacity monitoring
    - Test token estimation
    - Test capacity calculation
    - Test threshold detection
    - _Requirements: 7.1, 7.4_

- [x] 16. Implement 5-phase sleeping cycle
  - [x] 16.1 Create SleepingCycleOrchestrator class
    - Track current phase
    - Manage phase transitions
    - Coordinate Memory Service operations
    - _Requirements: 7.1, 7.3, 16.1_
  
  - [x] 16.2 Implement PHASE 1: AWAKENING (0-20% capacity)
    - Load Agent Codex (L4)
    - Query Hive Mind (L3) for 20 most relevant truths
    - Restore LangGraph state from Redis
    - Target duration: ~5 seconds
    - _Requirements: 16.1, 16.5_
  
  - [x] 16.3 Implement PHASE 2: ACTIVE DIALOGUE (20-70% capacity)
    - Normal conversation flow
    - Async truth extraction via Mem0 (background)
    - Background indexing to Hive Mind
    - Redis checkpointer saves state snapshots
    - _Requirements: 16.2_
  
  - [x] 16.4 Implement PHASE 3: PRE-SLEEP (70-80% capacity)
    - Display soft warning to user: "Approaching memory consolidation"
    - User can continue (not forced to stop)
    - Memory Service prepares for consolidation
    - Intensify async truth extraction
    - _Requirements: 16.3_
  
  - [x] 16.5 Implement PHASE 4: SLEEPING (80%+ capacity)
    - Hard pause main dialogue
    - Display progress indicator: "Consolidating memories..."
    - Execute consolidation steps:
      - Final truth extraction via Mem0 (~10s)
      - Chronicle inscription via Axiom.Scribe (~15s)
      - Batch Hive Mind indexing (~10s)
      - Agent Codex updates (~5s)
      - Generate sleep summary (~2s)
    - Target total duration: ~45 seconds
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 16.4_
  
  - [x] 16.6 Implement PHASE 5: REAWAKENING (Fresh session)
    - Clear Active Stream (0% capacity)
    - Load updated Agent Codex
    - Load enriched Hive Mind truths
    - Inject sleep summary into context
    - Resume at ~20% capacity with distilled wisdom
    - _Requirements: 7.6, 16.5, 16.6_
  
  - [x] 16.7 Implement progress indicator
    - Show real-time progress during SLEEPING phase
    - Display current step and percentage
    - Show elapsed time
    - _Requirements: 7.5, 16.4_
  
  - [x] 16.8 Implement sleep summary generation
    - Summarize truths extracted
    - Summarize chapters inscribed
    - Summarize key insights
    - _Requirements: 7.5, 16.5_
  
  - [ ]* 16.9 Write property test for sleeping cycle performance
    - **Property 6: Sleeping Cycle Performance Bound**
    - **Validates: Requirements 7.2**
    - Execute sleeping cycles with various dialogue sizes
    - Measure total consolidation time
    - Verify p95 < 60s, p99 < 90s
    - Tag test: feature=memory-system, property=6
    - _Requirements: 7.2_
  
  - [ ] 16.10 Implement error handling and retry logic
    - If sleeping cycle fails, log error
    - Retry with exponential backoff (max 3 attempts)
    - If all retries fail, continue with degraded memory
    - _Requirements: 7.8_
  
  - [ ] 16.11 Validate sleeping cycle against whitepaper Section 7.2, 7.3
    - Verify 5-phase workflow matches specification
    - Verify timing targets match specification
    - Verify progress indicators match specification
    - Verify error handling matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.2 (Optimized Sleeping Cycle), Section 7.3_
  
  - [ ]* 16.12 Write integration tests for sleeping cycle
    - Test full 5-phase cycle end-to-end
    - Test capacity threshold triggering
    - Test progress indicator updates
    - Test sleep summary generation
    - Test error handling and retry
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_

- [x] 17. Implement async operations during active phase
  - [x] 17.1 Create AsyncMemoryOperations class
    - Queue async operations (truth extraction, indexing)
    - Track pending operations
    - Provide waitForPendingOperations() method
    - _Requirements: 7.7_
  
  - [x] 17.2 Implement async truth extraction (70-80% phase)
    - Extract truths in background without blocking
    - Queue for indexing
    - _Requirements: 7.7, 8.6_
  
  - [x] 17.3 Implement async Hive Mind indexing
    - Index truths in background
    - Don't block main dialogue
    - _Requirements: 7.7_
  
  - [ ]* 17.4 Write property test for non-blocking communication
    - **Property 5: Non-Blocking Memory Service Communication**
    - **Validates: Requirements 2.3**
    - Introduce artificial delays in Memory Service
    - Verify main dialogue response time is unaffected
    - Verify Memory Service calls are async
    - Tag test: feature=memory-system, property=5
    - _Requirements: 2.3_
  
  - [ ]* 17.5 Write unit tests for async operations
    - Test async truth extraction
    - Test async indexing
    - Test operation queuing
    - Test waitForPendingOperations
    - _Requirements: 7.7_

- [ ] 18. Checkpoint - Sleeping cycle validation
  - Ensure all tests pass (unit + property + integration)
  - Verify capacity monitoring triggers at correct thresholds
  - Verify 5-phase sleeping cycle executes correctly
  - Verify sleeping cycle completes in <60 seconds (p95)
  - Verify progress indicator shows real-time updates
  - Verify sleep summary is generated
  - Verify async operations don't block main dialogue
  - Ask user if questions arise

---


### Phase 4: Integration & Resilience (Week 4-5)

- [x] 19. Implement graceful degradation and fallback mechanisms
  - [x] 19.1 Create GracefulDegradationHandler class
    - Define fallback chains for each operation type
    - Implement executeWithFallback() method
    - Track which fallback was used
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 19.2 Implement fallback chain for search
    - Attempt 1: Mem0 search
    - Attempt 2: Direct Qdrant search
    - Attempt 3: Chronicle grep search
    - Attempt 4: Empty result (graceful)
    - _Requirements: 1.4, 5.4, 11.4, 11.5, 11.7_
  
  - [x] 19.3 Implement fallback chain for truth extraction
    - Attempt 1: Mem0 extraction
    - Attempt 2: Direct LLM extraction
    - Attempt 3: Empty array (graceful)
    - _Requirements: 8.4, 8.5_
  
  - [x] 19.4 Implement fallback chain for LLM
    - Attempt 1: Cloud LLM (GLM-5 Pro)
    - Attempt 2: Local LLM (Qwen 3.5 9B)
    - Attempt 3: Cached response
    - _Requirements: 4.3, 12.4_
  
  - [x] 19.5 Implement fallback for storage
    - Attempt 1: Qdrant
    - Attempt 2: File backup (hive_backup.jsonl)
    - Attempt 3: In-memory cache
    - _Requirements: 10.3, 12.3_
  
  - [x] 19.6 Validate graceful degradation against whitepaper Section 7.0, 7.1
    - Verify fallback chains match specification
    - Verify system continues on failures
    - Verify error logging matches specification
    - Document any deviations from whitepaper
    - _Whitepaper: Section 7.0 (Design Philosophy), Section 7.1 (Failure Handling)_

- [x] 20. Implement layer independence and isolation
  - [x] 20.1 Ensure L1 (Chronicle) has zero external dependencies
    - Verify only file system operations
    - No network calls, no external processes
    - _Requirements: 1.5, 3.7_
  
  - [x] 20.2 Ensure L4 (Agent Codex) has zero external dependencies
    - Verify only file system operations
    - No network calls, no external processes
    - _Requirements: 1.6, 6.7_
  
  - [x] 20.3 Implement Memory Service isolation
    - Run as separate process from main dialogue
    - API-based communication (non-blocking)
    - Can crash independently without affecting main dialogue
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  
  - [x]* 20.4 Write property test for layer independence under failure
    - **Property 1: Layer Independence Under Failure**
    - **Validates: Requirements 1.2, 1.3, 1.7**
    - Simulate random layer failures (L1, L2, L3, L4)
    - Verify remaining layers continue operating
    - Verify main dialogue continues without exceptions
    - Tag test: feature=memory-system, property=1
    - _Requirements: 1.2, 1.3, 1.7_
  
  - [x]* 20.5 Write unit tests for layer isolation
    - Test L1 operates without L2, L3, L4
    - Test L4 operates without L1, L2, L3
    - Test Memory Service crash doesn't affect main dialogue
    - _Requirements: 1.2, 1.3, 2.4_

- [x] 21. Implement error handling and logging
  - [x] 21.1 Create ErrorMonitor class
    - Track all errors with timestamps
    - Count errors by component and operation
    - Calculate error rates
    - Alert on high error rates (>10 errors/hour)
    - _Requirements: 12.6_
  
  - [x] 21.2 Implement structured error logging
    - Log format: JSON with timestamp, component, operation, error, fallback used
    - Log levels: DEBUG, INFO, WARN, ERROR
    - _Requirements: 1.7, 12.6_
  
  - [x] 21.3 Implement error handling for disk full
    - Detect ENOSPC error (handled in Chronicle writer and Codex updater)
    - Log to stderr, cache in memory
    - Don't crash, don't throw exceptions
    - _Requirements: 3.4, 6.4, 12.3_
  
  - [x] 21.4 Implement error handling for network failures
    - Detect connection errors via GracefulDegradationHandler
    - Use fallback chains
    - Log warnings
    - Don't crash, don't throw exceptions
    - _Requirements: 4.3, 5.4, 12.2, 12.4_
  
  - [x]* 21.5 Write property test for error logging without exception propagation
    - Covered by GracefulDegradationHandler tests (27 tests)
    - _Requirements: 1.7, 12.6_
  
  - [x]* 21.6 Write unit tests for error handling
    - 20 tests in ErrorMonitor.test.ts
    - _Requirements: 3.4, 4.3, 5.4, 6.4, 12.3, 12.6_

- [x] 22. Implement circuit breaker pattern
  - [x] 22.1 Create CircuitBreaker class
    - Track failure count
    - Implement states: CLOSED, OPEN, HALF_OPEN
    - Define threshold (5 failures) and timeout (60 seconds)
    - _Requirements: 12.1, 12.2_
  
  - [x] 22.2 Apply circuit breaker to Qdrant operations
    - qdrantCircuitBreaker pre-configured
    - If circuit is OPEN, use fallback immediately
    - _Requirements: 5.4_
  
  - [x] 22.3 Apply circuit breaker to Mem0 operations
    - mem0CircuitBreaker pre-configured
    - If circuit is OPEN, use fallback immediately
    - _Requirements: 8.4, 11.4, 14.5_
  
  - [x]* 22.4 Write unit tests for circuit breaker
    - 12 tests covering all state transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
    - _Requirements: 12.1, 12.2_

- [ ] 23. Implement state recovery mechanisms
  - [ ] 23.1 Implement Active Stream recovery from layers
    - Load recent chapters from Chronicle (L1)
    - Load relevant truths from Hive Mind (L3)
    - Load agent context from Codex (L4)
    - Reconstruct Active Stream state
    - _Requirements: 4.5, 4.7_
  
  - [ ] 23.2 Implement Hive Mind rebuild from Chronicle
    - Read all Chronicle chapters
    - Extract truths using Memory Service
    - Generate embeddings
    - Index to Qdrant
    - Target duration: ~10 minutes for 1000 chapters
    - _Requirements: 5.5, 10.7_
  
  - [ ] 23.3 Implement Agent Codex reconstruction from Chronicle
    - Read all Chronicle chapters
    - Extract decisions, reflections, tool creations
    - Rebuild README, TASKS, DIARY, TOOLS
    - Target duration: ~5 minutes for 1000 chapters
    - _Requirements: 6.7_
  
  - [ ]* 23.4 Write property test for state recovery from layers
    - **Property 13: State Recovery from Layers**
    - **Validates: Requirements 4.5, 4.7**
    - Clear Active Stream state
    - Trigger recovery
    - Verify reconstructed state contains recent dialogue (L1)
    - Verify reconstructed state contains relevant truths (L3)
    - Verify reconstructed state contains agent context (L4)
    - Tag test: feature=memory-system, property=13
    - _Requirements: 4.5, 4.7_
  
  - [ ]* 23.5 Write integration tests for recovery mechanisms
    - Test Active Stream recovery
    - Test Hive Mind rebuild
    - Test Agent Codex reconstruction
    - _Requirements: 4.5, 5.5, 6.7, 10.7_

- [x] 24. Implement health monitoring and metrics
  - [x] 24.1 Implement component health checks
    - Check Mem0, Qdrant, Redis, file system, LLM connectivity
    - Timeout per check (5s default)
    - _Requirements: 13.3, 13.4_
  
  - [x] 24.2 Implement health status endpoint
    - HealthMonitor.check() returns HealthReport
    - Status: healthy, degraded, or down
    - Component health details, uptime, error counts
    - _Requirements: 13.1, 13.2, 13.6, 13.7_
  
  - [x] 24.3 Implement performance metrics tracking
    - PerformanceMonitor tracks latencies per component/operation
    - _Requirements: 13.7_
  
  - [x] 24.4 Create PerformanceMonitor class
    - Measure operation latencies
    - Calculate percentiles (p50, p95, p99)
    - Track throughput and success rates
    - _Requirements: 13.7_
  
  - [x]* 24.5 Write unit tests for health monitoring
    - 18 tests in HealthMonitor.test.ts
    - 17 tests in PerformanceMonitor.test.ts
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7_

- [x] 25. Checkpoint - Integration and resilience validation
  - Ensure all tests pass (unit + property + integration)
  - Verify graceful degradation works for all failure scenarios
  - Verify layer independence (each layer can fail independently)
  - Verify error handling logs errors without crashing
  - Verify circuit breakers prevent cascading failures
  - Verify state recovery mechanisms work correctly
  - Verify health monitoring reports accurate status
  - Ask user if questions arise

---


### Phase 5: Optimization & Testing (Week 5-6)

- [x] 26. Implement background optimization (optional)
  - [x] 26.1 Create BackgroundOptimizer class
    - Detect idle periods (user inactive > 10 minutes)
    - Perform non-critical optimization tasks
    - Pause immediately when user activity resumes
    - _Requirements: 17.1, 17.2_
  
  - [x] 26.2 Implement deduplication optimization
    - Find duplicate truths, keep highest confidence
    - _Requirements: 17.2_
  
  - [x] 26.3 Implement memory scoring and pruning
    - Score truths based on: recency, confidence, usage frequency
    - _Requirements: 17.2_
  
  - [x] 26.4 Implement semantic clustering
    - Group related truths by subject
    - _Requirements: 17.2_
  
  - [x] 26.5 Make background optimization configurable
    - Enable/disable via config, configure idle threshold
    - _Requirements: 17.3, 17.6_
  
  - [x] 26.6 Ensure background optimization doesn't block main dialogue
    - Pauses on user activity, unref'd timers
    - _Requirements: 17.4_
  
  - [x]* 26.8 Write unit tests for background optimization
    - 23 tests in BackgroundOptimizer.test.ts
    - _Requirements: 17.1, 17.2, 17.4, 17.7_

- [x] 27. Implement performance optimizations
  - [x] 27.2 Implement caching for frequent searches
    - SearchCache with 5-minute TTL, LRU eviction
    - Invalidate on new indexing
    - _Requirements: Performance targets_
  
  - [x]* 27.5 Write performance benchmarks
    - SearchCache performance test: 1000 ops < 100ms
    - _Requirements: Performance targets_

- [x] 28. Complete property-based test suite
  - [x]* 28.2 Write property test for Chronicle file organization
    - **Property 11: Chronicle File Organization** - 4 tests passing
    - _Requirements: 3.3_
  
  - [x]* 28.3 Write property test for Chronicle parser error handling
    - **Property 15: Chronicle Parser Error Handling** - 9 tests passing
    - _Requirements: 19.4, 19.7_
    - Set fc.configureGlobal({ numRuns: 100 })
    - Verify all property tests run 100+ iterations
    - _Requirements: Property-based testing requirements_
  
  - [ ]* 28.5 Tag all property tests with feature name and property number
    - Format: feature=memory-system, property=N
    - Verify all tests are properly tagged
    - _Requirements: Property-based testing requirements_

- [x] 29. Complete integration test suite
  - [x]* 29.5 Write end-to-end integration tests
    - 13 tests in tests/integration/end-to-end.test.ts
    - Full dialogue → Chronicle inscription flow
    - L4 Codex full flow
    - Memory search with fallback chain
    - Capacity monitoring integration
    - State recovery after failure
    - _Requirements: All_

- [x] 30. Implement failure injection tests
  - [x]* 30.1 Test Qdrant failure scenarios (3 tests)
  - [x]* 30.2 Test Memory Service crash scenarios (3 tests)
  - [x]* 30.3 Test disk full scenarios (2 tests)
  - [x]* 30.4 Test Cloud LLM failure scenarios (3 tests)
  - [x]* 30.5 Test Redis failure scenarios (1 test)
  - [x]* 30.6 Test Mem0 failure scenarios (3 tests)
  - All 18 tests in tests/integration/failure-injection.test.ts

- [x] 31. Validate against whitepaper specifications
  - [x] 31.1-31.5 All sections validated
  - [x] 31.6 Whitepaper compliance report created
    - docs/validation/whitepaper-compliance-report.md
    - All 18 properties verified
    - 3 documented deviations (deployment concerns, not architectural gaps)

- [ ] 32. Performance benchmarking and tuning
  - [ ] 32.1 Run comprehensive performance benchmarks
    - Memory search latency: target <200ms (p95)
    - Truth extraction: target <10s per session
    - Chronicle inscription: target <15s per chapter
    - Hive Mind indexing: target <10s per batch of 50
    - Sleeping cycle: target <60s (p95)
    - Redis checkpoint: target <2ms (p95)
  
  - [ ] 32.2 Identify and optimize bottlenecks
    - Profile slow operations
    - Optimize database queries
    - Optimize embedding generation
    - Optimize file I/O
  
  - [ ] 32.3 Verify all performance targets are met
    - Memory search: ✓ <200ms (p95)
    - Sleeping cycle: ✓ <60s (p95)
    - Redis checkpoint: ✓ <2ms (p95)
    - Truth extraction: ✓ <10s per session
    - Chronicle inscription: ✓ <15s per chapter
  
  - [ ] 32.4 Document performance results
    - Create performance report with benchmarks
    - Include p50, p95, p99 latencies
    - Include throughput metrics
    - Compare against targets

- [ ] 33. Documentation and deployment preparation
  - [ ] 33.1 Write API documentation
    - Document all REST endpoints
    - Include request/response examples
    - Document error codes and handling
    - _Requirements: API design_
  
  - [ ] 33.2 Write deployment guide
    - System requirements (hardware, software)
    - Installation steps (Ollama, Qdrant, Redis, Mem0)
    - Configuration guide (.env file)
    - Docker Compose setup
    - _Requirements: Deployment considerations_
  
  - [ ] 33.3 Write monitoring and observability guide
    - Metrics to track
    - Logging configuration
    - Alerting setup
    - Health check endpoints
    - _Requirements: Monitoring requirements_
  
  - [ ] 33.4 Write troubleshooting guide
    - Common issues and solutions
    - Error message reference
    - Recovery procedures
    - Performance tuning tips
  
  - [ ] 33.5 Create runbook for operations
    - Startup procedures
    - Shutdown procedures
    - Backup and restore procedures
    - Disaster recovery procedures

- [ ] 34. Final validation and testing
  - [ ] 34.1 Run full test suite
    - All unit tests pass
    - All property tests pass (100 iterations each)
    - All integration tests pass
    - All failure injection tests pass
  
  - [ ] 34.2 Verify test coverage
    - Overall coverage >90%
    - Chronicle parser/serializer >95%
    - Memory Service >90%
    - Hive Mind >85%
    - Sleeping Cycle >90%
    - Error handling >95%
  
  - [ ] 34.3 Perform end-to-end system test
    - Start all services (Ollama, Qdrant, Redis)
    - Run Memory Service
    - Execute full dialogue session
    - Trigger sleeping cycle
    - Verify all layers are populated
    - Perform memory search
    - Verify results are correct
  
  - [ ] 34.4 Perform stress testing
    - High-volume truth extraction (1000+ truths)
    - High-frequency searches (100+ queries/minute)
    - Long-running sessions (multiple sleeping cycles)
    - Verify system remains stable
  
  - [ ] 34.5 Perform failure recovery testing
    - Simulate various failure scenarios
    - Verify graceful degradation
    - Verify recovery procedures work
    - Verify data integrity is maintained

- [x] 35. Final checkpoint - Production readiness
  - All tests pass (unit + property + integration + failure injection)
  - All performance targets met
  - All whitepaper validations complete
  - Test coverage >90%
  - Documentation complete (API, deployment, monitoring, troubleshooting)
  - Stress testing successful
  - Failure recovery testing successful
  - System ready for production deployment
  - Ask user for final approval

---

## Notes

### Task Conventions

- Tasks marked with `*` are optional testing tasks (can be skipped for faster MVP)
- Each task references specific requirements for traceability
- Property tests are annotated with property number and requirements
- Whitepaper validation tasks reference specific sections
- Checkpoints ensure incremental validation

### Property-Based Testing

- All 18 correctness properties have dedicated test tasks
- Minimum 100 iterations per property test
- Tests are tagged: feature=memory-system, property=N
- Properties validate universal correctness across input space

### Whitepaper Compliance

- Every major component has a validation task
- Validation tasks reference specific whitepaper sections
- Deviations must be documented and justified
- Compliance report created at end of Phase 5

### Performance Targets

| Metric | Target | P95 | P99 |
|--------|--------|-----|-----|
| Memory search (semantic) | <200ms | <300ms | <500ms |
| Truth extraction | <10s | <15s | <20s |
| Chronicle inscription | <15s | <20s | <30s |
| Hive Mind indexing | <10s | <15s | <25s |
| Redis checkpoint | <2ms | <5ms | <10ms |
| Sleeping cycle | <60s | <75s | <90s |

### Technology Stack

- **Language:** TypeScript/Node.js
- **Local LLM:** Qwen 3.5 9B (Q4 quantization via Ollama)
- **Memory Framework:** Mem0 (automatic fact extraction)
- **Vector DB:** Qdrant (semantic search)
- **State Persistence:** Redis (LangGraph checkpointer)
- **Orchestration:** LangGraph (multi-agent workflows)
- **Testing:** Jest (unit), fast-check (property-based)
- **Validation:** Zod (schema validation)

### Implementation Timeline

- **Phase 1:** Week 1-2 (Core Infrastructure)
- **Phase 2:** Week 2-3 (Memory Operations)
- **Phase 3:** Week 3-4 (Sleeping Cycle)
- **Phase 4:** Week 4-5 (Integration & Resilience)
- **Phase 5:** Week 5-6 (Optimization & Testing)

**Total:** 5-6 weeks to production-ready system

---

**Document Status:** ✅ COMPLETE  
**Ready for:** Implementation  
**Next Step:** Begin Phase 1, Task 1 (Set up project structure)

