# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Classify every product into discipline(s) (Boxing, Muay Thai, BJJ, MMA, Fitness) and functional categories (Protection, Apparel, Accessories, Equipment) using LLM-assisted classification on initial sync, with merchant overrides via admin UI. Store as structured tags in the knowledge graph.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: React Router 7, @shopify/shopify-app-react-router, Prisma, pgvector, Vercel AI SDK
**Storage**: PostgreSQL with pgvector extension
**Testing**: Vitest/Jest (implied from helpers structure)
**Target Platform**: Vercel (Edge/Serverless), Shopify Admin, Shopify Storefront
**Project Type**: Web Service / Shopify App
**Performance Goals**: Fast ingestion and quick AI response times (<500ms)
**Constraints**: Shopify API rate limits, Webhook response timeouts
**Scale/Scope**: Support catalogs up to 10k items (Growth tier)

### NEEDS CLARIFICATION
- **Taxonomy Source**: Is there a predefined baseline taxonomy (e.g., standard list of categories for Boxing, BJJ) provided by the system, or does the LLM infer it entirely from scratch?
- **Confidence Scores**: Is there a specific threshold for confidence below which a classification is flagged for manual review?
- **Manual Override Flow**: When a merchant overrides a classification, should this feedback be used to fine-tune the LLM, or is it strictly a local database update?

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*Read `.specify/memory/constitution.md` for the full principle definitions. The
standard gates for CartMind (Principles I–V) are:*

- [x] All new GraphQL queries are field-minimal — no over-fetching (Principle III)
- [x] All external inputs validated and sanitized at network boundaries (Principle II)
- [x] Webhook handlers include HMAC signature verification (Principles I & II)
- [ ] TypeScript strict mode passes with no new unexcused `any` escapes (Principle IV)
- [x] New business logic has corresponding tests before/alongside implementation (Principle V)
- [x] All admin UI uses Polaris components and App Bridge (Principle I)
- [x] No secrets hard-coded or committed to source control (Principle II)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
`	ext
app/
├── lib/
│   ├── knowledge-graph/
│   │   ├── taxonomy.ts
│   │   └── llm-classifier.ts
│   └── db/
│       └── queries.ts
├── routes/
│   └── app.knowledge-graph.tsx
prisma/
└── schema.prisma
`

**Structure Decision**: Option 2: Web application (Remix/React Router 7 structure) applies here. The data model changes go in prisma/schema.prisma. The backend classification logic resides in pp/lib/knowledge-graph/taxonomy.ts and llm-classifier.ts. The UI for manual override lives in pp/routes/app.knowledge-graph.tsx.
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
