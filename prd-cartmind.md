<rpg-method>
# Repository Planning Graph (RPG) Method — PRD

This PRD follows the RPG methodology: separate WHAT (functional) from HOW (structural), then connect them with explicit dependencies. Designed for `task-master parse-prd` compatibility.
</rpg-method>

---

# CartMind — AI-Powered Intelligent Shopping Cart for Shopify

**Product Requirements Document — RPG Method**
**Version 1.0 — March 23, 2026**

---

<overview>

## Problem Statement

Traditional e-commerce shopping carts are passive containers — dumb lists of SKUs with zero contextual awareness. They don't understand product relationships, can't detect sizing conflicts, never suggest missing gear, and offer no intelligent guidance. For specialty retailers like Venum (combat sports), this creates multiple pain points:

- **High return rates** from wrong sizing (customers pick boxing gloves in oz that don't match their weight class, or mismatched shorts/rashguard sizes)
- **Incomplete purchases** — a customer buys boxing gloves but forgets hand wraps, a mouthguard, or a bag
- **Low average order value (AOV)** — no intelligent cross-sell that understands the customer's discipline (boxing vs. Muay Thai vs. BJJ)
- **Cart abandonment** — customers unsure if their selections are right have no one to ask
- **No visual coherence** — customers can't see if their gear looks good together until it arrives

Existing Shopify "upsell" apps (ReConvert, Bold Upsell, In Cart Upsell) use generic "frequently bought together" logic. They have no domain knowledge, no size intelligence, no conversational capability, and no visual kit preview.

## Target Users

**Primary: Shopify Plus merchants in specialty/enthusiast verticals** — combat sports, outdoor gear, cycling, skiing, fitness equipment — where:

- Products have complex interdependencies (discipline-specific kits)
- Sizing is non-trivial and varies across product categories
- Customers are knowledgeable and value expert guidance
- Visual coordination matters (matching colorways, collections)

### Personas

1. **The Beginner Fighter** — Buying their first boxing or MMA kit. Doesn't know what oz gloves to get, what hand wraps are for, or that they need a mouthguard. Needs guided kit building.

2. **The Experienced Practitioner** — Knows exactly what they want. Trains Muay Thai 4x/week, replacing worn shin guards. Wants fast checkout, no noise. The cart should recognize this and stay quiet.

3. **The Gift Buyer** — Buying for someone else. Uncertain about sizes, doesn't know discipline-specific requirements. Needs conversational help.

4. **The Merchant Admin** — Configures the AI cart: defines product relationships, sets up discipline taxonomies, configures bundle rules, monitors analytics.

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cart AOV increase | +15-25% over baseline | A/B test vs. standard cart |
| Return rate reduction | -30% on size-related returns | Track return reason codes |
| Cart abandonment rate | -20% reduction | Funnel analytics |
| Kit completion rate | 60% of carts contain 3+ related items | Cart composition analysis |
| Conversational engagement | 15% of sessions use chat sidebar | Chat session analytics |
| Merchant setup time | < 2 hours for initial knowledge graph | Onboarding tracking |

</overview>

---

<functional-decomposition>

## Capability Tree

### Capability: Product Knowledge Graph

Structured representation of all product relationships, attributes, and domain knowledge that powers every intelligent feature.

#### Feature: Catalog Ingestion & Sync

- **Description**: Ingest the merchant's Shopify product catalog and continuously sync changes via webhooks.
- **Inputs**: Shopify Admin GraphQL API (products, variants, collections, metafields), webhook events (PRODUCTS_CREATE, PRODUCTS_UPDATE, PRODUCTS_DELETE)
- **Outputs**: Normalized product records in PostgreSQL with vector embeddings in pgvector
- **Behavior**: On install, perform full catalog sync. Subscribe to product webhooks for incremental updates. Extract product attributes from titles, descriptions, tags, and metafields. Generate text embeddings for semantic similarity.

#### Feature: Discipline & Category Taxonomy

- **Description**: Classify every product into discipline(s) (Boxing, Muay Thai, BJJ, MMA, Fitness) and functional categories (Protection, Apparel, Accessories, Equipment).
- **Inputs**: Product data (title, description, tags, collections, metafields), merchant-provided taxonomy overrides
- **Outputs**: Per-product classification with confidence scores
- **Behavior**: Use LLM-assisted classification on initial sync, allow merchant overrides via admin UI. Products can belong to multiple disciplines. Store as structured tags in the knowledge graph.

#### Feature: Product Relationship Mapping

- **Description**: Define explicit relationships between products: "complements" (gloves → hand wraps), "upgrades" (Challenger → Elite), "conflicts" (competition gloves should not be paired with training-only headgear).
- **Inputs**: Product catalog, discipline taxonomy, merchant-defined rules, purchase co-occurrence data
- **Outputs**: Weighted relationship graph (product A → product B, relationship type, weight)
- **Behavior**: Auto-generate initial relationships from co-purchase data and LLM analysis. Merchants can add/remove/weight relationships in admin. Relationship types: complements, upgrades, alternatives, conflicts, same-collection.

#### Feature: Size & Fit Intelligence

- **Description**: Maintain sizing curves and cross-product size mappings per product category.
- **Inputs**: Product size variants, merchant-defined size charts, return data (when available)
- **Outputs**: Size recommendation given customer profile, size conflict detection between cart items
- **Behavior**: Map abstract sizes (S/M/L/XL) and sport-specific sizes (glove oz, shorts waist) to body measurements. Detect when cart items have incompatible sizes (e.g., Medium shorts + XL rashguard). Learn from return data to adjust recommendations.

#### Feature: Colorway & Collection Tracking

- **Description**: Track which products share colorways, belong to the same collection/line, and which colors complement each other.
- **Inputs**: Product images (color extraction), collection membership, product tags, variant option names
- **Outputs**: Colorway graph linking products by visual compatibility
- **Behavior**: Extract dominant colors from product images using server-side image processing. Track collection membership (e.g., "Phantom" line). Score visual compatibility between cart items.

---

### Capability: Cart Intelligence Engine

Real-time analysis of cart contents to generate recommendations, warnings, and insights.

#### Feature: Kit Completeness Detection

- **Description**: Analyze current cart to determine what "kit" the customer is building and what's missing.
- **Inputs**: Cart line items, product knowledge graph (discipline taxonomy, relationship map)
- **Outputs**: Identified discipline(s), kit completeness score, ordered list of missing items with priority
- **Behavior**: Infer discipline from cart contents (boxing gloves → boxing kit). Look up the canonical kit definition for that discipline. Score completeness (3/7 items). Rank missing items by importance (safety gear first, accessories last). If cart spans multiple disciplines, handle each independently.

#### Feature: Size Conflict Detection

- **Description**: Detect potential sizing mismatches between items in the cart.
- **Inputs**: Cart line items with selected size variants, size intelligence data
- **Outputs**: List of conflicts with severity (warning vs. error) and suggested corrections
- **Behavior**: Cross-reference sizes across product categories. Flag unusual combinations (Medium shorts + XL rashguard). For weight-dependent sizing (glove oz), check if selected oz matches other indicators. Severity levels: "error" (definitely wrong, e.g., kids' gloves + adult headgear), "warning" (unusual but possible).

#### Feature: Smart Bundle Detection

- **Description**: Recognize when cart items naturally form a bundle and offer a bundle discount.
- **Inputs**: Cart line items, merchant-defined bundle rules, product relationships
- **Outputs**: Detected bundle(s), applicable discount, messaging
- **Behavior**: Match cart contents against defined bundle templates (e.g., "Starter Boxing Kit = gloves + wraps + mouthguard + bag"). If 80%+ of a bundle is in the cart, suggest completing it for the discount. Calculate discount via Shopify Functions (automatic discount). Multiple bundles can be detected simultaneously.

#### Feature: Threshold Optimization

- **Description**: When customer is near a spending threshold (free shipping, discount tier), recommend the most contextually relevant product to reach it.
- **Inputs**: Cart subtotal, threshold rules (free shipping at $X, discount at $Y), gap amount, product knowledge graph
- **Outputs**: Top 1-3 recommended products with relevance reasoning
- **Behavior**: Calculate gap to nearest threshold. Filter products by: price fits gap, relevant to cart discipline, complements existing items. Rank by relevance score. Never suggest random cheap items — always contextually appropriate.

#### Feature: Style & Colorway Matching

- **Description**: Suggest product swaps or additions that improve visual coherence of the cart.
- **Inputs**: Cart line items, colorway graph, collection data
- **Outputs**: Swap suggestions (e.g., "switch to black/gold gloves to match your shorts"), collection completion suggestions
- **Behavior**: Score visual coherence of current cart. If 2/3 items are from the same collection, suggest the third from that collection. If colors clash, suggest same-product in a matching colorway. Priority is subtle suggestion, not aggressive upsell.

#### Feature: Customer Profile & History

- **Description**: Build and maintain a lightweight customer profile that powers personalized recommendations across sessions.
- **Inputs**: Shopify customer data (if logged in), browsing behavior (via Storefront API), purchase history, explicit profile inputs (weight class, discipline, experience level)
- **Outputs**: Customer embedding (discipline preference, size profile, price sensitivity, purchase frequency)
- **Behavior**: For anonymous users, use session-based profile (cookie). For logged-in users, persist across sessions. Detect returning pro customers (high order frequency, consistent sizes) and reduce recommendation noise. Track replenishment cycles (hand wraps every 3 months).

#### Feature: Replenishment Prediction

- **Description**: For returning customers, predict which items need replacement based on purchase history and product lifecycle.
- **Inputs**: Customer purchase history, product category lifecycle data (hand wraps: 3-6 months, mouthguard: 12 months, gloves: 18-24 months)
- **Outputs**: Replenishment suggestions with timing, pre-populated "refresh cart"
- **Behavior**: Calculate expected replacement date per purchased item. When customer returns near that date, surface replenishment suggestions. Allow one-click "reorder" or "upgrade" for each item.

---

### Capability: Conversational Cart Sidebar

AI-powered chat interface embedded in the cart drawer for natural language shopping assistance.

#### Feature: Chat Interface (Storefront Widget)

- **Description**: Lightweight chat panel anchored to the cart drawer/page, built with Vercel AI SDK UI's useChat hook and shadcn/ui components.
- **Inputs**: User messages, cart context (current items, customer profile)
- **Outputs**: Streaming AI responses with generative UI components (product cards, size selectors, comparison tables)
- **Behavior**: Renders as a collapsible panel in the cart. Streams responses via Vercel AI SDK. Supports rich tool-based UI: when the AI decides to show a product comparison, it calls a tool that renders a React comparison component inline. Uses shadcn/ui for consistent, accessible styling.

#### Feature: Cart-Aware Conversation

- **Description**: Every conversation turn includes full cart context so the AI can give specific, actionable advice.
- **Inputs**: Current cart state (items, sizes, quantities, subtotal), customer profile, product knowledge graph context
- **Outputs**: Contextual responses that reference specific cart items by name
- **Behavior**: System prompt includes serialized cart state and relevant knowledge graph context. AI can reference specific items ("Your Challenger gloves are designed for pad work..."). AI can suggest specific actions (add, remove, swap, change size) that map to cart operations.

#### Feature: Cart Manipulation via Tools

- **Description**: The AI can modify the cart through tool calls — adding items, removing items, changing quantities, swapping variants.
- **Inputs**: AI tool calls with structured parameters (product ID, variant ID, quantity, action type)
- **Outputs**: Updated cart state, confirmation UI component
- **Behavior**: Define AI SDK tools: addToCart, removeFromCart, changeQuantity, swapVariant. Each tool requires user confirmation before executing (using AI SDK's needsApproval pattern). After execution, cart state refreshes and AI acknowledges the change. Uses Shopify Storefront API Cart mutations under the hood.

#### Feature: Product Comparison

- **Description**: When asked to compare products, render a rich comparison table as a generative UI component.
- **Inputs**: AI tool call with product IDs to compare, comparison dimensions
- **Outputs**: React component rendering a comparison table with specs, pricing, and recommendation
- **Behavior**: AI calls a compareProducts tool. Server fetches detailed product data. Returns structured comparison data. Client renders a shadcn/ui Table component with product images, specs, pricing, and a highlighted recommendation. User can add the recommended product directly from the comparison.

#### Feature: Budget-Aware Optimization

- **Description**: When given a budget constraint, the AI re-optimizes the cart to fit within budget while maximizing value.
- **Inputs**: Budget amount, current cart, product alternatives from knowledge graph
- **Outputs**: Optimized cart suggestion with itemized changes and reasoning
- **Behavior**: AI analyzes cart against budget. Identifies items that can be downgraded without sacrificing safety (cosmetic items over protective gear). Suggests specific swaps with price differences. Never suggests removing safety-critical items.

---

### Capability: Visual Kit Preview

Real-time visual rendering of all cart items as a cohesive outfit/kit.

#### Feature: Kit Composition Renderer

- **Description**: Server-side image compositor that combines product images into a single "kit view" showing how items look together.
- **Inputs**: Product image URLs for all cart items, layout template based on discipline
- **Outputs**: Composite image (PNG/WebP) of the complete kit
- **Behavior**: Use Sharp (Node.js) for server-side image composition. The `/api/ai/kit-preview` route **must be configured with the Node.js runtime** (`export const runtime = 'nodejs'`) — Sharp uses native binaries and is **incompatible with Vercel's Edge Runtime**. Pre-define layout templates per discipline (boxing: gloves left, shorts center, headgear top, wraps right). Composite product images on a neutral background. Cache aggressively via Vercel Blob — same cart combination hash = same cached composite URL.

#### Feature: Colorway Preview

- **Description**: Show how a colorway swap would look before the customer commits.
- **Inputs**: Current kit composite, proposed variant swap (e.g., red gloves → black/gold gloves)
- **Outputs**: Updated composite image with the swapped variant
- **Behavior**: When AI or UI suggests a colorway swap, render a preview composite with the new variant. Show side-by-side (current vs. proposed). Quick operation since most of the composite is cached — only the swapped item changes.

---

### Capability: Merchant Admin Dashboard

Configuration interface for merchants to manage the AI cart's knowledge, rules, and analytics.

#### Feature: Knowledge Graph Editor

- **Description**: Visual interface for merchants to review and edit product classifications, relationships, and size mappings.
- **Inputs**: Auto-generated knowledge graph, merchant edits
- **Outputs**: Updated knowledge graph with merchant overrides persisted
- **Behavior**: Show products grouped by discipline with drag-and-drop reclassification. Visualize product relationships as an interactive graph. Allow bulk operations (tag all "Phantom" collection products). Highlight low-confidence classifications for review.

#### Feature: Bundle Rule Manager

- **Description**: Interface to define, edit, and test bundle rules and their associated discounts.
- **Inputs**: Product selections, discount parameters, bundle naming
- **Outputs**: Bundle rule configurations stored and deployed via Shopify Functions
- **Behavior**: Wizard-style bundle creation: select products, set minimum items, define discount (% or $), name the bundle. Preview how the bundle appears in the cart. Test mode to verify discount calculation. Sync to Shopify Functions for server-side execution.

#### Feature: Analytics Dashboard

- **Description**: Track the AI cart's impact on key metrics with a dedicated analytics view.
- **Inputs**: Cart events, conversion data, recommendation interaction data, chat session logs
- **Outputs**: Dashboard with KPIs (AOV lift, return rate, cart completion, chat engagement), recommendation performance, funnel analysis
- **Behavior**: Track all recommendation impressions, clicks, and conversions. A/B test metrics (AI cart vs. standard cart). Chat session analytics (topics, resolution, cart modifications). Bundle performance tracking. Export capabilities for deeper analysis.

#### Feature: AI Behavior Configuration

- **Description**: Allow merchants to tune the AI's personality, aggressiveness, and domain knowledge.
- **Inputs**: Configuration parameters (tone, upsell aggressiveness, safety priority, custom system prompt additions)
- **Outputs**: Updated AI behavior parameters
- **Behavior**: Slider for recommendation aggressiveness (subtle → assertive). Toggle safety-over-revenue mode (default: on). Custom product knowledge injection ("our rashguards run one size small"). Conversation starter customization. Preview mode to test AI behavior before going live.

---

### Capability: Shopify Storefront Integration

All touchpoints where the app injects into the merchant's online store.

#### Feature: Cart Drawer App Block (Theme App Extension)

- **Description**: Theme App Extension that injects the AI cart UI into the store's cart drawer or cart page.
- **Inputs**: Cart state from Storefront API, AI backend responses
- **Outputs**: Rendered UI components: recommendation cards, kit completeness bar, size warnings, chat toggle
- **Behavior**: App Embed Block that activates on cart drawer open/cart page load. Fetches recommendations from AI backend on cart change. The storefront widget is mounted inside a **Shadow DOM** to ensure full CSS isolation from the merchant's theme — this prevents Tailwind/shadcn styles from leaking into or being overridden by theme stylesheets. Responsive design for mobile/desktop. Lazy-loads chat sidebar on toggle. Theme App Extension assets are served via Shopify's CDN; updates require a new app version push via Shopify CLI.

#### Feature: Checkout UI Extension

- **Description**: Shopify Checkout UI Extension that displays critical warnings and bundle offers at checkout.
- **Inputs**: Cart data from Checkout API, size conflict analysis, bundle detection
- **Outputs**: Checkout UI blocks: size conflict warnings, bundle completion offers, kit completeness nudge
- **Behavior**: All UI must be built **exclusively with `@shopify/checkout-ui-extensions-react` components** (Banner, BlockStack, Text, Button, etc.). Custom HTML, CSS, external component libraries (including shadcn/ui, Tailwind, Radix) are **not permitted** — the extension renderer is a sandboxed remote UI, not a browser DOM. The extension's React environment is managed by Shopify's runtime; the host app's React 19 does not apply. Receives pre-computed analysis results from the app backend via metafields or session storage to stay within the 64KB bundle limit. Respects Shopify Plus requirements for information/shipping/payment step placement.

#### Feature: Discount Function (Shopify Functions)

- **Description**: Server-side Shopify Function that automatically applies bundle discounts when cart matches bundle rules.
- **Inputs**: Cart contents (via function input query), bundle rule configurations (via metafields)
- **Outputs**: Discount operations (percentage off, fixed amount off) applied to qualifying items
- **Behavior**: Written in JavaScript compiled to Wasm via Javy. Executes on Shopify's infrastructure within a **10ms CPU time limit**. The Function runtime has **no access to Node.js APIs, Prisma, `fetch`, or external HTTP requests** — all logic must be self-contained and operate only on data from the GraphQL input query. Bundle rules must be pre-computed by the app backend and stored in product/shop metafields, then read via `input.graphql`. Evaluates cart against active bundle rules, applies the best qualifying discount. Stacks with other discount types per Shopify's combination rules.

#### Feature: Cart Transform Function (Shopify Functions)

- **Description**: Server-side Shopify Function that transforms cart lines for bundle presentation.
- **Inputs**: Cart line items, bundle detection results (pre-computed in metafields)
- **Outputs**: Merged cart lines showing bundle as a single unit with component breakdown
- **Behavior**: Written in JavaScript compiled to Wasm via Javy. Same runtime constraints as the Discount Function: **no Node.js APIs, no `fetch`, no external calls**, 10ms CPU limit. Bundle detection logic must be minimal — read pre-computed match data from metafields rather than recomputing. Merges individual cart lines into a bundle line with name, total price, and savings. Handles partial bundles. Pre-computation of bundle matches is done by the app backend on cart webhook events.

</functional-decomposition>

---

<structural-decomposition>

## Repository Structure

```
cartmind/
├── app/                              # React Router 7 application
│   ├── routes/
│   │   ├── app._index.tsx            # Dashboard home
│   │   ├── app.knowledge-graph.tsx   # Knowledge graph editor
│   │   ├── app.bundles.tsx           # Bundle rule manager
│   │   ├── app.analytics.tsx         # Analytics dashboard
│   │   ├── app.settings.tsx          # AI behavior configuration
│   │   ├── app.onboarding.tsx        # First-run setup wizard
│   │   ├── api.ai.chat.tsx           # AI chat streaming endpoint
│   │   ├── api.ai.recommendations.tsx # Recommendation API
│   │   ├── api.ai.kit-preview.tsx    # Kit preview generator
│   │   ├── api.app-proxy.tsx         # Shopify App Proxy endpoint (storefront widget ↔ backend auth)
│   │   ├── app.billing.tsx           # Subscription & billing management
│   │   └── webhooks.tsx              # Shopify webhook entry + handlers (single entry point)
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components (custom complex UIs)
│   │   ├── polaris/                  # Polaris wrappers for standard admin pages
│   │   ├── admin/                    # Admin dashboard components
│   │   ├── storefront/               # Storefront widget components
│   │   └── chat/                     # Conversational UI components
│   ├── lib/
│   │   ├── ai/                       # AI/LLM integration layer
│   │   │   ├── tools.ts              # AI SDK tool definitions
│   │   │   ├── prompts.ts            # System prompts & templates
│   │   │   ├── providers.ts          # AI provider configuration
│   │   │   └── schemas.ts            # Zod schemas for structured outputs
│   │   ├── knowledge-graph/          # Knowledge graph engine
│   │   │   ├── ingestion.ts          # Catalog sync & ingestion
│   │   │   ├── taxonomy.ts           # Discipline classification
│   │   │   ├── relationships.ts      # Product relationship mapping
│   │   │   ├── sizing.ts             # Size intelligence
│   │   │   └── colorways.ts          # Color extraction & matching
│   │   ├── cart-intelligence/        # Cart analysis engine
│   │   │   ├── kit-detection.ts      # Kit completeness logic
│   │   │   ├── size-conflicts.ts     # Size conflict detection
│   │   │   ├── bundles.ts            # Bundle detection
│   │   │   ├── threshold.ts          # Threshold optimization
│   │   │   └── recommendations.ts    # Recommendation orchestrator
│   │   ├── visual/                   # Visual preview engine
│   │   │   ├── compositor.ts         # Image composition (Sharp)
│   │   │   └── templates.ts          # Layout templates per discipline
│   │   ├── shopify/                  # Shopify API helpers
│   │   │   ├── graphql.ts            # Admin & Storefront GraphQL (API version pinned)
│   │   │   ├── webhooks.ts           # Webhook registration & HMAC verification
│   │   │   ├── billing.ts            # Shopify Billing API (app subscriptions)
│   │   │   └── cart.ts               # Cart API operations (Storefront API)
│   │   └── db/                       # Database layer
│   │       ├── schema.ts             # Prisma schema extensions
│   │       ├── queries.ts            # Common query patterns
│   │       └── embeddings.ts         # pgvector operations
│   ├── shopify.server.ts             # Shopify auth & API config
│   ├── root.tsx                      # App root with providers
│   └── entry.server.tsx              # Server entry (Vercel adapter)
├── extensions/
│   ├── cart-drawer-block/            # Theme App Extension
│   │   ├── blocks/
│   │   │   └── ai-cart.liquid        # Main app block
│   │   ├── assets/
│   │   │   ├── ai-cart.js            # Storefront JS bundle
│   │   │   └── ai-cart.css           # Storefront styles
│   │   └── locales/                  # i18n
│   ├── checkout-ui/                  # Checkout UI Extension
│   │   ├── src/
│   │   │   └── Checkout.tsx          # Checkout extension entry
│   │   └── shopify.extension.toml
│   ├── discount-function/            # Shopify Function (Discounts)
│   │   ├── src/
│   │   │   └── run.js                # Discount logic
│   │   ├── input.graphql             # Function input query
│   │   └── shopify.extension.toml
│   └── cart-transform/               # Shopify Function (Cart Transform)
│       ├── src/
│       │   └── run.js                # Cart transform logic
│       ├── input.graphql
│       └── shopify.extension.toml
├── prisma/
│   └── schema.prisma                 # Database schema (PostgreSQL)
├── storefront-widget/                # Standalone storefront bundle
│   ├── src/
│   │   ├── CartMind.tsx              # Main widget React app
│   │   ├── components/               # Widget UI components
│   │   ├── hooks/                    # useChat, useCart hooks
│   │   └── styles/                   # Tailwind/shadcn styles
│   ├── vite.config.ts                # Build config for widget bundle
│   └── package.json
├── react-router.config.ts            # React Router configuration
├── vite.config.ts                    # Vite config with Vercel preset
├── shopify.app.toml                  # Shopify app config (API version, App Proxy, scopes, extensions)
├── package.json
├── tsconfig.json
└── .env
```

## Module Definitions

### Module: app/lib/knowledge-graph/
- **Maps to capability**: Product Knowledge Graph
- **Responsibility**: Ingest, classify, and maintain structured product knowledge
- **Exports**:
  - `syncCatalog(shopifyAdmin)` — Full catalog ingestion
  - `classifyProduct(product)` — Discipline/category classification
  - `mapRelationships(products)` — Generate relationship graph
  - `detectSizeConflicts(cartItems)` — Cross-product size validation
  - `extractColorways(products)` — Color extraction and matching

### Module: app/lib/cart-intelligence/
- **Maps to capability**: Cart Intelligence Engine
- **Responsibility**: Analyze cart state and generate recommendations
- **Exports**:
  - `analyzeCart(cartItems, customerProfile)` — Full cart analysis
  - `detectKitCompleteness(cartItems)` — Kit completeness scoring
  - `detectBundles(cartItems, bundleRules)` — Bundle matching
  - `optimizeThreshold(cart, thresholds)` — Threshold recommendations
  - `scoreStyleCoherence(cartItems)` — Visual coherence analysis

### Module: app/lib/ai/
- **Maps to capability**: Conversational Cart Sidebar
- **Responsibility**: LLM integration, tool definitions, prompt engineering
- **Exports**:
  - `tools` — AI SDK tool definitions (addToCart, compareProducts, etc.)
  - `systemPrompt(cartContext, merchantConfig)` — Dynamic system prompt builder
  - `providers` — Configured AI provider registry

### Module: app/lib/visual/
- **Maps to capability**: Visual Kit Preview
- **Responsibility**: Server-side image composition for kit previews
- **Exports**:
  - `renderKitPreview(cartItems, discipline)` — Generate composite image
  - `renderSwapPreview(currentKit, swapItem)` — Preview with variant swap

### Module: extensions/
- **Maps to capability**: Shopify Storefront Integration
- **Responsibility**: All Shopify extension points (theme, checkout, functions)

### Module: storefront-widget/
- **Maps to capability**: Cart Drawer App Block + Conversational Sidebar
- **Responsibility**: Standalone React bundle for storefront injection
- **Exports**: Self-mounting widget with cart UI, recommendations, and chat

</structural-decomposition>

---

<dependency-graph>

## Dependency Chain

### Foundation Layer (Phase 0)
No dependencies — these are built first.

- **Database Schema & Prisma Setup**: PostgreSQL schema with pgvector extension, session tables, product tables, relationship tables, customer profile tables, analytics events. Provides the data foundation for all other modules.
- **Shopify App Scaffold**: React Router 7 app from shopify-app-template-react-router, configured for Vercel deployment with @vercel/react-router preset. Shopify OAuth, session management, Admin API authentication. API version pinned to `2025-04`. OAuth scopes declared. Provides the authenticated app shell.
- **Polaris + App Bridge Setup**: Install `@shopify/polaris` and `@shopify/app-bridge-react`. Configure `AppProvider` and `Frame` at the app root. Provides the admin shell that passes Shopify App Store review.
- **shadcn/ui + Tailwind CSS v4**: Install for custom complex UI components (chat, graph visualizer, charts). Scoped to components with no Polaris equivalent. Provides the component library for specialized admin and storefront UIs.
- **Shopify Billing API**: Define subscription plans (Starter/Growth/Enterprise), implement billing gate on app load. Required before any merchant can use the app in production.
- **App Proxy Configuration**: Register `/apps/cartmind/*` proxy in `shopify.app.toml`, implement HMAC verification in `api.app-proxy.tsx`. Enables authenticated storefront widget → backend communication.
- **AI Provider Configuration**: Vercel AI SDK setup with provider registry (OpenAI, Anthropic), model selection, error handling, rate limiting. Provides the AI infrastructure for all intelligent features.

### Data Layer (Phase 1)
- **Catalog Ingestion & Sync**: Depends on [Database Schema, Shopify App Scaffold]. Syncs products from Shopify to local DB with embeddings.
- **Discipline Taxonomy Engine**: Depends on [Catalog Ingestion, AI Provider Configuration]. Classifies products using LLM assistance.
- **Product Relationship Mapper**: Depends on [Catalog Ingestion, Discipline Taxonomy Engine]. Builds the relationship graph.
- **Size Intelligence Module**: Depends on [Catalog Ingestion, Database Schema]. Size charts, cross-product mappings.
- **Colorway Extraction**: Depends on [Catalog Ingestion]. Image processing for color matching.

### Intelligence Layer (Phase 2)
- **Kit Completeness Engine**: Depends on [Discipline Taxonomy Engine, Product Relationship Mapper].
- **Size Conflict Detector**: Depends on [Size Intelligence Module].
- **Bundle Detection Engine**: Depends on [Product Relationship Mapper, Database Schema].
- **Threshold Optimizer**: Depends on [Product Relationship Mapper, Kit Completeness Engine].
- **Style Coherence Scorer**: Depends on [Colorway Extraction, Product Relationship Mapper].
- **Customer Profile Manager**: Depends on [Database Schema, Shopify App Scaffold].
- **Recommendation Orchestrator**: Depends on [Kit Completeness Engine, Size Conflict Detector, Bundle Detection Engine, Threshold Optimizer, Style Coherence Scorer, Customer Profile Manager]. Combines all intelligence modules into a single recommendation API.

### Presentation Layer (Phase 3)
- **AI Chat Tools & Prompts**: Depends on [AI Provider Configuration, Recommendation Orchestrator]. Tool definitions for cart manipulation, comparison, budget optimization.
- **Visual Kit Compositor**: Depends on [Colorway Extraction, Catalog Ingestion]. Sharp-based image composition.
- **Admin Knowledge Graph UI**: Depends on [shadcn/ui Setup, Discipline Taxonomy Engine, Product Relationship Mapper].
- **Admin Bundle Manager UI**: Depends on [shadcn/ui Setup, Bundle Detection Engine].
- **Admin Analytics Dashboard**: Depends on [shadcn/ui Setup, Database Schema].
- **Admin AI Configuration UI**: Depends on [shadcn/ui Setup, AI Provider Configuration].

### Integration Layer (Phase 4)
- **Storefront Widget Bundle**: Depends on [AI Chat Tools, Recommendation Orchestrator, Visual Kit Compositor]. Standalone React bundle for injection into storefront.
- **Theme App Extension**: Depends on [Storefront Widget Bundle]. Liquid block that loads the widget.
- **Checkout UI Extension**: Depends on [Size Conflict Detector, Bundle Detection Engine]. Preact-based checkout warnings and offers.
- **Discount Shopify Function**: Depends on [Bundle Detection Engine]. Wasm-compiled discount logic.
- **Cart Transform Shopify Function**: Depends on [Bundle Detection Engine]. Wasm-compiled cart transform.

### Optimization Layer (Phase 5)
- **Replenishment Prediction**: Depends on [Customer Profile Manager, Database Schema].
- **A/B Testing Framework**: Depends on [Admin Analytics Dashboard, Recommendation Orchestrator].
- **Return Data Integration**: Depends on [Size Intelligence Module, Customer Profile Manager].

</dependency-graph>

---

<implementation-roadmap>

## Development Phases

### Phase 0: Foundation (Weeks 1-2)

**Goal**: Establish the deployable app skeleton with database, auth, AI infrastructure, and component library.

**Entry Criteria**: Clean repository, Shopify Partner account, Vercel account, PostgreSQL database (Vercel Postgres or Neon), OpenAI/Anthropic API keys.

**Tasks**:

- [ ] Scaffold Shopify app from shopify-app-template-react-router (depends on: none)
  - Acceptance criteria: App installs on development store, OAuth flow works, admin page loads in Shopify Admin
  - Test strategy: Manual install test, verify session persistence

- [ ] Configure Vercel deployment with @vercel/react-router preset (depends on: scaffold)
  - Acceptance criteria: App deploys to Vercel, serves admin pages, handles Shopify auth callbacks
  - Test strategy: Deploy to preview, complete OAuth flow

- [ ] Pin Shopify API version and configure scopes in shopify.app.toml (depends on: scaffold)
  - Acceptance criteria: `api_version = "2025-04"` set, all required OAuth scopes declared (`read_products`, `write_products`, `read_orders`, `read_customers`, `write_discounts`, `read_cart_transforms`, `write_cart_transforms`)
  - Test strategy: `shopify app info` shows correct version and scopes, OAuth flow requests correct permissions

- [ ] Setup PostgreSQL with Prisma and pgvector (depends on: scaffold)
  - Acceptance criteria: Migrations run, pgvector extension enabled, session storage works
  - Test strategy: Unit tests for CRUD operations, verify vector similarity queries

- [ ] Install and configure Polaris + App Bridge for admin shell (depends on: scaffold)
  - Acceptance criteria: Admin pages render with Polaris AppProvider and Frame, App Bridge session token refresh works, navigation bar renders in Shopify Admin iframe, ResourcePicker can be invoked
  - Test strategy: Load admin in Shopify Admin iframe, verify Polaris styles applied, trigger ResourcePicker

- [ ] Install and configure shadcn/ui + Tailwind CSS v4 for custom components (depends on: Polaris setup)
  - Acceptance criteria: shadcn/ui components render correctly within Polaris layout, no CSS conflicts between Polaris and Tailwind
  - Test strategy: Render a page mixing Polaris PageLayout with shadcn/ui card components

- [ ] Setup Shopify Billing API with subscription plans (depends on: scaffold)
  - Acceptance criteria: Starter/Growth/Enterprise plans defined, billing redirect works, app access is gated behind active subscription, test billing mode works on dev store
  - Test strategy: Install app, verify billing gate redirects, approve test subscription, verify app access granted

- [ ] Configure App Proxy for storefront widget → backend communication (depends on: scaffold, Vercel deploy)
  - Acceptance criteria: `[app_proxy]` configured in `shopify.app.toml`, `/apps/cartmind/*` routes proxy to Vercel backend, HMAC signature verification passes on `api.app-proxy.tsx`
  - Test strategy: Make a test request through the proxy URL, verify signature validation

- [ ] Setup Vercel AI SDK with provider registry (depends on: scaffold)
  - Acceptance criteria: streamText works with OpenAI, structured outputs return valid JSON, error handling works
  - Test strategy: Integration test hitting /api/ai/chat endpoint

**Exit Criteria**: Deployed app on Vercel that installs on a Shopify dev store, shows a billing gate on first install, renders Polaris admin pages with shadcn/ui custom components, connects to PostgreSQL, has App Proxy configured, and can stream an AI response.

**Delivers**: Working but empty app shell. Developers can build features on this foundation.

---

### Phase 1: Product Intelligence (Weeks 3-5)

**Goal**: Build the knowledge graph that powers all recommendations.

**Entry Criteria**: Phase 0 complete (deployed app with DB and AI).

**Tasks**:

- [ ] Build catalog ingestion pipeline (depends on: [Database Schema, Shopify App Scaffold])
  - Acceptance criteria: Full product catalog synced to DB, webhooks update products in near-real-time
  - Test strategy: Sync test store catalog, verify product count, trigger webhook and verify update

- [ ] Implement discipline taxonomy classifier (depends on: [Catalog Ingestion, AI Provider Config])
  - Acceptance criteria: 90%+ classification accuracy on Venum's catalog, manual override works
  - Test strategy: Classify 100 products, compare against human labels

- [ ] Build product relationship mapper (depends on: [Catalog Ingestion, Taxonomy])
  - Acceptance criteria: Auto-generated relationships for 80%+ of products, merchant can edit
  - Test strategy: Verify boxing gloves → hand wraps relationship auto-detected

- [ ] Implement size intelligence module (depends on: [Catalog Ingestion])
  - Acceptance criteria: Size recommendations generated for all size-variant products, conflict detection works
  - Test strategy: Add conflicting sizes to cart, verify warning generated

- [ ] Build colorway extraction pipeline (depends on: [Catalog Ingestion])
  - Acceptance criteria: Dominant colors extracted from 95%+ of product images
  - Test strategy: Compare extracted colors against manual tagging for 50 products

- [ ] Build admin Knowledge Graph Editor UI (depends on: [shadcn/ui, Taxonomy, Relationships])
  - Acceptance criteria: Merchants can view, edit, and override all classifications and relationships
  - Test strategy: Manual QA walkthrough of all editor flows

**Exit Criteria**: Every product in the catalog is classified, related, sized, and color-mapped. Admin can review and edit everything.

**Delivers**: The intelligence foundation. Not user-facing yet, but the data layer every feature depends on.

---

### Phase 2: Cart Analysis & Recommendations (Weeks 6-8)

**Goal**: Build the intelligence engine that analyzes carts and generates recommendations.

**Entry Criteria**: Phase 1 complete (knowledge graph populated).

**Tasks**:

- [ ] Implement kit completeness detection (depends on: [Taxonomy, Relationships])
  - Acceptance criteria: Correctly identifies discipline and missing items for 10 test cart scenarios
  - Test strategy: Automated test suite with predefined carts and expected outputs

- [ ] Implement size conflict detection (depends on: [Size Intelligence])
  - Acceptance criteria: Detects all 5 predefined conflict scenarios, zero false positives on 10 valid carts
  - Test strategy: Unit tests with conflict/non-conflict cart fixtures

- [ ] Implement bundle detection engine (depends on: [Relationships, DB])
  - Acceptance criteria: Matches carts to bundles, calculates correct discounts
  - Test strategy: Test with partial and full bundle carts

- [ ] Implement threshold optimization (depends on: [Relationships, Kit Completeness])
  - Acceptance criteria: Suggests relevant products within budget gap, never irrelevant items
  - Test strategy: Test with various gap amounts and cart contexts

- [ ] Implement style coherence scoring (depends on: [Colorway Extraction, Relationships])
  - Acceptance criteria: Scores reflect visual coherence, swap suggestions improve score
  - Test strategy: A/B comparison with human coherence judgments

- [ ] Build recommendation orchestrator (depends on: [all above intelligence modules])
  - Acceptance criteria: Single API call returns combined recommendations ordered by priority
  - Test strategy: Integration test with full cart scenario

- [ ] Build customer profile manager (depends on: [DB, Shopify Auth])
  - Acceptance criteria: Profiles persist across sessions for logged-in users, session-based for anonymous
  - Test strategy: Login flow test, verify profile carries across sessions

- [ ] Build admin Bundle Manager UI (depends on: [shadcn/ui, Bundle Engine])
  - Acceptance criteria: Full CRUD for bundle rules, preview mode works
  - Test strategy: Create, edit, delete bundles, verify discount applies

**Exit Criteria**: The recommendation API returns accurate, prioritized recommendations for any cart state.

**Delivers**: Backend intelligence ready for frontend integration.

---

### Phase 3: Storefront Experience (Weeks 9-12)

**Goal**: Build all user-facing storefront components: cart UI, chat sidebar, visual preview, checkout extensions.

**Entry Criteria**: Phase 2 complete (recommendation API working).

**Tasks**:

- [ ] Build storefront widget React bundle (depends on: [Recommendation API, shadcn/ui])
  - Acceptance criteria: Self-mounting widget renders recommendation cards, kit completeness bar, size warnings in any Shopify theme
  - Test strategy: Test in Dawn theme and 2 other popular themes

- [ ] Implement AI chat endpoint with tools (depends on: [AI Provider Config, Recommendation Orchestrator])
  - Acceptance criteria: Streaming chat responses, tool calls for cart manipulation work with confirmation flow
  - Test strategy: Automated conversation tests for 10 scenarios (beginner, expert, gift buyer, budget-constrained)

- [ ] Build conversational UI with useChat (depends on: [Chat endpoint, Storefront widget])
  - Acceptance criteria: Chat renders inline in cart with streaming responses, generative UI components (product cards, comparisons) render correctly
  - Test strategy: Manual QA of chat flows, verify tool UI rendering

- [ ] Build visual kit preview compositor (depends on: [Colorway Extraction, Catalog])
  - Acceptance criteria: Composite images render within 500ms, correct layout per discipline
  - Test strategy: Generate previews for 5 discipline-specific carts, visual QA

- [ ] Create Theme App Extension (depends on: [Storefront widget])
  - Acceptance criteria: App block appears in theme editor, activates on cart open
  - Test strategy: Install on dev store, configure via theme editor

- [ ] Create Checkout UI Extension (depends on: [Size Conflicts, Bundles])
  - Acceptance criteria: Size warnings display at checkout, bundle offers render, bundle under 64KB
  - Test strategy: Walk through checkout with conflict cart, verify warnings shown

- [ ] Create Discount Shopify Function (depends on: [Bundle Engine])
  - Acceptance criteria: Automatic discounts apply when bundle criteria met
  - Test strategy: Add bundle items to cart, verify discount at checkout

- [ ] Create Cart Transform Function (depends on: [Bundle Engine])
  - Acceptance criteria: Bundle items merge into single line item with breakdown
  - Test strategy: Verify cart display with bundle items

- [ ] Build admin Analytics Dashboard (depends on: [shadcn/ui, DB])
  - Acceptance criteria: Real-time KPI display, recommendation performance tracking
  - Test strategy: Generate test events, verify dashboard updates

- [ ] Build admin AI Configuration UI (depends on: [shadcn/ui, AI Config])
  - Acceptance criteria: Merchants can adjust tone, aggressiveness, and test changes in preview mode
  - Test strategy: Change settings, verify AI behavior changes in chat preview

**Exit Criteria**: Complete storefront experience running on a development store with all features functional.

**Delivers**: Full MVP ready for beta testing with a real merchant.

---

### Phase 4: Optimization & Learning (Weeks 13-16)

**Goal**: Add feedback loops, A/B testing, and advanced personalization.

**Entry Criteria**: Phase 3 complete (MVP deployed on test store).

**Tasks**:

- [ ] Implement replenishment prediction (depends on: [Customer Profile, DB])
  - Acceptance criteria: Accurate predictions for 3+ product categories based on historical data
  - Test strategy: Backtest against historical purchase data

- [ ] Build A/B testing framework (depends on: [Analytics, Recommendations])
  - Acceptance criteria: Can run A/B tests on recommendation strategies, measure statistical significance
  - Test strategy: Run simulated A/B test with known outcomes

- [ ] Integrate return data for size learning (depends on: [Size Intelligence, Customer Profile])
  - Acceptance criteria: Size recommendations improve after processing return data
  - Test strategy: Feed return data, verify recommendation changes

- [ ] Performance optimization (depends on: [all modules])
  - Acceptance criteria: Recommendation API < 200ms p95, chat first-token < 500ms, kit preview < 500ms
  - Test strategy: Load testing with k6 or similar

- [ ] Build merchant onboarding wizard (depends on: [Knowledge Graph, Admin UIs])
  - Acceptance criteria: New merchant can go from install to live in < 2 hours
  - Test strategy: Time a complete onboarding flow

**Exit Criteria**: Production-ready application with feedback loops and performance targets met.

**Delivers**: Complete product ready for production deployment and merchant onboarding.

</implementation-roadmap>

---

<test-strategy>

## Test Pyramid

```
        /\
       /E2E\         ← 10% (Full storefront flows in Playwright)
      /------\
     /Integration\   ← 30% (API routes, Shopify API mocking, DB queries)
    /------------\
   /  Unit Tests  \  ← 60% (Pure logic: classification, scoring, conflict detection)
  /----------------\
```

## Coverage Requirements

- Line coverage: 80% minimum
- Branch coverage: 75% minimum
- Function coverage: 85% minimum
- Statement coverage: 80% minimum

## Critical Test Scenarios

### Knowledge Graph
**Happy path**: Product syncs correctly, classified as Boxing > Protection > Gloves
**Edge cases**: Product with no description, product in multiple disciplines, product with no images
**Error cases**: Shopify API rate limit during sync, webhook delivery failure, LLM classification timeout
**Integration**: Full sync → classification → relationship mapping pipeline

### Cart Intelligence
**Happy path**: Boxing gloves in cart → detects boxing kit → recommends hand wraps, mouthguard
**Edge cases**: Cart with items from 3 different disciplines, empty cart, single item cart, cart with 20+ items
**Error cases**: Knowledge graph not yet populated, product not in graph, recommendation API timeout
**Integration**: Cart change → analysis → recommendation → storefront display

### Conversational AI
**Happy path**: "Is everything in my cart right for Muay Thai?" → AI audits cart, suggests shin guards
**Edge cases**: Non-English queries, off-topic queries, abusive messages
**Error cases**: LLM provider down (fallback to rule-based), tool execution failure, streaming disconnect
**Integration**: User message → streaming response → tool call → cart modification → UI update

### Checkout Extensions
**Happy path**: Size conflict detected → warning shown at checkout → customer corrects
**Edge cases**: No conflicts (extension renders nothing), multiple conflicts, bundle + conflict simultaneously
**Error cases**: Extension fails to load (graceful fallback), Shopify Function execution error
**Integration**: Cart with issues → checkout → extension renders → customer action → resolution

### Shopify Functions
**Happy path**: Full bundle in cart → discount applied automatically
**Edge cases**: Partial bundle (no discount), two overlapping bundles, bundle + discount code simultaneously
**Error cases**: Function execution timeout (10ms limit), invalid metafield data
**Integration**: Cart → function evaluation → discount display → checkout completion

## Test Generation Guidelines

- All knowledge graph classification tests should use fixtures from real Venum product data
- Cart intelligence tests should cover all 5 disciplines and 4 personas
- AI tool tests should mock LLM responses for deterministic testing
- Shopify Function tests must verify Wasm compilation and execution within 10ms budget
- Use Shopify's testing utilities for extension tests (checkout-ui-extensions-run)

</test-strategy>

---

<architecture>

## System Components

```
┌─────────────────────────────────────────────────────────┐
│                    SHOPIFY STORE                         │
│                                                          │
│  ┌──────────────────┐   ┌──────────────────────────┐    │
│  │ Theme App        │   │ Checkout UI Extension    │    │
│  │ Extension        │   │ (size warnings,          │    │
│  │ (ai-cart block   │   │  bundle offers)          │    │
│  │  loads widget)   │   │                          │    │
│  └────────┬─────────┘   └────────────┬─────────────┘    │
│           │                          │                   │
│  ┌────────┴──────────────────────────┘                   │
│  │  Shopify Functions (Wasm)                             │
│  │  ├── Discount Function (auto bundle discounts)        │
│  │  └── Cart Transform (bundle line merging)             │
│  └───────────────────────────────────────────────────────│
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │  HTTPS / Streaming
                       ▼
         ┌─────────────────────────────────┐
         │     VERCEL (App Backend)         │
         │     React Router 7 + AI SDK     │
         │                                  │
         │  ┌────────────────────────────┐  │
         │  │ API Routes                 │  │
         │  │ ├── /api/ai/chat           │  │  ← Streaming (AI SDK)
         │  │ ├── /api/ai/recommendations│  │  ← JSON
         │  │ ├── /api/ai/kit-preview    │  │  ← Image URL
         │  │ ├── /api/storefront/cart   │  │  ← Cart proxy
         │  │ └── /api/webhooks          │  │  ← Shopify webhooks
         │  └────────────────────────────┘  │
         │                                  │
         │  ┌────────────────────────────┐  │
         │  │ Core Libraries             │  │
         │  │ ├── Knowledge Graph        │  │
         │  │ ├── Cart Intelligence      │  │
         │  │ ├── AI Tools & Prompts     │  │
         │  │ └── Visual Compositor      │  │
         │  └────────────────────────────┘  │
         │                                  │
         │  ┌────────────────────────────┐  │
         │  │ Admin Dashboard (SSR)      │  │
         │  │ React Router + shadcn/ui   │  │
         │  └────────────────────────────┘  │
         └──────────────┬───────────────────┘
                        │
         ┌──────────────┼──────────────────┐
         │              │                  │
    ┌────▼─────┐  ┌─────▼──────┐  ┌───────▼──────┐
    │PostgreSQL │  │  OpenAI /  │  │  Vercel Blob │
    │+ pgvector │  │  Anthropic │  │  (images)    │
    │(Neon /    │  │  APIs      │  │              │
    │Vercel PG) │  └────────────┘  └──────────────┘
    └──────────┘
```

## Data Models

### Core Tables (Prisma Schema)

**Session** — Shopify session storage (standard Shopify template table)

**Product** — Synced product data
- id, shopifyId, title, description, handle, vendor, productType, status
- disciplineTags (JSON array), categoryTags (JSON array), classificationConfidence (float)
- dominantColors (JSON array), collectionIds (JSON array)
- embedding (vector(1536))
- syncedAt, createdAt, updatedAt

**ProductVariant** — Product variants with size data
- id, shopifyVariantId, productId (FK), title, sku, price, compareAtPrice
- sizeValue, sizeCategory (S/M/L/XL or oz or waist), sizeNumeric (float nullable)
- inventoryQuantity, imageUrl

**ProductRelationship** — Relationship graph edges
- id, sourceProductId (FK), targetProductId (FK)
- relationshipType (COMPLEMENTS | UPGRADES | ALTERNATIVE | CONFLICTS | SAME_COLLECTION)
- weight (float 0-1), source (AUTO | MERCHANT | COPURCHASE)
- createdAt

**BundleRule** — Merchant-defined bundle configurations
- id, shopId, name, description, status (ACTIVE | DRAFT | ARCHIVED)
- minimumItems (int), discountType (PERCENTAGE | FIXED), discountValue (float)
- bundleProducts (JSON array of product/variant IDs with required/optional flags)

**CustomerProfile** — Persistent customer data
- id, shopifyCustomerId (nullable), sessionId (for anonymous)
- disciplines (JSON array), experienceLevel, weightClass
- sizeProfile (JSON: {gloves: "16oz", shorts: "M", rashguard: "L"})
- purchaseHistory (JSON summary), lastActiveAt

**CartAnalyticsEvent** — Analytics tracking
- id, shopId, sessionId, eventType (RECOMMENDATION_SHOWN | RECOMMENDATION_CLICKED | BUNDLE_COMPLETED | CHAT_STARTED | SIZE_WARNING_SHOWN)
- payload (JSON), createdAt

**ChatSession** — Conversation history
- id, shopId, customerProfileId (FK), messages (JSON array)
- cartModifications (JSON array), resolvedAt, createdAt

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| App Framework | React Router | 7.x |
| App Package | @shopify/shopify-app-react-router | Latest |
| App Template | shopify-app-template-react-router | Latest |
| UI Framework | React | 19.x |
| Admin UI — Standard pages | @shopify/polaris + @shopify/app-bridge-react | 13.x / 4.x |
| Admin UI — Custom components | shadcn/ui + Tailwind CSS | v4 |
| Shopify Admin iframe bridge | @shopify/app-bridge-react | 4.x |
| AI SDK | Vercel AI SDK | 6.x (ai, @ai-sdk/react, @ai-sdk/openai, @ai-sdk/anthropic) |
| ORM | Prisma | 6.x |
| Database | PostgreSQL + pgvector | 16+ |
| Hosting | Vercel (Serverless + Edge) | — |
| Image Processing | Sharp | 0.33.x |
| Validation | Zod | 3.x |
| Language | TypeScript | 5.x |
| Shopify API Version | Admin GraphQL API + Storefront API | **2025-04** (pinned, upgrade annually) |
| Shopify Billing | Shopify Billing API via appSubscriptionCreate | via @shopify/shopify-app-react-router |
| Shopify App Proxy | `/apps/cartmind/*` → Vercel backend | Configured in shopify.app.toml |
| Shopify Extensions | Theme App Extension, Checkout UI Extension, Shopify Functions (JS→Wasm via Javy) | Latest |
| Checkout UI Components | @shopify/checkout-ui-extensions-react (ONLY — no shadcn/ui, no custom HTML) | Latest |
| Storefront Widget Build | Vite (library mode) | 6.x |
| LLM Providers | OpenAI (GPT-4o), Anthropic (Claude Sonnet) | Latest |

### Technology Decisions

**Decision: React Router 7 (not Next.js)**
- **Rationale**: Shopify's official app template uses React Router 7. First-class support for Shopify OAuth, session management, and Admin API. Shopify CLI integration.
- **Trade-offs**: Smaller community than Next.js for AI use cases. AI SDK UI's useChat works with React (framework-agnostic) so no limitation.
- **Alternatives considered**: Next.js (no official Shopify template), Remix (merged into React Router 7).

**Decision: Vercel AI SDK v6**
- **Rationale**: Native streaming, structured outputs, tool calling with generative UI, provider-agnostic. useChat hook works with any React app (not Next.js-specific). Transport layer supports custom API endpoints.
- **Trade-offs**: Vercel ecosystem lock-in for some features (though core SDK is open source).
- **Alternatives considered**: LangChain.js (heavier, less UI-focused), direct OpenAI SDK (no streaming UI hooks, no provider abstraction).

**Decision: Polaris + shadcn/ui hybrid (not shadcn/ui alone)**
- **Rationale**: Polaris (`@shopify/polaris`) is mandatory for standard admin surfaces to pass Shopify App Store review and maintain visual consistency in the Shopify Admin iframe. shadcn/ui is used only for custom complex components where Polaris is insufficient.
- **Scope split**:
  - **Polaris**: App navigation (`AppProvider`, `Frame`, `Navigation`), standard admin pages (resource lists, page layouts, data tables, modals, toasts, action lists). Any page the merchant sees in its entirety.
  - **shadcn/ui**: AI chat interface (conversational sidebar), knowledge graph visualizer (interactive graph), analytics charts (recharts wrappers), any custom UI that has no Polaris equivalent.
  - **Strictly prohibited in Checkout UI Extensions**: both Polaris and shadcn/ui — use `@shopify/checkout-ui-extensions-react` only.
- **Trade-offs**: Two component systems increase CSS complexity. Mitigated by Tailwind v4 CSS-in-JS isolation and strict scope rules.
- **Alternatives considered**: Polaris-only (blocks chat UI customization, no charting primitives), shadcn/ui-only (fails App Store review for inconsistent admin styling), Material UI (heavy, no Shopify alignment).

**Decision: App Bridge (`@shopify/app-bridge-react`)**
- **Rationale**: Required for the admin app embedded in Shopify Admin iframe. Handles: session token refresh, navigation bar, modals that appear outside the iframe, toast notifications, ResourcePicker (product/variant selector), ContextualSaveBar. Without it, the admin app cannot access Shopify Admin's native UI primitives.
- **Implementation**: `@shopify/shopify-app-react-router` automatically initializes App Bridge in the app root. Explicit usage needed for: `ResourcePicker` (bundle rule manager product selection), `Toast`, `ContextualSaveBar` (unsaved changes warning), `Modal` (confirmations).
- **Trade-offs**: Adds ~50KB to admin bundle. Unavoidable for any properly embedded Shopify app.
- **Alternatives considered**: None — App Bridge is required by Shopify for embedded admin apps.

**Decision: Shopify API Version pinned to `2025-04`**
- **Rationale**: Shopify releases API versions quarterly. Unpinned apps risk breaking changes. `2025-04` includes stable Cart Transform, Checkout UI Extensions v2, and the latest Discount Functions API.
- **Implementation**: Set `api_version = "2025-04"` in `shopify.app.toml`. Configure in `shopify.server.ts` for all GraphQL clients. Review and migrate to new version annually (Shopify supports versions for 12 months after release).
- **Trade-offs**: Must actively maintain and upgrade versions. Missing new features until upgrade.
- **Alternatives considered**: `latest` alias (too risky for production — breaking changes on Shopify's release cycle).

**Decision: App Proxy for storefront widget → backend communication**
- **Rationale**: The storefront widget (injected via Theme App Extension) needs to call the CartMind backend for recommendations and AI chat. App Proxy solves authentication: Shopify forwards requests from `/apps/cartmind/*` to the Vercel backend, signing each request with an HMAC signature that the backend can verify. This avoids CORS complexity and exposes no public unauthenticated endpoints.
- **Implementation**: Configure `[app_proxy]` in `shopify.app.toml` with `url = "https://app.cartmind.io"` and `subpath = "apps/cartmind"`. The `api.app-proxy.tsx` route verifies the `signature` query param on every request. Widget calls `/apps/cartmind/recommendations` and `/apps/cartmind/chat` — Shopify proxies them to the backend.
- **Storefront API**: Cart mutations (add/remove items) are called directly from the widget using the **public Storefront API** with the store's `storefront_access_token` — these don't need proxying as they are designed for public access.
- **Trade-offs**: App Proxy adds ~100ms latency (Shopify → backend round trip). Not suitable for streaming — the AI chat streaming endpoint requires a direct WebSocket/SSE connection, bypassing App Proxy. Chat uses a CORS-enabled endpoint on the backend with a short-lived token issued by the App Proxy session.
- **Alternatives considered**: Direct CORS (requires managing CORS headers and public endpoint security), Storefront API only (insufficient for backend AI calls).

**Decision: Shopify Billing API**
- **Rationale**: CartMind is a paid Shopify app. All billing must go through Shopify's Billing API (`appSubscriptionCreate`) — direct credit card collection is prohibited by Shopify Partner agreements. Billing through Shopify simplifies merchant trust (one bill) and enables App Store distribution.
- **Implementation**: On first app load, check `app.billing.tsx` for active subscription. If none, redirect to subscription page. Use `@shopify/shopify-app-react-router`'s built-in billing helpers. Define plans: `Starter` (up to 1,000 products), `Growth` (up to 10,000 products), `Enterprise` (unlimited + priority support). Plans stored as constants, not in DB.
- **Trade-offs**: 20% revenue share to Shopify for App Store apps. Direct billing relationships bypass this but require merchants to trust a separate billing system.
- **Alternatives considered**: Stripe direct (violates Shopify Partner terms for App Store apps), free tier only (not sustainable).

**Decision: PostgreSQL + pgvector (not dedicated vector DB)**
- **Rationale**: Single database for relational data AND vector similarity search. Simpler ops. pgvector performance is sufficient for catalog-scale vectors (10K-100K products). Prisma supports PostgreSQL natively.
- **Trade-offs**: Not as performant as Pinecone/Weaviate for million-scale vectors (not needed for product catalogs).
- **Alternatives considered**: Pinecone (separate service, higher cost), Supabase (good option but adds another vendor).

**Decision: Vercel for hosting**
- **Rationale**: Native React Router 7 support via @vercel/react-router preset. Serverless functions for API routes. Edge network for static assets and widget delivery. Vercel Postgres option for database. Vercel Blob for image storage.
- **Trade-offs**: Serverless cold starts may affect first request latency (mitigated by keeping functions warm). No persistent server for long-running tasks (use Vercel Cron or external queue).
- **Alternatives considered**: Fly.io (persistent server but more ops), Railway (good but less edge coverage), Heroku (dated).

</architecture>

---

<risks>

## Technical Risks

**Risk**: Vercel serverless cold starts cause slow first recommendation or webhook timeout
- **Impact**: Medium — degraded UX for first visitor; Shopify drops webhooks not acknowledged within 5 seconds
- **Likelihood**: Medium
- **Mitigation**: Webhook handlers must respond with HTTP 200 **immediately** and defer processing using `waitUntil()` (Vercel's background task API) or a queue (e.g., Vercel KV + cron). Recommendation API uses aggressive caching in Vercel KV. Pre-compute recommendations on webhook events, not on storefront request.
- **Fallback**: Show cached/static recommendations while fresh ones load. Progressive enhancement.

**Risk**: Shopify Function 10ms execution limit is too tight for complex bundle logic
- **Impact**: High — discounts won't apply if function times out
- **Likelihood**: Medium
- **Mitigation**: Keep function logic minimal — lookup pre-computed bundle matches from metafields rather than computing in the function. Pre-compute on cart update webhook.
- **Fallback**: Apply discounts via Shopify's standard automatic discount system instead of Functions.

**Risk**: LLM hallucination in conversational sidebar recommends wrong products
- **Impact**: High — trust damage if AI suggests products that don't exist or gives wrong size advice
- **Likelihood**: Medium
- **Mitigation**: Constrain LLM to only reference products in the knowledge graph via tool calls. Never let the LLM generate product names/prices from its own knowledge. Structured outputs with Zod validation.
- **Fallback**: Fall back to rule-based recommendations if LLM confidence is low.

**Risk**: Theme App Extension JavaScript conflicts with merchant's theme
- **Impact**: Medium — broken storefront experience
- **Likelihood**: Low-Medium
- **Mitigation**: Build storefront widget as a shadow DOM encapsulated component. Use unique CSS class prefixes. Test against top 10 Shopify themes.
- **Fallback**: Offer an iframe-based alternative for incompatible themes.

**Risk**: Checkout UI Extension 64KB bundle limit restricts functionality
- **Impact**: Medium — can't fit all checkout features
- **Likelihood**: Low
- **Mitigation**: Keep checkout extension minimal (warnings + simple bundle offers). Heavy logic stays on the backend. Extension only renders pre-computed data.
- **Fallback**: Split into multiple smaller extensions targeting different checkout points.

**Risk**: Shopify App Store review rejection for non-Polaris admin UI
- **Impact**: High — app blocked from App Store distribution
- **Likelihood**: Medium — Shopify's review team checks UI consistency in the admin iframe
- **Mitigation**: Use Polaris (`@shopify/polaris`) for all standard admin surfaces: navigation, page layouts, resource lists, modals, data tables. shadcn/ui is restricted to components with no Polaris equivalent (AI chat panel, interactive graph, analytics charts). App Bridge must be initialized at the app root. All admin pages must pass Shopify's Built for Shopify checklist before submission.
- **Fallback**: If specific shadcn/ui components are flagged, replace with Polaris equivalents or use Polaris as a wrapper shell around the custom content.

**Risk**: Storefront widget CORS errors or unauthenticated backend calls
- **Impact**: High — recommendations and chat stop working on storefront
- **Likelihood**: Medium — storefront domain ≠ backend domain = CORS by default
- **Mitigation**: All non-streaming storefront requests route through App Proxy (`/apps/cartmind/*`), which Shopify proxies with HMAC signing — no CORS needed. Streaming SSE for AI chat bypasses App Proxy and requires explicit CORS headers in `api.ai.chat.tsx` limited to the merchant's `myshopify.com` and custom domains. Storefront cart mutations use the public Storefront API directly (designed for CORS access).
- **Fallback**: Disable streaming, use polling for chat responses via App Proxy if CORS issues persist on certain themes/CSP configurations.

## Dependency Risks

**Risk**: OpenAI/Anthropic API downtime kills conversational features
- **Impact**: High — chat sidebar completely broken
- **Likelihood**: Low
- **Mitigation**: Vercel AI SDK provider registry enables instant provider failover. Configure primary (OpenAI) + fallback (Anthropic) + emergency (rule-based).
- **Fallback**: Degrade gracefully to rule-based recommendations only. Hide chat sidebar when AI is unavailable.

**Risk**: Shopify API rate limits during high-traffic events (BFCM)
- **Impact**: High — recommendations stop working during peak revenue period
- **Likelihood**: Medium
- **Mitigation**: Aggressive caching of product data. Reduce real-time API calls by pre-computing on webhooks. Use Storefront API (higher rate limits) for customer-facing features.
- **Fallback**: Serve cached recommendations. Queue non-critical updates.

## Scope Risks

**Risk**: Knowledge graph manual curation is too much work for merchants
- **Impact**: High — merchants won't complete setup, app unused
- **Likelihood**: Medium
- **Mitigation**: Auto-generate 90%+ of the knowledge graph using LLM classification. Highlight only low-confidence items for review. Provide discipline templates (Boxing Kit, MMA Kit) as starting points.
- **Fallback**: Offer a "managed onboarding" service for enterprise merchants.

**Risk**: Feature scope creep delays MVP
- **Impact**: High — delayed revenue
- **Likelihood**: High
- **Mitigation**: Strict phase-gating. Phase 3 delivers a complete MVP. Phases 4+ are enhancements. Do not start Phase 4 features until Phase 3 is deployed and tested with a real merchant.
- **Fallback**: Ship Phase 2 as a "lite" version (recommendations only, no chat) if Phase 3 takes longer than planned.

</risks>

---

<appendix>

## References

- [Shopify React Router App Template](https://github.com/Shopify/shopify-app-template-react-router)
- [Vercel AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
- [Vercel AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui)
- [Vercel React Router Deployment](https://vercel.com/docs/frameworks/frontend/react-router)
- [Shopify Theme App Extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [Shopify Checkout UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Shopify Functions](https://shopify.dev/docs/apps/build/functions)
- [Shopify Storefront API Cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart)
- [shadcn/ui](https://ui.shadcn.com)
- [pgvector](https://github.com/pgvector/pgvector)

## Glossary

| Term | Definition |
|------|-----------|
| AOV | Average Order Value — total cart value divided by number of orders |
| Knowledge Graph | Structured representation of product relationships, attributes, and domain knowledge |
| Kit | A set of products that together form a complete setup for a specific discipline (e.g., "Boxing Starter Kit") |
| Discipline | A specific combat sport or activity (Boxing, Muay Thai, BJJ, MMA, Fitness) |
| Shopify Function | Server-side WebAssembly function that runs on Shopify's infrastructure to customize backend logic |
| Theme App Extension | Shopify mechanism for apps to inject UI into a merchant's online store theme |
| Checkout UI Extension | Shopify mechanism for apps to add custom UI at checkout |
| Generative UI | Pattern where an LLM generates structured tool calls that map to React components, creating dynamic interfaces |
| pgvector | PostgreSQL extension for vector similarity search, used for semantic product matching |
| Cart Transform | Shopify Function that expands a single bundle product line into its component product lines at checkout |
| App Proxy | Shopify mechanism that forwards storefront requests from `/apps/{subpath}/*` to the app backend, signing each request with HMAC for authentication |
| App Bridge | Shopify JavaScript library (`@shopify/app-bridge-react`) that enables embedded admin apps to communicate with the Shopify Admin host (session tokens, modals, ResourcePicker, navigation) |
| Polaris | Shopify's official React design system (`@shopify/polaris`) for building admin UIs that are consistent with the Shopify Admin interface |
| Billing API | Shopify's server-side API for managing app subscriptions — all paid app billing must go through this API per Shopify Partner terms |

## Open Questions

1. **Shopify Plus requirement**: Checkout UI Extensions for information/shipping/payment steps require Shopify Plus. Should we build a degraded experience for non-Plus stores?
2. **Multi-language support**: Venum operates globally. When should we add i18n for the conversational AI? Phase 3 or Phase 4?
3. **Privacy/GDPR**: Customer profiling (even lightweight) requires consent in the EU. How do we handle the consent flow within the Shopify theme context?
4. **Pricing model**: Per-store monthly SaaS fee? Usage-based (per AI conversation)? Hybrid? This affects architecture (metering, billing).
5. **Venum as first customer**: Should we build as a Venum-only custom app first, or design for multi-tenant from day one? Recommendation: multi-tenant from day one with Venum-specific templates.
6. **Widget delivery**: Should the storefront widget be delivered as a Theme App Extension asset or via external CDN? Theme extension keeps everything in Shopify's ecosystem but has update latency.

</appendix>

---

<task-master-integration>

## How Task Master Uses This PRD

When you run `task-master parse-prd prd-cartmind.md`, the parser:

1. **Extracts capabilities** → Main tasks (Product Knowledge Graph, Cart Intelligence Engine, Conversational Cart Sidebar, Visual Kit Preview, Merchant Admin Dashboard, Shopify Storefront Integration)
2. **Extracts features** → Subtasks (22 features across 6 capabilities)
3. **Parses dependencies** → Task dependencies from the Dependency Chain section
4. **Orders by phases** → Phase 0 = highest priority, Phase 4 = lowest
5. **Uses test strategy** → Feeds test scenarios to test generation during implementation

**Result**: A dependency-aware task graph with ~35 tasks that can be executed in topological order across 5 phases.

</task-master-integration>
