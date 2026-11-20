import type { BudgetOptimizationCandidate, BudgetOptimizationResult, StorefrontChatRequest } from "../ai/schemas";

export function budgetCartFingerprint(cart: StorefrontChatRequest["cart"]) {
  return JSON.stringify([
    cart.cartId ?? "", cart.currencyCode, cart.subtotal ?? "",
    cart.items.map((item) => [item.lineId ?? "", item.productId, item.variantId ?? "", item.quantity, item.finalLinePrice ?? null])
      .sort((first, second) => String(first[0]).localeCompare(String(second[0]))),
  ]);
}

export function buildBudgetOptimizationSummary(result: BudgetOptimizationResult, cart: StorefrontChatRequest["cart"], french: boolean) {
  const money = (amount: number) => new Intl.NumberFormat(french ? "fr-FR" : "en-US", { style: "currency", currency: cart.currencyCode }).format(amount);
  const totals = french
    ? `Sous-total actuel : ${money(result.baselineSubtotal)}. Budget maximum : ${money(result.targetBudgetAmount)}.`
    : `Current subtotal: ${money(result.baselineSubtotal)}. Maximum budget: ${money(result.targetBudgetAmount)}.`;
  if (result.status === "within_budget") return `${totals} ${french ? "Votre panier respecte deja ce budget. Aucun changement propose." : "Your cart is already within budget. No changes proposed."}`;
  const changes = new Map<string, number>();
  for (const candidate of result.candidates) changes.set(candidate.sourceLineId, (changes.get(candidate.sourceLineId) ?? 0) + 1);
  const details = [...changes].map(([lineId, count]) => {
    const item = cart.items.find((line) => (line.lineId || line.productId) === lineId);
    const candidate = result.candidates.find((entry) => entry.sourceLineId === lineId)!;
    const title = item?.productTitle || candidate.sourceProductId;
    const quantity = candidate.changeType === "remove" ? 0 : Math.max(0, (item?.quantity ?? count) - count);
    return `${title} : ${item?.quantity ?? "?"} -> ${quantity}`;
  }).join("; ");
  return french
    ? `${totals} Proposition : ${details}. Economie estimee : ${money(result.baselineSubtotal - result.projectedSubtotal)}. Nouveau sous-total estime : ${money(result.projectedSubtotal)}. Les protections sont conservees. ${result.projectedGapAmount > 0 ? `Le budget reste depasse de ${money(result.projectedGapAmount)}. ` : ""}Sous reserve du recalcul des promotions par Shopify. Aucun changement sans votre confirmation.`
    : `${totals} Proposed changes: ${details}. Estimated savings: ${money(result.baselineSubtotal - result.projectedSubtotal)}. Estimated new subtotal: ${money(result.projectedSubtotal)}. Protective equipment is preserved. ${result.projectedGapAmount > 0 ? `Still over budget by ${money(result.projectedGapAmount)}. ` : ""}Subject to Shopify recalculating promotions. Review the proposed changes below, then choose whether to apply or decline.`;
}

export interface BudgetOptimizationCandidateInput {
  candidateId: string;
  changeType: BudgetOptimizationCandidate["changeType"];
  sourceLineId: string;
  sourceProductId: string;
  sourceVariantId?: string;
  targetProductId?: string;
  targetVariantId?: string;
  estimatedSavings: number;
  safetyCriticalImpact: BudgetOptimizationCandidate["safetyCriticalImpact"];
  rationale: string;
  disciplineFitScore: number;
  availability: BudgetOptimizationCandidate["availability"];
}

export interface BuildBudgetOptimizationProposalInput {
  optimizationContextId: string;
  requestId: string;
  baselineSubtotal: number;
  targetBudgetAmount: number;
  candidates: BudgetOptimizationCandidateInput[];
  fetchedAt: string;
}

function clampCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function rankBudgetOptimizationCandidates(candidates: BudgetOptimizationCandidateInput[]): BudgetOptimizationCandidate[] {
  return candidates
    .filter((candidate) => candidate.availability !== "unavailable")
    .filter((candidate) => candidate.safetyCriticalImpact === "none")
    .sort((a, b) => {
      const safetyRank = {
        none: 0,
        reduced_protection: 1,
        critical_removal: 2,
      } as const;

      if (safetyRank[a.safetyCriticalImpact] !== safetyRank[b.safetyCriticalImpact]) {
        return safetyRank[a.safetyCriticalImpact] - safetyRank[b.safetyCriticalImpact];
      }

      if ((a.changeType === "defer") !== (b.changeType === "defer")) {
        return a.changeType === "defer" ? -1 : 1;
      }

      if (b.estimatedSavings !== a.estimatedSavings) {
        return b.estimatedSavings - a.estimatedSavings;
      }

      return b.disciplineFitScore - a.disciplineFitScore;
    });
}

function selectCandidatesForTarget(
  rankedCandidates: BudgetOptimizationCandidate[],
  baselineSubtotal: number,
  targetBudgetAmount: number,
) {
  const selected: BudgetOptimizationCandidate[] = [];
  let projectedSubtotal = baselineSubtotal;

  for (const candidate of rankedCandidates) {
    if (projectedSubtotal <= targetBudgetAmount) {
      break;
    }

    if (selected.some((existing) => existing.sourceLineId === candidate.sourceLineId
      && (existing.changeType === "remove" || candidate.changeType === "remove"))) continue;
    selected.push(candidate);
    projectedSubtotal = Math.max(projectedSubtotal - candidate.estimatedSavings, 0);
  }

  return {
    selectedCandidates: selected,
    projectedSubtotal: clampCurrency(projectedSubtotal),
  };
}

export function buildBudgetOptimizationProposal(
  input: BuildBudgetOptimizationProposalInput,
): BudgetOptimizationResult {
  const rankedCandidates = rankBudgetOptimizationCandidates(input.candidates);

  if (input.baselineSubtotal <= input.targetBudgetAmount) {
    return {
      optimizationContextId: input.optimizationContextId,
      requestId: input.requestId,
      generatedAt: new Date().toISOString(),
      baselineSubtotal: clampCurrency(input.baselineSubtotal),
      targetBudgetAmount: clampCurrency(input.targetBudgetAmount),
      projectedSubtotal: clampCurrency(input.baselineSubtotal),
      projectedGapAmount: 0,
      status: "within_budget",
      candidates: [],
      constraints: [],
      freshness: {
        priceCheckedAt: input.fetchedAt,
        availabilityCheckedAt: input.fetchedAt,
      },
    };
  }

  const selection = selectCandidatesForTarget(
    rankedCandidates,
    input.baselineSubtotal,
    input.targetBudgetAmount,
  );
  const projectedSubtotal = selection.projectedSubtotal;
  const projectedGapAmount = clampCurrency(Math.max(projectedSubtotal - input.targetBudgetAmount, 0));

  const status: BudgetOptimizationResult["status"] = selection.selectedCandidates.length === 0
    ? "insufficient_candidates"
    : projectedGapAmount > 0
      ? "constraint_blocked"
      : "optimized";

  const constraints = [
    "Safety-critical products are protected from removal.",
    "Only in-stock alternatives are considered for automatic proposals.",
  ];

  return {
    optimizationContextId: input.optimizationContextId,
    requestId: input.requestId,
    generatedAt: new Date().toISOString(),
    baselineSubtotal: clampCurrency(input.baselineSubtotal),
    targetBudgetAmount: clampCurrency(input.targetBudgetAmount),
    projectedSubtotal,
    projectedGapAmount,
    status,
    candidates: selection.selectedCandidates,
    constraints,
    freshness: {
      priceCheckedAt: input.fetchedAt,
      availabilityCheckedAt: input.fetchedAt,
    },
  };
}
