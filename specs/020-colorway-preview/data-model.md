# Data Model: Colorway Preview

## Entities

## 1. ColorwayPreviewRequest
- Purpose: Represents a shopper request to compare current kit vs a proposed color swap.
- Fields:
  - requestId: string (unique)
  - shopDomain: string
  - sessionId: string
  - cartId: string
  - selectedLineId: string
  - currentVariantId: string
  - proposedVariantId: string
  - surface: enum (cart_drawer, cart_page, chat)
  - requestedAt: datetime
- Validation:
  - cartId, selectedLineId, and proposedVariantId are required.
  - proposedVariantId must differ from currentVariantId.

## 2. ColorwayPreviewSignature
- Purpose: Deterministic identity for comparison reuse lookups.
- Fields:
  - signature: string
  - cartSnapshotSignature: string
  - selectedLineId: string
  - proposedVariantId: string
  - layoutId: string
  - templateVersion: string
  - outputFormat: enum (image/png, image/webp)
- Validation:
  - signature must be reproducible from normalized inputs.
  - templateVersion is required.

## 3. ComparisonAsset
- Purpose: Stores the current and proposed visual outputs for one comparison state.
- Fields:
  - assetId: string
  - currentAssetUrl: string | null
  - proposedAssetUrl: string | null
  - comparisonAssetUrl: string | null
  - mimeType: enum (image/png, image/webp)
  - width: integer | null
  - height: integer | null
  - generatedAt: datetime
  - generationMs: integer | null
- Validation:
  - At least one of currentAssetUrl, proposedAssetUrl, comparisonAssetUrl must be present for non-error states.

## 4. ChangeHighlight
- Purpose: Encodes what changed so the shopper can quickly interpret comparison.
- Fields:
  - selectedLineId: string
  - fromVariantId: string
  - toVariantId: string
  - changedLabel: string
- Validation:
  - selectedLineId must map to an item in normalized snapshot.

## 5. OmissionReportEntry
- Purpose: Records omitted cart elements and reason categories for partial outputs.
- Fields:
  - lineId: string
  - scope: enum (current, proposed, both)
  - reasonCode: enum (missing_image, unsupported_type, fetch_failed, invalid_variant)
  - reasonDetail: string | null
- Validation:
  - lineId must exist in cart snapshot.
  - reasonCode required.

## 6. PreviewEvent
- Purpose: Captures analytics outcome of preview attempts.
- Fields:
  - eventId: string
  - shopDomain: string
  - sessionId: string
  - status: enum (ok, partial, invalid, fallback, error)
  - reused: boolean
  - latencyMs: integer | null
  - createdAt: datetime
- Validation:
  - status is required.
  - reused is required.

## Relationships
- ColorwayPreviewRequest 1:1 ColorwayPreviewSignature.
- ColorwayPreviewSignature 1:1 or 1:N ComparisonAsset reuse history.
- ComparisonAsset 0:N OmissionReportEntry.
- ColorwayPreviewRequest 1:1 ChangeHighlight.
- ColorwayPreviewRequest 1:N PreviewEvent.

## State Transitions

## Request lifecycle
1. received -> request accepted with identifiers.
2. validated -> swap target and cart membership verified.
3. normalized -> deterministic signature inputs created.
4. reuse_lookup -> existing comparison checked.
5. reused -> prior asset returned.
6. composed -> current/proposed outputs generated.
7. persisted -> comparison asset and metadata stored.
8. returned -> response emitted with highlight and omissions.
9. invalid_or_failed -> clear invalid/fallback/error response returned.

## Asset lifecycle
1. generated -> first successful comparison build.
2. active -> eligible for signature reuse.
3. superseded -> replaced by newer templateVersion context.
4. expired -> optional retention policy removes active reuse entry.
