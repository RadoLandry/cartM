---
description: 'Task list for feature implementation'
---

# Tasks: Discipline & Category Taxonomy

**Input**: Design documents from `specs/002-discipline-taxonomy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Update Prisma schema in `prisma/schema.prisma` with `Product` model extensions (disciplineTags, categoryTags, classificationConfidence, isManuallyClassified)
- [X] T002 Generate database client and push schema via terminal `npx prisma generate` and `npx prisma db push`

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement canonical taxonomy mappings and arrays in `app/lib/knowledge-graph/taxonomy.ts`
- [X] T004 [P] Implement `llm-classifier.ts` using Vercel AI SDK `generateObject` with Zod schema in `app/lib/knowledge-graph/llm-classifier.ts`
- [X] T005 [P] Implement base CRUD operations for product taxonomy within `app/lib/db/queries.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

## Phase 3: User Story 1 - Automated Classification Engine (Priority: P1) 🎯 MVP

**Goal**: Classify products automatically using the LLM classifier at ingestion or webhook invocation.

**Independent Test**: Mock a product sync/creation and verify the LLM classifying logic assigns standard taxonomy and stores confidence in DB.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create unit tests for LLM classification logic with mocked AI response in `tests/unit/knowledge-graph/llm-classifier.test.ts`
- [X] T007 [US1] Update catalog ingestion (`app/lib/knowledge-graph/ingestion.ts`) to pipe unclassified products through `llm-classifier.ts`
- [X] T008 [US1] Integrate webhook handlers in `app/lib/shopify/webhooks.ts` to trigger asynchronous classification on product creation

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

## Phase 4: User Story 2 - Merchant Override UI (Priority: P2)

**Goal**: Provide an Admin UI interface to review low-confidence (<0.8) and override taxonomic classifications manually.

**Independent Test**: Visit the Knowledge Graph Admin UI, view low-confidence classifications, override tags, and visually confirm the table locking the manual entry.

### Implementation for User Story 2

- [X] T009 [P] [US2] Update loaders and actions in `app/routes/app.knowledge-graph.tsx` to handle fetching low confidence products and accepting override submissions
- [X] T010 [P] [US2] Build Polaris `IndexTable` or `ResourceList` components within `app/routes/app.knowledge-graph.tsx` for merchant verification tasks

**Checkpoint**: User Stories 1 AND 2 should both work independently

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T011 Verify LLM classification limits and Shopify webhook timeout constraints
- [ ] T012 Finalize validation gates and test checklist

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- Foundational components (LLM generation vs database fetching logics) can be built in parallel.
- Route UI loader/action handlers and interface component building in P2 can be done simultaneously.

### Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
