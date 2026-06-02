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
