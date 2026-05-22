# Feature Specification: Discipline & Category Taxonomy

## Objective
Classify every product into discipline(s) (Boxing, Muay Thai, BJJ, MMA, Fitness) and functional categories (Protection, Apparel, Accessories, Equipment).

## Inputs
- Product data (title, description, tags, collections, metafields)
- Merchant-provided taxonomy overrides

## Outputs
- Per-product classification with confidence scores

## Behavior
Use LLM-assisted classification on initial sync, allow merchant overrides via admin UI. Products can belong to multiple disciplines. Store as structured tags in the knowledge graph.
