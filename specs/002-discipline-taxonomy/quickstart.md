# Quickstart: Discipline & Category Taxonomy

## Getting Started

1. Make sure you have the expected environment tools configured for Prisma.
2. Run `npx prisma generate` and `npx prisma db push` (or `migrate dev`) after merging the schema changes.
3. Classification happens asynchronously. Ensure your background worker or webhook subscriber is running to process unclassified product batches.
4. Verify your OpenAI/Anthropic keys are in the `.env` file since the `classifyProduct` function relies on the `Vercel AI SDK`.

## LLM Classification Limits (T011 Verification)

- **Model**: `openai/gpt-4o-mini` via OpenRouter (resolved through `getPrimaryModel()` in `app/lib/ai/providers.ts`).
- **Schema validation**: Vercel AI SDK `generateObject` enforces the `ClassificationSchema` (disciplines, categories, confidence) via Zod; any model drift is caught at the schema boundary.
- **Failure mode**: `classifyProduct` never throws — it returns `classificationConfidence: 0` with safe fallback tags on any AI error. Callers must check confidence and re-queue when needed.
- **Token budget**: Classification prompts use product title, tags, and description excerpts only. Total prompt stays well under the model context window (< 500 tokens per product).
- **Batch limits**: No batch-level LLM call is used; each product is classified individually. Concurrent product webhook bursts should be rate-controlled via the existing webhook event table deduplication (`eventId` uniqueness).

## Shopify Webhook Timeout Constraints (T011 Verification)

- **Shopify mandatory timeout**: Shopify requires a webhook `200 OK` within **5 seconds**. LLM classification (gpt-4o-mini, ~500 ms p50 on OpenRouter) typically completes within 5 s but is not guaranteed under load.
- **Pattern used**: `processWebhookAsync` in `app/lib/shopify/webhooks.ts` commits the webhook event record first (synchronous Prisma write), returns `200 OK`, then continues async classification. This satisfies the 5-second constraint regardless of LLM latency.
- **Safety net**: When `OPENAI_API_KEY` and `OPENROUTER_API_KEY` are both absent, `isAIAvailable()` returns false and classification is skipped; `classificationConfidence` is set to 0 so the product surfaces in the merchant review queue rather than silently failing.

## Validation Gates (T012)

Run the following before closing any taxonomy-related change:

```powershell
npx vitest run tests/unit/knowledge-graph/llm-classifier.test.ts
```

```powershell
npm run typecheck
```

```powershell
npm run lint
```

Acceptance checklist:
- [ ] `classifyProduct` returns confidence 0 and safe fallback arrays when AI is unavailable.
- [ ] Webhook handler returns `200 OK` before classification runs (verify via `processWebhookAsync` pattern).
- [ ] Low-confidence products (< 0.8) appear in the knowledge graph admin review queue.
- [ ] Manual overrides (`isManuallyClassified: true`) are not re-classified on subsequent webhooks.
- [ ] Taxonomy normalization strips any out-of-enum strings returned by the model.

