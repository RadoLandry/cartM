import { z } from "zod";

export const KnowledgeGraphIntentSchema = z.enum([
  "override-taxonomy",
  "save-visual-override",
  "reset-visual-override",
  "save-compatibility-rule",
  "delete-compatibility-rule",
  "save-size-chart-override",
  "reset-size-chart-override",
  "create-cross-size-mapping",
  "delete-cross-size-mapping",
  "upsert-size-mapping-rule",
  "deactivate-size-mapping-rule",
  "preview-bulk-operation",
  "confirm-bulk-operation",
  "cancel-bulk-operation",
]);

export const KnowledgeGraphMutationEnvelopeSchema = z.object({
  intent: KnowledgeGraphIntentSchema,
  actorId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

export function mapZodErrorToFieldErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// Size mapping governance schemas (T023, T025)
// ---------------------------------------------------------------------------

export const UpsertSizeMappingRuleSchema = z
  .object({
    sourceCategoryTag: z.string().trim().min(1, "Source category is required"),
    sourceSize: z.string().trim().min(1, "Source size is required"),
    targetCategoryTag: z.string().trim().min(1, "Target category is required"),
    targetSize: z.string().trim().min(1, "Target size is required"),
    severityOnMismatch: z.enum(["WARNING", "ERROR"]).default("WARNING"),
    expectedRevision: z.number().int().optional(),
  })
  .refine((d) => d.sourceCategoryTag !== d.targetCategoryTag, {
    path: ["targetCategoryTag"],
    message: "Source and target category must differ",
  });

export const DeactivateSizeMappingRuleSchema = z.object({
  mappingId: z.string().min(1),
  expectedRevision: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// Bulk operation governance schemas (T030, T033)
// ---------------------------------------------------------------------------

export const BulkTargetFilterSchema = z.object({
  productIds: z.array(z.string()).optional(),
  disciplineTags: z.array(z.string()).optional(),
  categoryTags: z.array(z.string()).optional(),
  search: z.string().optional(),
});

export const BulkChangePayloadSchema = z.object({
  disciplineTagsToAdd: z.array(z.string()).optional(),
  disciplineTagsToRemove: z.array(z.string()).optional(),
  categoryTagsToAdd: z.array(z.string()).optional(),
  categoryTagsToRemove: z.array(z.string()).optional(),
});

export const PreviewBulkOperationSchema = z.object({
  operationType: z.enum(["RECLASSIFY", "RELATIONSHIP_UPDATE", "TAG_APPLY", "TAG_REMOVE"]),
  filter: BulkTargetFilterSchema,
  changePayload: BulkChangePayloadSchema,
});

export const ConfirmBulkOperationSchema = z.object({
  operationId: z.string().min(1),
  previewHash: z.string().min(1),
});

export const CancelBulkOperationSchema = z.object({
  operationId: z.string().min(1),
});

