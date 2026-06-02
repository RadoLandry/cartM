# Data Model: Kit Composition Renderer

## Entities

## 1. KitPreviewRequest
- Purpose: Represents one preview generation or retrieval request for a specific cart snapshot.
- Fields:
  - requestId: string (unique)
  - shopDomain: string
  - sessionId: string
  - cartId: string
  - requestedAt: datetime
  - surface: enum (cart_drawer, cart_page, chat)
  - viewportHint: enum (mobile, desktop, unknown)
- Validation:
  - cartId, shopDomain, and sessionId are required.
  - surface must be one of the defined enum values.

## 2. CartSnapshot
- Purpose: Canonicalized cart representation used as composition input and cache key seed.
- Fields:
  - snapshotId: string
  - cartId: string
  - inferredDiscipline: string | null
  - items: CartSnapshotItem[]
  - subtotalAmount: decimal
  - currencyCode: string
  - normalizedAt: datetime
- Validation:
  - items length >= 0.
  - item ordering deterministic by stable sort key.
  - currencyCode must be present when subtotalAmount is provided.

## 3. CartSnapshotItem
- Purpose: Normalized renderable line item used by composition engine.
- Fields:
  - lineId: string
  - productId: string
  - variantId: string
  - title: string
  - quantity: integer
  - imageUrl: string | null
  - renderEligibility: enum (eligible, ineligible)
  - ineligibleReason: string | null
  - visualRole: string | null
- Validation:
  - quantity >= 1.
  - eligible items must provide imageUrl.

## 4. LayoutProfile
- Purpose: Defines spatial template rules for arranging eligible items in output.
- Fields:
  - layoutId: string
  - discipline: string | null
  - templateVersion: string
  - slotDefinitions: LayoutSlot[]
  - fallbackRank: integer
- Validation:
  - templateVersion required.
  - slotDefinitions must have unique slot keys.

## 5. ComposedPreviewAsset
- Purpose: Final generated preview artifact and metadata.
- Fields:
  - assetId: string
  - assetUrl: string
  - mimeType: enum (image/png, image/webp)
  - width: integer
  - height: integer
  - generatedAt: datetime
  - generationMs: integer
  - sourceSnapshotSignature: string
- Validation:
  - width and height > 0.
  - sourceSnapshotSignature required.

## 6. PreviewReuseRecord
- Purpose: Lookup record linking deterministic request signature to a previously generated asset.
- Fields:
  - cacheKey: string
  - snapshotSignature: string
  - layoutId: string
  - templateVersion: string
  - assetId: string
  - createdAt: datetime
  - expiresAt: datetime | null
- Validation:
  - cacheKey unique per active record.
  - assetId must reference an existing ComposedPreviewAsset.

## 7. OmissionReportEntry
- Purpose: Captures items excluded from composition and the reason.
- Fields:
  - lineId: string
  - reasonCode: enum (missing_image, unsupported_type, fetch_failed, invalid_variant)
  - reasonDetail: string | null
- Validation:
  - reasonCode required.
  - lineId must exist in CartSnapshot.items.

## Relationships
- KitPreviewRequest 1:1 CartSnapshot (for each evaluated request).
- CartSnapshot 1:N CartSnapshotItem.
- LayoutProfile 1:N CartSnapshotItem placement decisions.
- CartSnapshot + LayoutProfile -> ComposedPreviewAsset.
- PreviewReuseRecord N:1 ComposedPreviewAsset.
- ComposedPreviewAsset 0:N OmissionReportEntry.

## State Transitions

## Request lifecycle
1. received -> request accepted with minimally valid identifiers.
2. normalized -> canonical CartSnapshot generated.
3. cache_lookup -> lookup by snapshot signature + layout profile + template version.
4. cache_hit -> existing asset returned.
5. cache_miss -> composition started.
6. composed -> new asset generated.
7. persisted -> asset and reuse record stored.
8. returned -> response sent with asset and omission metadata.
9. failed -> fallback response returned with reason and optional partial output.

## Asset lifecycle
1. generated -> newly composed and stored.
2. active -> eligible for reuse via PreviewReuseRecord.
3. superseded -> older templateVersion or changed snapshot no longer selected by lookup.
4. expired -> optional TTL reached and removed from active lookup.
