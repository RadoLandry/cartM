import crypto from "node:crypto";

import type {
  BudgetOptimizationRequest,
  BudgetOptimizationResult,
  CartToolAction,
  ProductComparisonRequest,
  ProductComparisonResult,
  StorefrontChatRequest,
} from "./schemas";
import { createCartToolActionRecord, getCartToolActionRecord, isCartToolActionTerminalStatus } from "./storefront-chat";
import { issueActionConfirmationToken } from "../shopify/app-proxy";
import db from "../../db.server";

function createActionId() {
  return crypto.randomUUID();
}

function createComparisonRequestId() {
  return crypto.randomUUID();
}

function createBudgetOptimizationRequestId() {
  return crypto.randomUUID();
}

export function createComparisonContextId(requestId: string) {
  return `cmp_${requestId}`;
}

export function createBudgetOptimizationContextId(requestId: string) {
  return `bgt_${requestId}`;
}

function isBudgetOptimizationIntent(content: string) {
  const normalized = normalizeText(content);
  return /\b(budget|optimi[sz])/.test(normalized);
}

function parseLocalizedBudgetAmount(rawValue: string) {
  const compact = rawValue
    .replace(/[\u00A0\u202F\s']/g, "")
    .replace(/[^0-9.,]/g, "");

  if (!compact) {
    return null;
  }

  let normalized = compact;
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(/,/g, ".")
      : compact.replace(/,/g, "");
  } else if (hasComma) {
    const parts = compact.split(",");
    normalized = parts.length === 2 && parts[1].length === 3
      ? parts.join("")
      : compact.replace(/,/g, ".");
  } else if (hasDot) {
    const parts = compact.split(".");
    normalized = parts.length === 2 && parts[1].length === 3
      ? parts.join("")
      : compact;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function parseBudgetAmountFromMessage(content: string) {
  const normalized = content.normalize("NFKC");
  const keywordMatches = Array.from(
    normalized.matchAll(/\b(?:budget|target|max(?:imum)?|optimi[sz][a-z]*)\b[^0-9]{0,24}([0-9]+(?:[.,][0-9]{1,2})?)/gi),
  ).map((match) => match[1]);
  const currencyMatches = Array.from(
    normalized.matchAll(/(?:€|\$|£|\b(?:eur|euro|usd|gbp)\b)\s*([0-9]+(?:[.,][0-9]{1,2})?)|([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:€|\$|£|\b(?:eur|euro|usd|gbp)\b)/gi),
  ).map((match) => match[1] || match[2]).filter((value): value is string => Boolean(value));
  const genericMatches = Array.from(
    normalized.matchAll(/\b([0-9]+(?:[.,][0-9]{1,2})?)\b/g),
  ).map((match) => match[1]);

  const candidates = [...keywordMatches, ...currencyMatches, ...genericMatches];

  for (const candidate of candidates) {
    const parsed = parseLocalizedBudgetAmount(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function normalizeText(content: string) {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseFirstInteger(content: string) {
  const match = content.match(/\b(\d{1,3})\b/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function buildLineMatchCandidates(item: StorefrontChatRequest["cart"]["items"][number]) {
  const candidates = new Set<string>();

  const pushValue = (value?: string) => {
    if (!value) {
      return;
    }

    const normalized = normalizeText(value);
    if (normalized.length > 0) {
      candidates.add(normalized);
    }

    for (const token of normalized.split(/[^a-z0-9]+/g)) {
      if (token.length >= 4) {
        candidates.add(token);

        if (token.endsWith("s") && token.length > 4) {
          candidates.add(token.slice(0, -1));
        } else {
          candidates.add(`${token}s`);
        }
      }
    }
  };

  pushValue(item.productTitle);
  pushValue(item.variantTitle);
  pushValue(item.productId);
  pushValue(item.variantId);

  return Array.from(candidates);
}

function resolveTargetLine(
  input: StorefrontChatRequest,
  normalizedMessage: string,
  options?: { requireMatch?: boolean },
) {
  const withLineId = input.cart.items.filter((item) => item.lineId || item.productId);

  let best:
    | {
      item: (typeof withLineId)[number];
      firstIndex: number;
      candidateLength: number;
    }
    | undefined;

  for (const item of withLineId) {
    for (const candidate of buildLineMatchCandidates(item)) {
      const index = normalizedMessage.indexOf(candidate);
      if (index < 0) {
        continue;
      }

      if (
        !best
        || index < best.firstIndex
        || (index === best.firstIndex && candidate.length > best.candidateLength)
      ) {
        best = {
          item,
          firstIndex: index,
          candidateLength: candidate.length,
        };
      }
    }
  }

  if (best) {
    return best.item;
  }

  if (options?.requireMatch) {
    return undefined;
  }

  return withLineId[0];
}

// Non-global twin of the directive regex used below, for a cheap presence check
// without matchAll's lastIndex state.
const QUANTITY_DIRECTIVE_TEST_PATTERN = /[a-z0-9\s'/-]{1,80}?\s*(?:a|to|=)\s*\d{1,3}\b/;

function resolveExplicitQuantityTargets(input: StorefrontChatRequest, normalizedMessage: string) {
  const withLineId = input.cart.items.filter((item) => item.lineId || item.productId);

  interface ParsedDirective {
    context: string;
    quantity: number;
    index: number;
    line: StorefrontChatRequest["cart"]["items"][number] | undefined;
  }

  // Phase 1: extract all quantity directives and try title-based line matching.
  const parsed: ParsedDirective[] = [];
  for (const directive of normalizedMessage.matchAll(/([a-z0-9\s'/-]{1,80}?)\s*(?:a|to|=)\s*(\d{1,3})\b/g)) {
    const context = directive[1]?.trim() ?? "";
    const parsedQuantity = Number(directive[2]);
    const directiveIndex = directive.index ?? 0;

    if (!context || !Number.isFinite(parsedQuantity)) {
      continue;
    }

    parsed.push({
      context,
      quantity: parsedQuantity,
      index: directiveIndex,
      line: resolveTargetLine(input, context, { requireMatch: true }),
    });
  }

  if (parsed.length === 0) {
    return [];
  }

  // Phase 2: positional fallback — if some directives did not match a line by
  // title (e.g. productTitle missing or product named differently from how the
  // shopper refers to it), try to assign them to the cart lines not already
  // claimed by a successful match.  Only applies when the counts are equal so
  // the assignment is unambiguous.
  const matchedRefs = new Set(
    parsed
      .filter((p) => p.line)
      .map((p) => p.line!.lineId || p.line!.productId),
  );

  const unmatchedLines = withLineId.filter((item) => !matchedRefs.has(item.lineId || item.productId));
  const unmatchedDirectives = parsed.filter((p) => !p.line);

  if (unmatchedDirectives.length > 0 && unmatchedDirectives.length === unmatchedLines.length) {
    const sortedDirectives = unmatchedDirectives.slice().sort((a, b) => a.index - b.index);
    for (let i = 0; i < sortedDirectives.length; i++) {
      sortedDirectives[i].line = unmatchedLines[i];
    }
  }

  // Phase 3: keep resolved directives only, deduplicate by line reference
  // (last explicit quantity in the message wins), then sort by message order.
  const resolved = parsed.filter((p): p is ParsedDirective & { line: NonNullable<ParsedDirective["line"]> } => Boolean(p.line));

  if (resolved.length === 0) {
    return [];
  }

  const dedupedByLineId = new Map<string, (typeof resolved)[number]>();
  for (const update of resolved) {
    const lineRef = update.line.lineId || update.line.productId;
    dedupedByLineId.set(lineRef, update);
  }

  return Array.from(dedupedByLineId.values())
    .sort((left, right) => left.index - right.index)
    .map(({ line, quantity, index }) => ({ line, quantity, index }));
}

// Regex that captures a reference-relation phrase immediately before a cart-item name
// e.g. "compatible with", "for", "pour", "avec", "qui va avec", "à ce", "that goes with"
const REFERENCE_RELATION_PATTERN =
  /\b(?:compatible\s+(?:with|avec|a|au)?|(?:for|pour|for\s+this|pour\s+ce[tte]?|for\s+my|pour\s+mon(?:ma)?)|(?:with|avec)|(?:that\s+goes?\s+with|qui\s+va\s+avec)|(?:to\s+use\s+with|a\s+utiliser\s+avec))\s+/i;

function resolveAddMerchandiseId(input: StorefrontChatRequest, normalizedMessage: string) {
  const gidMatch = normalizedMessage.match(/gid:\/\/shopify\/productvariant\/\d+/i);
  if (gidMatch) {
    return gidMatch[0];
  }

  // If the message contains a reference-relation phrase, a cart item match is a
  // context reference ("compatible with this short"), not the item to add.
  // Return null so the caller falls back to guidance mode instead of re-adding
  // the referenced product.
  if (REFERENCE_RELATION_PATTERN.test(normalizedMessage)) {
    return null;
  }

  const target = resolveTargetLine(input, normalizedMessage) ?? input.cart.items[0];
  return target?.variantId;
}

function parseRequestedVariantId(rawMessage: string) {
  const gidMatch = rawMessage.match(/gid:\/\/shopify\/ProductVariant\/[A-Za-z0-9_-]+/i);
  if (!gidMatch) {
    return null;
  }

  return gidMatch[0];
}

const SIZE_TOKEN = "(?:5xl|4xl|3xl|2xl|xxxxxl|xxxxl|xxxl|xxl|xxs|xl|xs|s|m|l|extra\\s+large|extra\\s+small|small|medium|large|\\d{1,3}(?:\\s*(?:oz|cm|mm))?)";

function parseRequestedVariantLabel(normalizedMessage: string) {
  const sizeToken = SIZE_TOKEN;
  const explicitSize = normalizedMessage.match(new RegExp(`\\b(?:taille|size)\\b[^.?!]{0,40}?\\b(?:en|a|to|:)\\s*(${sizeToken})\\b`));
  const directSize = explicitSize ?? normalizedMessage.match(new RegExp(`\\b(?:taille|size)\\s+(${sizeToken})\\b`));
  const implicitSize = directSize ?? normalizedMessage.match(new RegExp(`\\b(?:en|to)\\s+(${sizeToken})\\b`));
  return implicitSize?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function normalizeVariantSizeLabel(label: string) {
  const normalized = normalizeText(label).trim().replace(/^(?:taille|size)\s+/, "").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    "extra small": "xs",
    small: "s",
    medium: "m",
    large: "l",
    "extra large": "xl",
    "2xl": "xxl",
    "3xl": "xxxl",
    "4xl": "xxxxl",
    "5xl": "xxxxxl",
  };
  return aliases[normalized] ?? normalized;
}

function resolveSizeTargetLine(input: StorefrontChatRequest, message: string) {
  if (input.cart.items.length === 1) {
    return input.cart.items[0];
  }

  const normalizedMessage = ` ${message.replace(/[^a-z0-9]+/g, " ")} `;
  const matches = input.cart.items.map((item) => {
    const candidates = buildLineMatchCandidates({ ...item, variantTitle: undefined, variantId: undefined });
    const score = Math.max(0, ...candidates
      .filter((candidate) => normalizedMessage.includes(` ${candidate.replace(/[^a-z0-9]+/g, " ")} `))
      .map((candidate) => candidate.length));
    return { item, score };
  });
  const bestScore = Math.max(0, ...matches.map((match) => match.score));
  const bestMatches = matches.filter((match) => match.score > 0 && match.score === bestScore);
  return bestMatches.length === 1 ? bestMatches[0].item : undefined;
}

export type CartToolClarification = {
  code: "SIZE_REQUIRED" | "TARGET_REQUIRED" | "MIXED_CHANGES" | "VARIANT_UNRESOLVED";
  productTitle?: string;
  requestedSize?: string;
};

export type CartToolResolution =
  | { status: "proposed"; action: CartToolAction }
  | { status: "clarification"; clarification: CartToolClarification }
  | { status: "no_action" };

type CartToolInference = {
  toolName: CartToolAction["toolName"];
  payload: CartToolAction["payload"];
  preview?: CartToolAction["preview"];
} | {
  _swapTargetLine: StorefrontChatRequest["cart"]["items"][number];
  _requestedVariantId: string | null;
  _requestedVariantLabel: string | null;
} | { clarification: CartToolClarification };

function inferToolFromMessage(input: StorefrontChatRequest): CartToolInference | null {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";
  const normalized = normalizeText(latest);
  const targetLine = resolveTargetLine(input, normalized);
  // A named-product mutation (size/variant change) must resolve to a real cart
  // line when several lines exist — otherwise silently defaulting to the first
  // line would mutate the wrong product (e.g. "short" mistakenly resolving to
  // "pantalon" or "gants").
  const strictTargetLine = input.cart.items.length > 1
    ? resolveTargetLine(input, normalized, { requireMatch: true })
    : targetLine;
  const requestedVariantLabel = parseRequestedVariantLabel(normalized);
  const variantChangeIntent = /\b(swap|replace|switch|echanger|echange|change|changer|modifie|modifier|mets|mettez|mettre|passe|passer|remplace|remplacer)\b/.test(normalized);

  const hasExplicitSizeIntent = /\b(taille|size)\b/.test(normalized);
  const quantityIntentText = normalized.replace(/\b(?:(?:en\s+)?(?:gardant|garder|garde|conservant|conserver|conserve)|sans\s+(?:changer|modifier)|avec|keep(?:ing)?|retain(?:ing)?)(?:\s+(?:la|le|les|meme|the|same|current))*\s+(?:quantite|quantity)\b/g, "");
  const hasExplicitQuantityIntent = /\b(quantity|quantite|exemplaires?|pieces?|unites?)\b/.test(quantityIntentText);
  if (variantChangeIntent && (hasExplicitSizeIntent || (requestedVariantLabel && !hasExplicitQuantityIntent))) {
    const sizeTargetLine = resolveSizeTargetLine(input, normalized);
    if (!requestedVariantLabel) {
      return { clarification: { code: "SIZE_REQUIRED" } };
    }
    if (!sizeTargetLine?.variantId) {
      return { clarification: { code: "TARGET_REQUIRED", requestedSize: requestedVariantLabel } };
    }
    if (hasExplicitQuantityIntent) {
      return { clarification: { code: "MIXED_CHANGES", productTitle: sizeTargetLine.productTitle } };
    }
    return {
      _swapTargetLine: sizeTargetLine,
      _requestedVariantId: parseRequestedVariantId(latest),
      _requestedVariantLabel: requestedVariantLabel,
    };
  }

  if (/\b(add|ajoute|insert|include)\b/.test(normalized)) {
    const merchandiseId = resolveAddMerchandiseId(input, normalized);

    if (!merchandiseId) {
      return null;
    }

    const requestedQuantity = parseFirstInteger(normalized);
    const quantity = Math.max(1, requestedQuantity ?? 1);

    return {
      toolName: "addToCart",
      payload: {
        actionType: "add",
        merchandiseId,
        quantity,
      },
      preview: {
        after: `Add ${quantity} x ${targetLine?.productTitle || "selected item"}`,
      },
    };
  }

  if (/\b(remove|retire|delete|supprime)\b/.test(normalized) && targetLine) {
    return {
      toolName: "removeFromCart",
      payload: {
        actionType: "remove",
        lineId: targetLine.lineId || targetLine.productId,
      },
      preview: {
        before: targetLine.productTitle || "Existing cart item",
        after: "Item removed",
      },
    };
  }

  const hasQuantityIntent = /\b(quantity|quantite|increase|decrease|more|less|plus|moins|augmente|diminue|baisse|redui|mets|mettez|mettre|set|fixe|fixer|passe|passer)\b/.test(normalized)
    || (/\b(?:a|to|=)\s*\d{1,3}\b/.test(normalized) && /\b(?:exemplaire|piece|unite|quantity|quantite)\b/.test(normalized));
  if (hasQuantityIntent && targetLine) {
    const explicitDirectives = resolveExplicitQuantityTargets(input, normalized);

    // The message names a product with an explicit quantity (e.g. "le short a 2
    // exemplaires") but it didn't resolve to any cart line — don't silently
    // fall back to an unrelated line, bail out instead.
    if (explicitDirectives.length === 0 && QUANTITY_DIRECTIVE_TEST_PATTERN.test(normalized)) {
      return null;
    }

    const primaryDirective = explicitDirectives[0];
    const quantityTargetLine = primaryDirective?.line ?? targetLine;
    const explicitQuantity = primaryDirective?.quantity ?? parseFirstInteger(normalized);
    const increaseIntent = /\b(increase|more|plus|up|augmente)\b/.test(normalized);
    const decreaseIntent = /\b(decrease|less|minus|reduce|down|moins|diminue|baisse|redui)\b/.test(normalized);

    const quantity = explicitQuantity
      ? explicitQuantity
      : increaseIntent
        ? quantityTargetLine.quantity + 1
        : decreaseIntent
          ? quantityTargetLine.quantity - 1
          : quantityTargetLine.quantity + 1;

    const explicitChanges = explicitDirectives.length > 1
      ? explicitDirectives.map((directive) => ({
          lineId: directive.line.lineId || directive.line.productId,
          quantity: Math.max(1, directive.quantity),
        }))
      : undefined;

    return {
      toolName: "changeQuantity",
      payload: {
        actionType: "change_quantity",
        lineId: quantityTargetLine.lineId || quantityTargetLine.productId,
        quantity: Math.max(1, quantity),
        ...(explicitChanges ? { changes: explicitChanges } : {}),
      },
      preview: {
        before: explicitChanges
          ? `${explicitChanges.length} items selected for quantity updates`
          : `${quantityTargetLine.productTitle || "Item"} x${quantityTargetLine.quantity}`,
        after: explicitChanges
          ? `${explicitChanges.length} items will be updated`
          : `${quantityTargetLine.productTitle || "Item"} x${Math.max(1, quantity)}`,
      },
    };
  }

  if (/\b(swap|replace)\b/.test(normalized) && strictTargetLine?.variantId) {
    const requestedVariantId = parseRequestedVariantId(latest);
    return {
      _swapTargetLine: strictTargetLine,
      _requestedVariantId: requestedVariantId,
      _requestedVariantLabel: requestedVariantLabel,
    };
  }

  return null;
}

// Looks up available variant siblings for a swap when the user didn't specify a target GID.
async function resolveSwapVariantId(
  shop: string,
  productId: string,
  currentVariantId: string,
  requestedVariantLabel?: string,
  currentVariantTitle?: string,
): Promise<{ variantId: string; variantTitle: string | null } | null> {
  try {
    const product = await db.product.findFirst({
      where: { shop, shopifyProductId: { in: [productId.replace(/^.*\//, ""), `gid://shopify/Product/${productId.replace(/^.*\//, "")}`] } },
      select: {
        variants: {
          orderBy: { inventoryQuantity: "desc" },
          select: { shopifyVariantId: true, title: true, inventoryQuantity: true },
        },
      },
    });

    const currentVariant = product?.variants.find(
      (variant) => variant.shopifyVariantId.replace(/^.*\//, "") === currentVariantId.replace(/^.*\//, ""),
    );
    const alternatives = product?.variants.filter(
      (variant) => variant !== currentVariant && (variant.inventoryQuantity ?? 0) > 0,
    ) ?? [];
    const normalizedRequestedLabel = requestedVariantLabel ? normalizeVariantSizeLabel(requestedVariantLabel) : null;
    const currentOptions = (currentVariant?.title ?? currentVariantTitle ?? "")
      .split(/[/|,]|\s[-–]\s/).map(normalizeVariantSizeLabel);
    const sizeIndexes = currentOptions.flatMap((option, index) => new RegExp(`^${SIZE_TOKEN}$`).test(option) ? [index] : []);
    const alternative = normalizedRequestedLabel
      ? alternatives.find((variant) => {
          const options = variant.title.split(/[/|,]|\s[-–]\s/).map(normalizeVariantSizeLabel);
          return sizeIndexes.length === 1 && options.length === currentOptions.length
            && options.every((option, index) => option === (index === sizeIndexes[0] ? normalizedRequestedLabel : currentOptions[index]));
        })
      : alternatives[0];

    return alternative ? { variantId: alternative.shopifyVariantId, variantTitle: alternative.title } : null;
  } catch {
    return null;
  }
}

export async function buildCartToolActionProposal(input: StorefrontChatRequest): Promise<CartToolAction | null> {
  const resolution = await resolveCartToolActionProposal(input);
  return resolution.status === "proposed" ? resolution.action : null;
}

const pendingSizeClarifications = new Map<string, {
  line: StorefrontChatRequest["cart"]["items"][number];
  cartId?: string;
  expiresAt: number;
}>();

export async function resolveCartToolActionProposal(input: StorefrontChatRequest): Promise<CartToolResolution> {
  const scope = JSON.stringify([input.shop, input.sessionKey]);
  const latest = input.messages[input.messages.length - 1]?.content.trim() ?? "";
  const pending = pendingSizeClarifications.get(scope);
  pendingSizeClarifications.delete(scope);
  for (const [key, clarification] of pendingSizeClarifications) {
    if (clarification.expiresAt <= Date.now()) pendingSizeClarifications.delete(key);
  }
  let inferred = inferToolFromMessage(input);
  const isSizeReply = /^(?:(?:taille|size)\s+)?(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|\d{2}(?:\s*oz)?)\s*[.!]?$/i.test(latest);
  if (!inferred && isSizeReply) {
    const line = pending && pending.expiresAt > Date.now() && pending.cartId === input.cart.cartId
      ? input.cart.items.find((candidate) => candidate.lineId === pending.line.lineId
      && candidate.productId === pending.line.productId
      && candidate.variantId === pending.line.variantId
      && candidate.quantity === pending.line.quantity) : undefined;
    inferred = line ? {
      _swapTargetLine: line,
      _requestedVariantId: null,
      _requestedVariantLabel: latest.replace(/^(?:taille|size)\s+/i, "").replace(/[.!]$/, "").trim(),
    } : { clarification: { code: "TARGET_REQUIRED" } };
  }

  if (inferred && "clarification" in inferred) {
    if (inferred.clarification.code === "SIZE_REQUIRED") {
      const line = resolveSizeTargetLine(input, normalizeText(latest));
      if (line?.lineId) pendingSizeClarifications.set(scope, {
        line: { ...line }, cartId: input.cart.cartId, expiresAt: Date.now() + 5 * 60_000,
      });
    }
    return { status: "clarification", clarification: inferred.clarification };
  }

  // Handle deferred swap resolution requiring a DB lookup.
  if (inferred && "_swapTargetLine" in inferred) {
    const { _swapTargetLine: targetLine, _requestedVariantId: requestedVariantId, _requestedVariantLabel } = inferred;

    const resolvedVariant = requestedVariantId
      ? { variantId: requestedVariantId, variantTitle: null }
      : await resolveSwapVariantId(input.shop, targetLine.productId, targetLine.variantId ?? "", _requestedVariantLabel ?? undefined, targetLine.variantTitle);
    const resolvedVariantId = resolvedVariant?.variantId;

    if (!resolvedVariantId) {
      if (targetLine.lineId) pendingSizeClarifications.set(scope, {
        line: { ...targetLine }, cartId: input.cart.cartId, expiresAt: Date.now() + 5 * 60_000,
      });
      return {
        status: "clarification",
        clarification: {
          code: "VARIANT_UNRESOLVED",
          productTitle: targetLine.productTitle,
          requestedSize: _requestedVariantLabel ?? undefined,
        },
      };
    }

    const newTitle = resolvedVariant?.variantTitle ?? _requestedVariantLabel ?? (requestedVariantId ? "requested variant" : "alternate variant");
    const beforeLabel = `${targetLine.productTitle || "Item"}${targetLine.variantTitle ? ` / ${targetLine.variantTitle}` : ""}`;

    const swapActionId = createActionId();
    const swapToken = issueActionConfirmationToken({
      actionId: swapActionId,
      shop: input.shop,
      sessionKey: input.sessionKey,
      cartId: input.cart.cartId,
    });
    const swapAction: CartToolAction = {
      actionId: swapActionId,
      toolName: "swapVariant",
      shop: input.shop,
      sessionKey: input.sessionKey,
      ...(input.cart.cartId ? { cartId: input.cart.cartId } : {}),
      payload: {
        actionType: "swap_variant",
        lineId: targetLine.lineId || targetLine.productId,
        newMerchandiseId: resolvedVariantId,
        quantity: targetLine.quantity,
      },
      preview: {
        before: beforeLabel,
        after: `${targetLine.productTitle || "Item"} / ${newTitle}`,
      },
      confirmationToken: swapToken.token,
      expiresAt: swapToken.expiresAt,
    };
    createCartToolActionRecord({
      actionId: swapActionId,
      shop: swapAction.shop,
      sessionKey: swapAction.sessionKey,
      cartId: swapAction.cartId,
      payload: swapAction.payload,
    });
    return { status: "proposed", action: swapAction };
  }

  if (!inferred) {
    return { status: "no_action" };
  }

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cart.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: inferred.toolName,
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cart.cartId ? { cartId: input.cart.cartId } : {}),
    payload: inferred.payload,
    ...(inferred.preview ? { preview: inferred.preview } : {}),
    confirmationToken: token.token,
    expiresAt: token.expiresAt,
  };

  createCartToolActionRecord({
    actionId,
    shop: action.shop,
    sessionKey: action.sessionKey,
    cartId: action.cartId,
    payload: action.payload,
  });

  return { status: "proposed", action };
}

export function buildComparisonSelectionActionProposal(input: {
  shop: string;
  sessionKey: string;
  cartId?: string;
  comparison: ProductComparisonResult;
}): CartToolAction | null {
  const recommendedProduct = input.comparison.products.find((product) => (
    product.productId === input.comparison.recommendation?.recommendedProductId
  )) || input.comparison.products[0];

  if (!recommendedProduct) {
    return null;
  }

  const alternatives = input.comparison.products
    .filter((product) => product.productId !== recommendedProduct.productId)
    .map((product) => ({
      productId: product.productId,
      ...(product.variantId ? { variantId: product.variantId } : {}),
      title: product.title,
    }));

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: "compareProducts",
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    payload: {
      actionType: "comparison_select",
      comparisonContextId: input.comparison.comparisonContextId,
      recommended: {
        productId: recommendedProduct.productId,
        ...(recommendedProduct.variantId ? { variantId: recommendedProduct.variantId } : {}),
        title: recommendedProduct.title,
      },
      alternatives,
    },
    preview: {
      after: `Choose a product from comparison ${input.comparison.comparisonContextId}`,
    },
    confirmationToken: token.token,
    expiresAt: token.expiresAt,
  };

  createCartToolActionRecord({
    actionId,
    shop: action.shop,
    sessionKey: action.sessionKey,
    cartId: action.cartId,
    payload: action.payload,
  });

  return action;
}

export function buildBudgetOptimizationSelectionActionProposal(input: {
  shop: string;
  sessionKey: string;
  cartId?: string;
  optimization: BudgetOptimizationResult;
  summary?: string;
  cart: StorefrontChatRequest["cart"];
}): CartToolAction | null {
  if (input.optimization.candidates.length === 0) {
    return null;
  }

  const actionId = createActionId();
  const token = issueActionConfirmationToken({
    actionId,
    shop: input.shop,
    sessionKey: input.sessionKey,
    cartId: input.cartId,
  });

  const action: CartToolAction = {
    actionId,
    toolName: "optimizeBudget",
    shop: input.shop,
    sessionKey: input.sessionKey,
    ...(input.cartId ? { cartId: input.cartId } : {}),
    payload: {
      actionType: "budget_optimization_select",
      optimizationContextId: input.optimization.optimizationContextId,
      candidateIds: input.optimization.candidates.map((candidate) => candidate.candidateId),
      baselineCart: input.cart,
      changes: input.cart.items.flatMap((item) => {
        const candidates = input.optimization.candidates.filter((candidate) => candidate.sourceLineId === (item.lineId || item.productId));
        if (!candidates.length) return [];
        return [{ lineId: item.lineId || item.productId, quantity: candidates.some((candidate) => candidate.changeType === "remove") ? 0 : Math.max(0, item.quantity - candidates.length) }];
      }),
      projectedSubtotal: input.optimization.projectedSubtotal,
      projectedGapAmount: input.optimization.projectedGapAmount,
    },
    preview: {
      after: input.summary || `Apply budget plan (${input.optimization.candidates.length} change${input.optimization.candidates.length > 1 ? "s" : ""})`,
    },
    confirmationToken: token.token,
    expiresAt: token.expiresAt,
  };

  createCartToolActionRecord({
    actionId,
    shop: action.shop,
    sessionKey: action.sessionKey,
    cartId: action.cartId,
    payload: action.payload,
  });

  return action;
}

export function resolveCartToolActionById(actionId: string) {
  const record = getCartToolActionRecord(actionId);

  if (!record) {
    return { ok: false as const, code: "ACTION_NOT_FOUND", message: "No matching cart action was found." };
  }

  return {
    ok: true as const,
    record,
    isTerminal: isCartToolActionTerminalStatus(record.status),
  };
}

export function buildCompareProductsToolRequest(input: StorefrontChatRequest): ProductComparisonRequest | null {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("compare")) {
    return null;
  }

  const allRefs = input.cart.items
    .map((item) => item.productId || item.variantId)
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);

  const productRefs = Array.from(new Set(allRefs)).slice(0, 5);

  if (productRefs.length < 2 || allRefs.length === 0) {
    return null;
  }

  return {
    requestId: createComparisonRequestId(),
    shop: input.shop,
    sessionKey: input.sessionKey,
    productRefs,
    dimensions: ["price", "availability", "key_specs", "tradeoffs"],
    requestedAt: new Date().toISOString(),
  };
}

export function getCompareProductsValidationError(input: StorefrontChatRequest) {
  const latest = input.messages[input.messages.length - 1]?.content.toLowerCase() ?? "";

  if (!latest.includes("compare")) {
    return null;
  }

  const allRefs = input.cart.items
    .map((item) => item.productId || item.variantId)
    .filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  const uniqueRefs = Array.from(new Set(allRefs));

  if (uniqueRefs.length < 2) {
    const code: "DUPLICATE_PRODUCTS" | "INSUFFICIENT_PRODUCTS" = allRefs.length > uniqueRefs.length
      ? "DUPLICATE_PRODUCTS"
      : "INSUFFICIENT_PRODUCTS";

    return {
      code,
      message: allRefs.length > uniqueRefs.length
        ? "Please choose two different products for comparison."
        : "Please add at least two products before asking for a comparison.",
      suggestedNextStep: allRefs.length > uniqueRefs.length
        ? "Select another product from your cart and compare again."
        : "Add one more product to your cart, then ask CartMind to compare.",
    };
  }

  return null;
}

export function buildBudgetOptimizationToolRequest(input: StorefrontChatRequest): BudgetOptimizationRequest | null {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";

  if (!isBudgetOptimizationIntent(latest)) {
    return null;
  }

  const targetBudgetAmount = parseBudgetAmountFromMessage(latest);
  if (!targetBudgetAmount) {
    return null;
  }

  return {
    requestId: createBudgetOptimizationRequestId(),
    shop: input.shop,
    sessionKey: input.sessionKey,
    targetBudgetAmount,
    currencyCode: input.cart.currencyCode,
    requestedAt: new Date().toISOString(),
  };
}

export function getBudgetOptimizationValidationError(input: StorefrontChatRequest) {
  const latest = input.messages[input.messages.length - 1]?.content ?? "";

  if (!isBudgetOptimizationIntent(latest)) {
    return null;
  }

  if (input.cart.items.length === 0) {
    return {
      code: "EMPTY_CART" as const,
      message: "Add at least one product before asking for budget optimization.",
      suggestedNextStep: "Add products to your cart, then share your target budget.",
    };
  }

  const parsedBudget = parseBudgetAmountFromMessage(latest);
  if (!parsedBudget) {
    return {
      code: "INVALID_TARGET_BUDGET" as const,
      message: "Please provide a target budget amount, for example: optimize this cart for $120.",
      suggestedNextStep: "Include a numeric budget amount and retry.",
    };
  }

  return null;
}
