# TCAM Memory System

Resilient 4-Layer Memory Architecture for TCAM v1.4 (Triadic Cognitive Augmentation Model)

## Overview

The TCAM Memory System implements a fault-tolerant memory architecture where each layer operates independently, ensuring that system failures in one layer do not cascade to others. Memory operations are handled by a dedicated Memory Service running on Qwen 3.5 9B (local LLM).

## Architecture

### Four Independent Layers

- **L1: Chronicle** - Immutable historical record (file system, markdown)
- **L2: Active Stream** - Volatile working memory (Cloud LLM context + Redis)
- **L3: Hive Mind** - Semantic memory (Qdrant vector DB + Mem0)
- **L4: Agent Codex** - Personal knowledge base (file system, markdown)

### Memory Service

Dedicated process running on Qwen 3.5 9B for:
- Truth extraction from dialogue
- Chronicle inscription
- Hive Mind indexing
- Agent Codex updates
- Sleeping cycle orchestration

## Technology Stack

- **TypeScript/Node.js** - Core implementation
- **Qwen 3.5 9B** - Local LLM for memory operations
- **Mem0** - Automatic fact extraction
- **Qdrant** - Vector database for semantic search
- **Redis** - Fast state persistence (LangGraph checkpointer)
- **LangGraph** - Multi-agent orchestration
- **Jest** - Testing framework
- **fast-check** - Property-based testing

## Project Structure

```
.
├── src/                    # Source code
├── tests/                  # Test files
├── data/                   # Chronicle storage
├── codex/                  # Agent Codex (L4)
├── docs/                   # Documentation
└── .kiro/specs/           # Specification documents
```

## Getting Started

### Prerequisites

- Node.js 18+
- Ollama (for Qwen 3.5 9B)
- Docker (for Qdrant and Redis)

### Installation

```bash
# Install dependencies
npm install

# Pull Qwen 3.5 9B model
ollama pull qwen2.5:9b-instruct-q4_K_M

# Pull embedding model
ollama pull nomic-embed-text

# Start Qdrant (using setup script)
# Windows PowerShell:
.\scripts\setup-qdrant.ps1

# Linux/Mac:
bash scripts/setup-qdrant.sh

# Or manually with Docker:
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant

# Start Redis
docker run -d --name redis -p 6379:6379 redis
```

### Verify Setup

```bash
# Check Qdrant
curl http://localhost:6333/health

# Check Redis
redis-cli ping

# Check Ollama
ollama list
```

### Development

```bash
# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format
```

## Specification

See `.kiro/specs/memory-system/` for complete specification:
- `requirements.md` - Functional requirements
- `design.md` - Technical design
- `tasks.md` - Implementation tasks

## License

MIT
