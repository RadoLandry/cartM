import type { StorefrontCartSyncSource, StorefrontChatSurface } from "../ai/schemas";

export type IntegrationHealthEventType =
  | "widget_rendered"
  | "widget_failed"
  | "cart_sync_started"
  | "cart_sync_completed"
  | "cart_sync_failed"
  | "guidance_impressed"
  | "checkout_guidance_rendered"
  | "bundle_outcome_evaluated"
  | "fallback_used";

export type IntegrationHealthEventSurface = StorefrontChatSurface | "checkout" | "function";

export interface IntegrationHealthEvent {
  eventId: string;
  shop: string;
  eventType: IntegrationHealthEventType;
  surface: IntegrationHealthEventSurface;
  createdAt: string;
  sessionId?: string;
  cartToken?: string;
  details: Record<string, string | number | boolean | null>;
}

const SENSITIVE_DETAIL_KEYS = /token|secret|password|authorization|access/i;
const MAX_DETAIL_KEYS = 12;

function safeDetailValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

export function sanitizeIntegrationEventDetails(details: Record<string, unknown> = {}) {
  const entries = Object.entries(details)
    .filter(([key]) => !SENSITIVE_DETAIL_KEYS.test(key))
    .slice(0, MAX_DETAIL_KEYS)
    .map(([key, value]) => [key, safeDetailValue(value)] as const)
    .filter((entry): entry is readonly [string, string | number | boolean | null] => entry[1] !== undefined);

  return Object.fromEntries(entries);
}

export function buildIntegrationHealthEvent(input: {
  shop: string;
  eventType: IntegrationHealthEventType;
  surface: IntegrationHealthEventSurface;
  sessionId?: string;
  cartToken?: string;
  syncSource?: StorefrontCartSyncSource;
  details?: Record<string, unknown>;
  now?: Date;
}): IntegrationHealthEvent {
  const createdAt = (input.now ?? new Date()).toISOString();
  const eventId = [input.shop, input.surface, input.eventType, input.sessionId ?? "anonymous", createdAt]
    .join(":")
    .replace(/[^a-z0-9:_-]/gi, "-");

  return {
    eventId,
    shop: input.shop,
    eventType: input.eventType,
    surface: input.surface,
    createdAt,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.cartToken ? { cartToken: input.cartToken } : {}),
    details: sanitizeIntegrationEventDetails({
      ...(input.syncSource ? { syncSource: input.syncSource } : {}),
      ...(input.details ?? {}),
    }),
  };
}

export async function emitIntegrationHealthEvent(
  event: IntegrationHealthEvent,
  sink?: (event: IntegrationHealthEvent) => void | Promise<void>,
) {
  if (sink) {
    await sink(event);
  }

  return event;
}

export function buildWidgetRenderedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  sessionId?: string;
  cartToken?: string;
  placementId?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    eventType: "widget_rendered",
    details: {
      ...(input.placementId ? { placementId: input.placementId } : {}),
    },
  });
}

export function buildWidgetFailedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  reason: string;
  sessionId?: string;
  cartToken?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    eventType: "widget_failed",
    details: {
      reason: input.reason,
    },
  });
}

export function buildCartSyncStartedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  syncSource: StorefrontCartSyncSource;
  sessionId?: string;
  cartToken?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    syncSource: input.syncSource,
    eventType: "cart_sync_started",
  });
}

export function buildCartSyncCompletedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  syncSource: StorefrontCartSyncSource;
  itemCount: number;
  sessionId?: string;
  cartToken?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    syncSource: input.syncSource,
    eventType: "cart_sync_completed",
    details: {
      itemCount: input.itemCount,
    },
  });
}

export function buildCartSyncFailedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  syncSource: StorefrontCartSyncSource;
  reason: string;
  sessionId?: string;
  cartToken?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    syncSource: input.syncSource,
    eventType: "cart_sync_failed",
    details: {
      reason: input.reason,
    },
  });
}

export function buildGuidanceImpressedEvent(input: {
  shop: string;
  surface: IntegrationHealthEventSurface;
  payloadId: string;
  recommendationCount: number;
  hasKitCompleteness: boolean;
  sizeWarningCount: number;
  sessionId?: string;
  cartToken?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: input.surface,
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    eventType: "guidance_impressed",
    details: {
      payloadId: input.payloadId,
      recommendationCount: input.recommendationCount,
      hasKitCompleteness: input.hasKitCompleteness,
      sizeWarningCount: input.sizeWarningCount,
    },
  });
}

export function buildCheckoutGuidanceRenderedEvent(input: {
  shop: string;
  placement: string;
  guidanceId: string;
  itemCount: number;
  sizeWarningCount: number;
  bundleOfferCount: number;
  kitNudgeCount: number;
  projectionVersion: number;
  cartToken?: string;
  sessionId?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: "checkout",
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    eventType: "checkout_guidance_rendered",
    details: {
      placement: input.placement,
      guidanceId: input.guidanceId,
      itemCount: input.itemCount,
      sizeWarningCount: input.sizeWarningCount,
      bundleOfferCount: input.bundleOfferCount,
      kitNudgeCount: input.kitNudgeCount,
      projectionVersion: input.projectionVersion,
    },
  });
}

export function buildBundleOutcomeEvaluatedEvent(input: {
  shop: string;
  outcomeId: string;
  ruleId: string;
  status: string;
  projectionVersion: number;
  selectedOutcomeCount: number;
  qualifiedLineCount: number;
  hasDiscount: boolean;
  cartToken?: string;
  sessionId?: string;
}) {
  return buildIntegrationHealthEvent({
    shop: input.shop,
    surface: "function",
    sessionId: input.sessionId,
    cartToken: input.cartToken,
    eventType: "bundle_outcome_evaluated",
    details: {
      outcomeId: input.outcomeId,
      ruleId: input.ruleId,
      status: input.status,
      projectionVersion: input.projectionVersion,
      selectedOutcomeCount: input.selectedOutcomeCount,
      qualifiedLineCount: input.qualifiedLineCount,
      hasDiscount: input.hasDiscount,
    },
  });
}