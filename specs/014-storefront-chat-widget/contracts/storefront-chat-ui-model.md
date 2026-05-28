# Contract: Storefront Chat UI Model

## Purpose

Defines the client-side discriminated unions that the storefront widget must support when rendering the conversation thread.

## Thread Item Model

### UserThreadItem

```json
{
  "kind": "user_message",
  "messageId": "msg-user-1",
  "state": "complete",
  "text": "Do these gloves work for bag training?",
  "createdAt": "2026-05-28T14:00:00.000Z"
}
```

### AssistantThreadItem

```json
{
  "kind": "assistant_message",
  "messageId": "msg-assistant-1",
  "state": "streaming",
  "textParts": ["Yes, those gloves are suited for bag work."],
  "guidanceBlocks": []
}
```

### SystemNoticeItem

```json
{
  "kind": "system_notice",
  "noticeType": "error",
  "message": "Chat is temporarily unavailable. Try again in a moment."
}
```

## Structured Guidance Variants

### RecommendationListBlock

- Required fields: `blockId`, `type = recommendation_list`, `title`, `summary`, `priority`, `items[]`
- Each item may include `productId`, `variantId`, `title`, `reason`, `priceLabel`, and `availability`

### ComparisonTableBlock

- Required fields: `blockId`, `type = comparison_table`, `title`, `summary`, `priority`, `columns[]`, `rows[]`
- Each row defines a shopper-readable dimension and values aligned to the compared products

### SizeSummaryBlock

- Required fields: `blockId`, `type = size_summary`, `title`, `summary`, `priority`, `confidence`, `highlights[]`

### FallbackNoticeBlock

- Required fields: `blockId`, `type = fallback_notice`, `title`, `summary`, `priority`
- Used whenever the client cannot render or safely interpret a richer block

## Rendering Rules

- Unknown `kind` values must render as a safe system notice rather than throwing.
- Unknown `type` values inside `guidanceBlocks` must render using the `FallbackNoticeBlock` presentation.
- Assistant messages and their guidance blocks remain visually grouped in one thread item.
- Streaming text may append incrementally, but completed guidance blocks are inserted in deterministic order by `priority` then arrival order.