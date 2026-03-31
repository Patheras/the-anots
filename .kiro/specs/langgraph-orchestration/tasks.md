# Implementation Plan: LangGraph Orchestration

## Overview

Implement the stateful multi-agent workflow engine for TCAM using `@langchain/langgraph`. The implementation follows a bottom-up phase structure: core types → stateless components → node implementations → infrastructure → integration.

## Tasks

- [ ] 1. Phase 1 — Core types: ANOTSState and Whisper

  - [ ] 1.1 Create `src/orchestration/state.ts` with `Message` interface, `ANOTSState` interface, `ANOTSStateAnnotation` using `Annotation.Root`, and a `deserializeANOTSState` helper that restores `Date` objects from ISO strings
    - `messages` and `whispers` fie