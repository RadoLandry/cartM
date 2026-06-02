# Contract: Bundle Rule Manager Admin Surface

## Scope
Defines loader/action contract for merchant bundle rule management in the embedded admin route.

## Loader response

`GET /app/bundles`

Response shape:
- shopId: string
- rules: array of
  - id: string
  - name: string
  - status: DRAFT | ACTIVE | PAUSED | ARCHIVED
  - priority: number
  - requirementCount: number
  - lastUpdatedAt: datetime
  - lastUpdatedBy: string
- filters: object
  - status: optional enum
  - search: optional string

Requirements:
- Returns only rules for authenticated shop.
- Excludes archived rules by default unless explicitly requested.

## Action: Create rule

`POST /app/bundles?action=create`

Request payload:
- name: string
- description?: string
- priority?: number
- minimumQualifiedItems: number
- discountType: PERCENTAGE | FIXED
- discountValue: number
- requirements: array of
  - productId: string
  - variantId?: string
  - quantityRequired: number
  - requirementType: REQUIRED | OPTIONAL

Response:
- success: boolean
- ruleId?: string
- errors?: array of field/message

## Action: Update rule

`POST /app/bundles?action=update`

Request payload:
- ruleId: string
- mutable fields from create payload

Response:
- success: boolean
- version: number
- errors?: array

## Action: Transition status

`POST /app/bundles?action=transition`

Request payload:
- ruleId: string
- toStatus: ACTIVE | PAUSED | ARCHIVED

Response:
- success: boolean
- newStatus?: enum
- errors?: array

## Action: Duplicate rule

`POST /app/bundles?action=duplicate`

Request payload:
- ruleId: string
- newName?: string

Response:
- success: boolean
- duplicatedRuleId?: string
- errors?: array

## Validation semantics

- All action payloads are schema-validated before write operations.
- Validation failures return field-level errors and no state mutation.
- Unauthorized shop access returns 403 and no data leakage.
