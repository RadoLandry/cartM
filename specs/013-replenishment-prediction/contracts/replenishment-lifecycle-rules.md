# Contract: Replenishment Lifecycle Rules

## Purpose

Defines the locally persisted rule shape that marks categories as replenishment-eligible and assigns their replacement windows.

## Rule Shape

```ts
interface ReplenishmentLifecycleRule {
  shop: string;
  categoryTag: string;
  label: string;
  windowMinDays: number;
  windowMaxDays: number;
  priority: number;
  defaultAction: "reorder" | "upgrade_optional";
  source: "seeded" | "merchant";
  isActive: boolean;
}
```

## Validation Rules

- `categoryTag` must map to categories already used by the local product catalog.
- `windowMinDays` must be positive and `windowMaxDays` must be greater than or equal to `windowMinDays`.
- Lower `priority` values represent more urgent or more important replenishment categories.
- Only one active rule per `shop + categoryTag` may exist at a time.

## Processing Rules

- Seeded defaults provide the initial ruleset for categories such as wraps, mouthguards, and gloves.
- Merchant-sourced rules override seeded defaults for the same `shop + categoryTag`.
- Deactivated rules remove that category from shopper-facing replenishment evaluation without deleting historical purchase snapshots.

## Consumer Expectations

- Replenishment evaluation joins shopper purchase snapshots against active rules only.
- Rule updates take effect on the next evaluation cycle without requiring shopper profile migration.
- Historical purchase snapshots remain intact even if a rule window changes later.