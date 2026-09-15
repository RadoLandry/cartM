# CartMind Execution Tasks

## How to use this file

- Work sprint by sprint in order.
- Do not start a sprint until the previous sprint exit criteria are met.
- Check items as completed.

---

## Sprint 1 - Fast closure and stabilization

### Scope execution
- [x] Complete feature 025 tasks T053 to T058
- [x] Complete feature 014 task T021
- [x] Complete feature 017 tasks T032 to T036
- [x] Complete feature 002 tasks T011 to T012
- [x] Complete feature 011 tasks T025 to T026

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run full vitest
- [x] Confirm zero open tasks in 002, 011, 014, 017, 025

---

## Sprint 2 - Admin sync and product relationships

### Scope execution
- [x] Complete feature 001 tasks T035 to T041
- [x] Complete feature 004 tasks T013 to T019
- [x] Complete feature 001 tasks T042 to T045

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration routes app-index-sync-status
- [x] Run tests integration routes knowledge-graph-relationships
- [x] Confirm sync dashboard load, error, retry behavior in admin

---

## Sprint 3 - Downstream relationships and KG editor part 1

### Scope execution
- [x] Complete feature 004 tasks T020 to T028
- [x] Complete feature 021 tasks T016 to T022

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration routes knowledge-graph-relationships
- [x] Run tests integration knowledge-graph-editor review-mutations
- [x] Confirm approved relationships are available for downstream consumers

---

## Sprint 4 - KG editor part 2

### Scope execution
- [x] Complete feature 021 tasks T023 to T029
- [x] Complete feature 021 tasks T030 to T037
- [x] Complete feature 021 tasks T038 to T044

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration knowledge-graph-editor bulk-actions
- [x] Run tests integration knowledge-graph-editor propagation-contract
- [x] Confirm size mapping CRUD, bulk actions, audit history, propagation checks

---

## Sprint 5 - Size conflicts and kits

### Scope execution
- [x] Complete feature 008 tasks T009 to T014
- [x] Complete feature 007 tasks T016 to T020
- [x] Complete feature 008 tasks T015 to T019
- [x] Complete feature 007 tasks T021 to T022
- [x] Complete feature 008 tasks T020 to T025

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests unit knowledge-graph kits
- [x] Run tests unit knowledge-graph size-conflicts
- [x] Run tests integration routes knowledge-graph-size-conflicts
- [x] Confirm low-noise behavior on edge cases

---

## Sprint 6 - Thresholds and bundle detection

### Scope execution
- [x] Complete feature 010 tasks T013 to T017
- [x] Complete feature 009 tasks T019, T021, T022
- [x] Complete feature 010 tasks T018 to T022
- [x] Complete feature 009 tasks T024 to T025
- [x] Complete feature 010 tasks T023 to T030

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests unit cart-intelligence threshold
- [x] Run tests unit cart-intelligence threshold-recommendations
- [x] Run tests unit knowledge-graph bundles
- [x] Run tests integration routes threshold-manager
- [x] Confirm threshold suppression and qualified outcomes are correct

---

## Sprint 7 - Bundle rule manager

### Scope execution
- [x] Complete feature 022 tasks T019 to T025
- [x] Complete feature 022 tasks T026 to T032
- [x] Complete feature 022 tasks T033 to T035

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration routes bundle-rule-manager
- [x] Run tests unit cart-intelligence bundle-detection
- [x] Run tests unit cart-intelligence bundle-recommendations
- [x] Confirm lifecycle actions pause, archive, duplicate and preview are stable

---

## Sprint 8 - Customer profile and replenishment

### Scope execution
- [x] Complete feature 012 tasks T020 to T024
- [x] Complete feature 013 tasks T009 to T014
- [x] Complete feature 012 tasks T025 to T029
- [x] Complete feature 013 tasks T015 to T020
- [x] Complete feature 012 tasks T030 to T033
- [x] Complete feature 013 tasks T021 to T027
- [x] Complete feature 013 tasks T028 to T036

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration routes replenishment-recommendations
- [x] Run tests integration routes webhooks-orders-create-replenishment
- [x] Confirm personalization precedence, confidence and noise control

---

## Sprint 9 - AI behavior and budget optimization

### Scope execution
- [x] Complete feature 018 task T019
- [x] Complete feature 024 tasks T032 to T043
- [x] Complete feature 018 tasks T020 to T026
- [x] Complete feature 024 tasks T044 to T055
- [x] Complete feature 018 tasks T027 to T033
- [x] Complete feature 024 tasks T056 to T061
- [x] Complete feature 018 tasks T034 to T038

### Quality gate
- [x] Run lint
- [x] Run typecheck
- [x] Run tests integration ai-behavior preview, publish, rollback suites
- [x] Run tests integration routes storefront-chat-budget-optimization
- [x] Confirm AI preview publish rollback and budget guardrails are operational

---

## Sprint 10 - Analytics, billing, release candidate

### Scope execution
- [ ] Create plan, spec and tasks for feature 023 analytics dashboard
- [ ] Implement feature 023 and close all its tasks
- [ ] Implement Shopify Billing API end to end
- [ ] Execute cross-cutting QA on e2e, performance, and Shopify compliance

### Quality gate
- [ ] Run lint
- [ ] Run typecheck
- [ ] Run full vitest
- [ ] Run Shopify app configuration validation
- [ ] Confirm App Store release candidate checklist is complete

---

## Global release checklist

- [ ] No critical regression on recommendations, chat actions, storefront widget, checkout UI extension, or bundle functions
- [ ] Storefront p95 remains within target
- [ ] All sprint task groups have zero open items
- [ ] Final documentation and merchant guidance are updated
