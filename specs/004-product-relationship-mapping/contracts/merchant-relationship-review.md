# Contract: Merchant Relationship Review Action

## Purpose

Define the admin action contract for approving, editing, rejecting, or creating a relationship from the embedded knowledge-graph UI.

## Action Payload

```json
{
  "intent": "save-relationship",
  "sourceProductId": "prod_1",
  "targetProductId": "prod_2",
  "relationshipType": "COMPLEMENTS",
  "directionality": "DIRECTIONAL",
  "strength": 0.95,
  "action": "APPROVE"
}
```

## Alternate Actions

- `APPROVE`: promote candidate to active.
- `UPDATE`: change relationship type, strength, or directionality.
- `REJECT`: persist suppression for the normalized pair and type.
- `CREATE`: create a merchant-authored active relationship.
- `DISABLE`: remove an active relationship from the approved view without deleting its history.

## Response Shape

```json
{
  "ok": true,
  "relationship": {
    "sourceProductId": "prod_1",
    "targetProductId": "prod_2",
    "relationshipType": "COMPLEMENTS",
    "status": "ACTIVE",
    "origin": "MERCHANT"
  }
}
```

## Validation Rules

- Product IDs must resolve to products owned by the authenticated shop.
- A product cannot be related to itself.
- Relationship type and action must be members of the allowed enum sets.
- Symmetric relationship types must be normalized before persistence.