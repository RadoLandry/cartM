import type {
  ThresholdSuggestionCandidate,
  CartThresholdItem,
  ThresholdRuleRecord,
} from "../knowledge-graph/thresholds";
import {
  buildThresholdCandidatesForRule,
  buildThresholdSelectionReason,
  buildThresholdUnlockMessage,
  roundThresholdCurrency,
  sortThresholdCandidates,
  sortThresholdRules,
  THRESHOLD_RELEVANCE_FLOOR,
} from "../knowledge-graph/thresholds";
import { listActiveThresholdRules } from "../db/queries";

export type ThresholdEvaluationStatus = "not_applicable" | "eligible" | "qualified" | "suppressed";

export interface ThresholdEvaluationRequest {
  shop: string;
  currencyCode: string;
  cartSubtotal: number;
  cartItems: CartThresholdItem[];
  thresholdRules: ThresholdRuleRecord[];
  candidates?: ThresholdSuggestionCandidate[];
}

export interface ThresholdEvaluationResult {
  selectedRule?: {
    key: string;
    label: string;
    benefitType: ThresholdRuleRecord["benefitType"];
    benefitLabel: string;
    priority: number;
    targetSubtotal: number;
    actionableWindow: number;
    selectionReason?: string;
  };
  status: ThresholdEvaluationStatus;
  gapAmount: number | null;
  unlockMessage?: string;
  suppressionReason?:
    | "already_qualified"
    | "outside_actionable_window"
    | "no_active_rules"
    | "no_in_stock_candidates"
    | "below_relevance_floor";
  candidates: ThresholdSuggestionCandidate[];
}

export function computeThresholdGap(cartSubtotal: number, targetSubtotal: number): number {
  return roundThresholdCurrency(Math.max(0, targetSubtotal - cartSubtotal));
}

export function isWithinActionableWindow(gapAmount: number, rule: Pick<ThresholdRuleRecord, "actionableWindow">): boolean {
  return gapAmount <= rule.actionableWindow;
}

export function selectThresholdRule(
  rules: ThresholdRuleRecord[],
  cartSubtotal: number,
): ThresholdRuleRecord | null {
  const activeRules = sortThresholdRules(rules.filter((rule) => rule.status === "ACTIVE"));

  if (activeRules.length === 0) {
    return null;
  }

  const firstUnmetRule = activeRules.find((rule) => computeThresholdGap(cartSubtotal, rule.targetSubtotal) > 0);
  return firstUnmetRule ?? activeRules.at(-1) ?? null;
}

export function buildSelectedRule(rule: ThresholdRuleRecord, gapAmount?: number) {
  return {
    key: rule.key,
    label: rule.label,
    benefitType: rule.benefitType,
    benefitLabel: rule.benefitLabel,
    priority: rule.priority,
    targetSubtotal: rule.targetSubtotal,
    actionableWindow: rule.actionableWindow,
    ...(gapAmount !== undefined && gapAmount > 0
      ? { selectionReason: buildThresholdSelectionReason(rule, gapAmount) }
      : {}),
  };
}

export function capThresholdCandidates(
  candidates: ThresholdSuggestionCandidate[],
  maxSuggestions: number,
): ThresholdSuggestionCandidate[] {
  const relevant = candidates.filter((candidate) => candidate.relevanceScore >= THRESHOLD_RELEVANCE_FLOOR);
  return sortThresholdCandidates(relevant).slice(0, maxSuggestions);
}

export function createSuppressedThresholdResult(
  rule: ThresholdRuleRecord | null,
  cartSubtotal: number,
  suppressionReason: NonNullable<ThresholdEvaluationResult["suppressionReason"]>,
  candidates: ThresholdSuggestionCandidate[] = [],
): ThresholdEvaluationResult {
  const gapAmount = rule ? computeThresholdGap(cartSubtotal, rule.targetSubtotal) : null;

  return {
    ...(rule ? { selectedRule: buildSelectedRule(rule) } : {}),
    status: "suppressed",
    gapAmount,
    suppressionReason,
    candidates,
  };
}

export function evaluateThreshold(input: ThresholdEvaluationRequest): ThresholdEvaluationResult {
  const selectedRule = selectThresholdRule(input.thresholdRules, input.cartSubtotal);

  if (!selectedRule) {
    return {
      status: "not_applicable",
      gapAmount: null,
      suppressionReason: "no_active_rules",
      candidates: [],
    };
  }

  const gapAmount = computeThresholdGap(input.cartSubtotal, selectedRule.targetSubtotal);
  if (gapAmount === 0) {
    return {
      selectedRule: buildSelectedRule(selectedRule),
      status: "qualified",
      gapAmount,
      suppressionReason: "already_qualified",
      candidates: [],
    };
  }

  if (!isWithinActionableWindow(gapAmount, selectedRule)) {
    return createSuppressedThresholdResult(selectedRule, input.cartSubtotal, "outside_actionable_window");
  }

  const allCandidates = input.candidates ?? [];
  const candidates = capThresholdCandidates(allCandidates, selectedRule.maxSuggestions);
  if (candidates.length === 0) {
    const suppressionReason = allCandidates.length > 0 ? "below_relevance_floor" : "no_in_stock_candidates";
    return createSuppressedThresholdResult(selectedRule, input.cartSubtotal, suppressionReason);
  }

  return {
    selectedRule: buildSelectedRule(selectedRule, gapAmount),
    status: "eligible",
    gapAmount,
    unlockMessage: buildThresholdUnlockMessage(selectedRule, gapAmount),
    candidates,
  };
}

export async function buildThresholdEvaluationRequest(
  shop: string,
  cartItems: CartThresholdItem[],
  cartSubtotal: number,
  currencyCode = "USD",
): Promise<ThresholdEvaluationRequest> {
  const thresholdRules = await listActiveThresholdRules(shop);
  const selectedRule = selectThresholdRule(thresholdRules, cartSubtotal);

  if (!selectedRule) {
    return {
      shop,
      currencyCode,
      cartSubtotal,
      cartItems,
      thresholdRules,
      candidates: [],
    };
  }

  const gapAmount = computeThresholdGap(cartSubtotal, selectedRule.targetSubtotal);
  const candidates = gapAmount > 0
    ? await buildThresholdCandidatesForRule({
      shop,
      rule: selectedRule,
      cartItems,
      gapAmount,
      take: 50,
    })
    : [];

  return {
    shop,
    currencyCode,
    cartSubtotal,
    cartItems,
    thresholdRules,
    candidates,
  };
}