# Contract: Bundle Rule Evaluation

## Scope
Defines deterministic evaluation input/output used by both admin preview and active cart intelligence consumption.

## Input contract

Entity: RuleEvaluationRequest
- shopId: string
- cartLines: array
  - productId: string
  - variantId?: string
  - quantity: number
- candidateRuleIds?: string[]
- now?: datetime

Rules:
- cartLines must be non-empty.
- quantity must be >= 1.
- rule candidates, if provided, must belong to shop.

## Output contract

Entity: RuleEvaluationResult
- matched: boolean
- winningRuleId?: string
- qualificationRatio: number (0..1)
- satisfiedRequirements: array
- missingRequirements: array
- overlapCandidates: array of
  - ruleId: string
  - qualificationRatio: number
  - tieBreakReason: string
- discount:
  - type: PERCENTAGE | FIXED
  - value: number
- decisionTrace: string[]

Determinism requirements:
- Same input always returns same winner and decisionTrace.
- Tie-break order is stable and documented.

## Non-qualification response

When `matched=false`:
- `winningRuleId` omitted
- `discount` omitted
- `missingRequirements` populated when partial qualification exists
- `decisionTrace` includes primary failure reason
