import type {
  StorefrontCartLine,
  StorefrontCartSnapshot,
  StorefrontGuidancePayload,
  StorefrontGuidanceResponse,
  StorefrontWidgetMountConfig,
} from "../ai/schemas";
import {
  StorefrontCartSnapshotSchema,
  StorefrontGuidancePayloadSchema,
  StorefrontWidgetMountConfigSchema,
} from "../ai/schemas";

export const DEFAULT_STOREFRONT_WIDGET_FEATURES = {
  showRecommendations: true,
  showKitCompleteness: true,
  showSizeWarnings: true,
  showChatEntry: true,
} as const;

export const DEFAULT_STOREFRONT_WIDGET_LABELS = {
  launcherLabel: "Ask CartMind",
  panelTitle: "CartMind chat",
  assistantGreeting: "Ask about fit, comparisons, or what works well with the items in your cart.",
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