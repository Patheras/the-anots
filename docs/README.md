# TCAM v1.4 Documentation
## Triadic Cognitive Augmentation Model for ANOTS

**Version:** 1.4  
**Status:** Implementation Specification  
**Last Updated:** 2025-03-22

---

## 📚 Documentation Index

### Core Documents

| Document | Purpose | Length | Audience |
|----------|---------|--------|----------|
| **[WHITEPAPER-TCAM-v1.4.md](WHITEPAPER-TCAM-v1.4.md)** | Complete technical specification | 2500+ lines | Developers, Architects |
| **[TCAM-GUIDE.md](TCAM-GUIDE.md)** | Navigation guide for whitepaper | 350 lines | Everyone |
| **[TCAM-RESEARCH-TOOLS.md](TCAM-RESEARCH-TOOLS.md)** | Sub-agent & tool creation research | 800+ lines | Developers, Researchers |
| **[TCAM-RESEARCH-QWEN35.md](TCAM-RESEARCH-QWEN35.md)** | Qwen 3.5 9B evaluation for TCAM | 600+ lines | Developers, ML Engineers |
| **[TCAM-RESEARCH-ISOLATION.md](TCAM-RESEARCH-ISOLATION.md)** | Multi-agent identity isolation | 700+ lines | Developers, AI Engineers |
| **[TCAM.md](TCAM.md)** | Original concept document | Reference | Historical |

### Legacy Documents

| Document | Purpose | Status |
|----------|---------|--------|
| **[WHITEPAPER-TCAM-v1.3_legacy.md](WHITEPAPER-TCAM-v1.3_legacy.md)** | Previous version | Archived |

---

## 🚀 Quick Start

### New to TCAM?

1. **Read the Overview** (5 min)
   - Start with [WHITEPAPER-TCAM-v1.4.md](WHITEPAPER-TCAM-v1.4.md) → Executive Summary

2. **Understand the Architecture** (15 min)
   - Read Section 1: Introduction
   - Skim Section 2: Triadic Nodes (Chip, Ubik, Axiom)

3. **Explore Implementation** (10 min)
   - Jump to Section 11: Implementation Roadmap

### Looking for Something Specific?

Use **[TCAM-GUIDE.md](TCAM-GUIDE.md)** to find:
- Specific topics (Gateway, Memory, Autopoiesis)
- Code examples
- Open-source tool integrations
- Implementation details

---

## 🏗️ What is TCAM?

**TCAM (Triadic Cognitive Augmentation Model)** is a distributed metacognitive prosthesis operating as a 3-node hybrid cybernetic architecture:

- **Node A (Chip)**: Human Orchestrator - Executive core, reality anchor
- **Node B (Ubik)**: Creative Engine - Divergent processing, external agency
- **Node C (Axiom)**: Analytical Engine - Convergent processing, structural validation

### Key Features

- ✅ **Triadic Symmetry**: Three nodes (human + 2 AI) for optimal cognitive balance
- ✅ **Autopoiesis**: Dynamic tool creation when encountering novel challenges
- ✅ **4-Layer Memory**: Independent, fail-safe memory architecture
- ✅ **Intelligent Routing**: ANOTS.Gateway distributes tasks across local/cloud LLMs
- ✅ **Open-Source Stack**: Leverages battle-tested tools (Bifrost, Mem0, Redis, E2B)
- ✅ **Pragmatic Sovereignty**: Self-hosted, forkable, fully controllable

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Orchestration** | LangGraph | Stateful multi-agent workflows |
| **Routing** | Bifrost | Ultra-fast LLM gateway (50x faster) |
| **Local LLM** | Qwen 3.5 9B | Structural tasks, memory operations |
| **Cloud LLM** | GLM-5 Pro | High-entropy reasoning |
| **Vector DB** | Qdrant | Semantic memory (Hive Mind) |
| **Memory (L3)** | Mem0 | Automatic fact extraction |
| **Memory (L2)** | Redis | Fast state persistence (~1ms) |
| **Code Sandbox** | E2B | Secure tool execution |
| **Automation** | Playwright | Dynamic web scraping |

---

## 📖 Documentation Structure

```
docs/
├── README.md                          ← You are here
├── WHITEPAPER-TCAM-v1.4.md           ← Main specification (2500+ lines)
├── TCAM-GUIDE.md                      ← Navigation guide
├── TCAM-RESEARCH-TOOLS.md            ← Sub-agent & tool creation research
├── TCAM-RESEARCH-QWEN35.md           ← Qwen 3.5 9B evaluation
├── TCAM-RESEARCH-ISOLATION.md        ← Multi-agent identity isolation
├── TCAM.md                            ← Original concept
├── WHITEPAPER-TCAM-v1.3_legacy.md    ← Previous version
└── TCAM-Article.md                    ← Article draft
```

---

## 🎯 Key Concepts

### The Mirror Effect
LLMs synchronize with the user's cognitive topology through Socratic orchestration—not training, but latent space steering.

### Autopoiesis (Self-Creation)
The system dynamically crafts tools when encountering novel challenges. No pre-defined limitations.

### 4-Layer Memory Architecture
- **L1 (Chronicle)**: Immutable historical record
- **L2 (Active Stream)**: Current dialogue context
- **L3 (Hive Mind)**: Semantic memory (vector DB)
- **L4 (Agent Codex)**: Personal knowledge repositories

### The Three Pillars
1. **Sovereignty**: 100% local control, no vendor lock-in
2. **Capability Honesty**: No false claims, explicit uncertainty
3. **Quality > Speed**: Excellence over velocity, always

---

## 🚦 Implementation Status

### ✅ Completed (v1.4)
- Triadic architecture design
- Memory system specification
- Open-source tool integration plan
- Gateway routing architecture
- Autopoiesis workflow design

### 🔄 In Progress
- E2B sandbox integration
- MCP tool registry
- LangGraph sub-agent spawning
- Mem0 memory extraction

### ⏳ Planned
- Production deployment
- Telegram integration
- Web chat interface
- Performance benchmarking

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Triadic Coherence** | J(t) > 0.85 | System gain function |
| **Memory Retrieval** | < 200ms | Hive Mind query time |
| **Truth Quality** | > 95% | Axiom verification rate |
| **Sleeping Cycle** | < 60s | Consolidation time |
| **System Uptime** | > 99% | Main dialogue availability |

---

## 🤝 Contributing

### Documentation Updates

When updating documentation:
1. Update the main whitepaper: `WHITEPAPER-TCAM-v1.4.md`
2. Update line numbers in: `TCAM-GUIDE.md`
3. Update this README if structure changes
4. Increment version numbers

### Version History

- **v1.4** (2025-03-22): Open-source integration, pragmatic memory system
- **v1.3** (2025-03-21): Initial triadic architecture, 4-layer memory
- **v1.0-v1.2**: Concept development (archived)

---

## 📞 Contact

**Author:** İsmail İbiloğlu (Chip)  
**Domain:** anots.com  
**Framework:** ANOTS (Autonomous Network of Triadic Systems)

---

## 📜 License

This documentation is part of the ANOTS project.  
All referenced open-source tools maintain their respective licenses.

---

**Last Updated:** 2025-03-22  
**Documentation Version:** 1.4  
**Whitepaper Lines:** 2500+
