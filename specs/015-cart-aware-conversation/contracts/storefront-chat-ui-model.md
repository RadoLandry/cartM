# Contract: Storefront Chat UI Model

## Purpose

Defines the discriminated client model used by the widget to render streamed assistant output safely and consistently.

## Message Model

ChatThreadMessage:
- messageId: string
- role: user | assistant | system
- content: string
- state: pending | streaming | complete | failed
- guidanceBlocks: StructuredGuidanceBlock[]
- createdAt: number

Rules:
- user messages are appended immediately after submit.
- assistant placeholder starts pending/streaming and finalizes on message-complete.
- failed assistant messages preserve retry context.

## Guidance Block Model

StructuredGuidanceBlock is a discriminated union keyed by type.

### recommendation_list
- blockId: string
- type: recommendation_list
- title: string
- summary: string
- priority: number
- items: array of recommendation item

Recommendation item:
- productId?: string
- variantId?: string
- title: string
- action: keep | add | remove | swap | size_adjust
- priorityLabel: high | medium | low
- reason: string
- shopperOutcome?: string
- safetyCritical: boolean
- priceLabel?: string
- availability?: available | unavailable | unknown

### comparison_table
- blockId: string
- type: comparison_table
- title: string
- summary: string
- priority: number
- columns: [{ key: string, title: string }]
- rows: [{ label: string, values: string[] }]

### size_summary
- blockId: string
- type: size_summary
- title: string
- summary: string
- priority: number
- confidence: number in [0,1]
- highlights: string[]

### fallback_notice
- blockId: string
- type: fallback_notice
- title: string
- summary: string
- priority: number

## Stream Reconciliation Rules

- text-delta appends to the active assistant message content.
- guidance-block appends to active assistant message guidanceBlocks.
- message-complete sets assistant message state to complete.
- error transitions the assistant message to failed and stores a retryable shopper prompt.

## Rendering Rules

- Unknown block types are not rendered directly; fallback notice is shown.
- Missing optional product or variant IDs still allows block rendering.
- Guidance blocks are ordered by ascending priority then arrival order.
- Recommendation items expose action category and priority labels so UI can present clear shopper actions.
