import type {
  StorefrontCartLine,
  StorefrontCartSnapshot,
  StorefrontGuidancePayload,
  StorefrontGuidanceResponse,
  StorefrontWidgetMountConfig,
  CheckoutGuidanceItem,
  CheckoutGuidanceFeed,
  CheckoutGuidancePlacement,
  BundleStorefrontOutcome,
} from "../ai/schemas";
import {
  StorefrontCartSnapshotSchema,
  StorefrontGuidancePayloadSchema,
  StorefrontWidgetMountConfigSchema,
  CheckoutGuidanceFeedSchema,
} from "../ai/schemas";

export const DEFAULT_STOREFRONT_WIDGET_FEATURES = {
  showRecommendations: true,
  showKitCompleteness: true,
  showSizeWarnings: true,
  showChatEntry: true,
  showReasonTags: true,
} as const;

export const DEFAULT_STOREFRONT_WIDGET_LABELS = {
  launcherLabel: "Ask CartMind",
  panelTitle: "CartMind chat",
  assistantGreeting: "Ask about comparisons, or what works well with the items in your cart.",
  fallbackMessage: "CartMind guidance is temporarily unavailable. Your cart still works normally.",
} as const;

function definedString(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value.trim() : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

export function normalizeStorefrontCartLines(lines: unknown[]): StorefrontCartLine[] {
  return lines
    .map((line) => {
      if (!line || typeof line !== "object") {
        return null;
      }

      const record = line as Record<string, unknown>;
      const productId = definedString(record.productId) ?? definedString(record.product_id);

      if (!productId) {
        return null;
      }

      const quantity = Number(record.quantity ?? 1);

      return {
        ...(definedString(record.lineId) ?? definedString(record.key)
          ? { lineId: definedString(record.lineId) ?? definedString(record.key) }
          : {}),
        productId,
        ...(definedString(record.productTitle) ?? definedString(record.product_title)
          ? { productTitle: definedString(record.productTitle) ?? definedString(record.product_title) }
          : {}),
        ...(definedString(record.variantId) ?? definedString(record.variant_id)
          ? { variantId: definedString(record.variantId) ?? definedString(record.variant_id) }
          : {}),
        ...(definedString(record.variantTitle) ?? definedString(record.variant_title)
          ? { variantTitle: definedString(record.variantTitle) ?? definedString(record.variant_title) }
          : {}),
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      } satisfies StorefrontCartLine;
    })
    .filter((line): line is StorefrontCartLine => line !== null);
}

export function normalizeStorefrontCartSnapshot(input: unknown): StorefrontCartSnapshot {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const parsed = StorefrontCartSnapshotSchema.safeParse({
    cartId: definedString(record.cartId) ?? definedString(record.token),
    currencyCode: definedString(record.currencyCode) ?? definedString(record.currency) ?? "USD",
    items: normalizeStorefrontCartLines(Array.isArray(record.items) ? record.items : []),
  });

  return parsed.success ? parsed.data : { currencyCode: "USD", items: [] };
}

export function parseStorefrontWidgetMountConfig(input: unknown) {
  return StorefrontWidgetMountConfigSchema.safeParse(input);
}

export function buildStorefrontWidgetMountConfig(
  input: Omit<StorefrontWidgetMountConfig, "features" | "labels"> & Partial<Pick<StorefrontWidgetMountConfig, "features" | "labels">>,
): StorefrontWidgetMountConfig {
  return StorefrontWidgetMountConfigSchema.parse({
    ...input,
    labels: {
      ...DEFAULT_STOREFRONT_WIDGET_LABELS,
      ...(input.labels ?? {}),
    },
    features: {
      ...DEFAULT_STOREFRONT_WIDGET_FEATURES,
      ...(input.features ?? {}),
    },
  });
}

export function buildStorefrontGuidancePayload(
  input: Omit<StorefrontGuidancePayload, "payloadId" | "generatedAt"> & Partial<Pick<StorefrontGuidancePayload, "payloadId" | "generatedAt">>,
): StorefrontGuidancePayload {
  return StorefrontGuidancePayloadSchema.parse({
    payloadId: input.payloadId ?? `guidance-${Date.now()}`,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    ...input,
    recommendations: input.recommendations ?? [],
    sizeWarnings: input.sizeWarnings ?? [],
  });
}

export function buildDegradedStorefrontGuidancePayload(input: {
  cartId?: string;
  title?: string;
  message?: string;
} = {}): StorefrontGuidancePayload {
  return buildStorefrontGuidancePayload({
    ...(input.cartId ? { cartId: input.cartId } : {}),
    recommendations: [],
    sizeWarnings: [],
    chatEntry: {
      available: false,
      reasonUnavailable: "guidance_unavailable",
    },
    fallbackNotice: {
      title: input.title ?? "CartMind is unavailable",
      message: input.message ?? DEFAULT_STOREFRONT_WIDGET_LABELS.fallbackMessage,
    },
  });
}

export function buildStorefrontGuidanceResponse(
  payload: StorefrontGuidancePayload,
): StorefrontGuidanceResponse {
  return {
    ok: true,
    payload: StorefrontGuidancePayloadSchema.parse(payload),
  };
}

// ---------------------------------------------------------------------------
// Checkout guidance feed assembly (T037)
// ---------------------------------------------------------------------------

const CHECKOUT_GUIDANCE_PRIORITY_ORDER: Record<CheckoutGuidanceItem["type"], number> = {
  size_warning: 0,
  kit_nudge: 1,
  bundle_offer: 2,
};

const CHECKOUT_GUIDANCE_SEVERITY_ORDER: Record<CheckoutGuidanceItem["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function isGuidanceItemExpired(item: CheckoutGuidanceItem, now: Date): boolean {
  if (!item.expiresAt) return false;
  return new Date(item.expiresAt) <= now;
}

function sortCheckoutGuidanceItems(items: CheckoutGuidanceItem[]): CheckoutGuidanceItem[] {
  return [...items].sort((a, b) => {
    const severityDiff = CHECKOUT_GUIDANCE_SEVERITY_ORDER[a.severity] - CHECKOUT_GUIDANCE_SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;

    const typeDiff = CHECKOUT_GUIDANCE_PRIORITY_ORDER[a.type] - CHECKOUT_GUIDANCE_PRIORITY_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;

    return a.priority - b.priority;
  });
}

export interface CheckoutGuidanceFeedInput {
  shop: string;
  checkoutId?: string;
  cartToken?: string;
  placement?: CheckoutGuidancePlacement;
  projectionVersion: number;
  sizeWarningItems?: CheckoutGuidanceItem[];
  bundleOfferItems?: CheckoutGuidanceItem[];
  kitNudgeItems?: CheckoutGuidanceItem[];
  now?: Date;
}

export function buildCheckoutGuidanceFeed(input: CheckoutGuidanceFeedInput): CheckoutGuidanceFeed {
  const now = input.now ?? new Date();
  const allItems: CheckoutGuidanceItem[] = [
    ...(input.sizeWarningItems ?? []),
    ...(input.bundleOfferItems ?? []),
    ...(input.kitNudgeItems ?? []),
  ].filter((item) => !isGuidanceItemExpired(item, now));

  const sorted = sortCheckoutGuidanceItems(allItems);

  return CheckoutGuidanceFeedSchema.parse({
    shop: input.shop,
    guidanceId: `checkout-guidance-${Date.now()}`,
    ...(input.checkoutId ? { checkoutId: input.checkoutId } : {}),
    ...(input.cartToken ? { cartToken: input.cartToken } : {}),
    generatedAt: now.toISOString(),
    placement: input.placement ?? "purchase_checkout_block",
    items: sorted,
    projectionVersion: input.projectionVersion,
  });
}

export function buildEmptyCheckoutGuidanceFeed(input: {
  shop: string;
  projectionVersion: number;
  placement?: CheckoutGuidancePlacement;
  checkoutId?: string;
  cartToken?: string;
  now?: Date;
}): CheckoutGuidanceFeed {
  return buildCheckoutGuidanceFeed({
    ...input,
    sizeWarningItems: [],
    bundleOfferItems: [],
    kitNudgeItems: [],
  });
}

export type {
  CheckoutGuidanceItem,
  CheckoutGuidanceFeed,
  CheckoutGuidancePlacement,
  BundleStorefrontOutcome,
};

// ---------------------------------------------------------------------------
// Bundle storefront presentation mapping (T047)
// ---------------------------------------------------------------------------

export function buildBundleStorefrontPresentationItems(
  outcomes: BundleStorefrontOutcome[],
): CheckoutGuidanceItem[] {
  const items: CheckoutGuidanceItem[] = [];

  for (const outcome of outcomes) {
    if (outcome.status === "ineligible" || outcome.status === "conflict") continue;

    const presentation = outcome.presentation;
    if (!presentation) continue;

    if (outcome.status === "qualified") {
      const discount = outcome.discount;
      const message = discount
        ? `${presentation.componentSummary} — ${discount.displayLabel}`
        : presentation.componentSummary;

      items.push({
        guidanceId: `bundle_offer_${outcome.outcomeId}`,
        type: "bundle_offer",
        severity: "info",
        priority: outcome.priority,
        title: presentation.bundleTitle,
        message,
        relatedLineIds: outcome.qualifiedLineIds,
        ...(presentation.savingsSummary
          ? {
              action: {
                type: "add_item",
                label: presentation.savingsSummary,
              },
            }
          : {}),
        ...(outcome.expiresAt ? { expiresAt: outcome.expiresAt } : {}),
      } satisfies CheckoutGuidanceItem);
    } else if (outcome.status === "partial" || outcome.status === "expired") {
      const missingLabels = outcome.missingRequirements
        .filter((r) => r.label)
        .map((r) => r.label as string)
        .join(", ");

      const message = missingLabels
        ? `Add ${missingLabels} to complete your bundle`
        : `Complete your bundle for additional savings`;

      items.push({
        guidanceId: `bundle_offer_${outcome.outcomeId}`,
        type: "bundle_offer",
        severity: "warning",
        priority: outcome.priority,
        title: presentation.bundleTitle,
        message,
        relatedLineIds: outcome.qualifiedLineIds,
        ...(outcome.expiresAt ? { expiresAt: outcome.expiresAt } : {}),
      } satisfies CheckoutGuidanceItem);
    }
  }

  return items;
}