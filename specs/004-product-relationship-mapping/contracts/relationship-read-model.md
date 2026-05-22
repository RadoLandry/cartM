# Contract: Approved Relationship Read Model

## Purpose

Define the internal read contract that downstream cart intelligence features consume.

## Request Shape

```json
{
  "shop": "venum.myshopify.com",
  "productIds": ["prod_1"],
  "relationshipTypes": ["COMPLEMENTS", "CONFLICTS"],
  "limitPerType": 5,
  "activeOnly": true
}
```

## Response Shape

```json
{
  "products": [
    {
      "productId": "prod_1",
      "relationships": [
        {
          "relatedProductId": "prod_2",
          "relationshipType": "COMPLEMENTS",
          "directionality": "DIRECTIONAL",
          "strength": 0.92,
          "origin": "AUTO",
          "status": "ACTIVE"
        },
        {
          "relatedProductId": "prod_3",
          "relationshipType": "CONFLICTS",
          "directionality": "SYMMETRIC",
          "strength": 0.88,
          "origin": "MERCHANT",
          "status": "ACTIVE"
        }
      ]
    }
  ]
}
```

## Rules

- Only `ACTIVE` relationships are returned.
- Relationships tied to invalid, deleted, or unavailable products are excluded.
- Merchant-authored state takes precedence over automated suggestions before the response is built.
- Response ordering is descending by `strength` within each relationship type unless a caller-specific ranking layer applies later.