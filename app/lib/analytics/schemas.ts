import { z } from "zod";

export const analyticsCustomerTypeSchema = z.enum([
  "ALL",
  "ANONYMOUS",
  "LOGGED_IN",
]);

export const analyticsDateRangeSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be less than or equal to endDate",
    path: ["startDate"],
  });

export const analyticsBaselineModeSchema = z.enum([
  "previous_period",
  "custom",
]);

export const analyticsDashboardQuerySchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    baselineMode: analyticsBaselineModeSchema.default("previous_period"),
    baselineStartDate: z.string().date().optional(),
    baselineEndDate: z.string().date().optional(),
    customerType: analyticsCustomerTypeSchema.default("ALL"),
  })
  .superRefine((value, ctx) => {
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be less than or equal to endDate",
        path: ["startDate"],
      });
    }

    if (value.baselineMode === "custom") {
      if (!value.baselineStartDate || !value.baselineEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom baseline requires baselineStartDate and baselineEndDate",
          path: ["baselineStartDate"],
        });
        return;
      }

      if (value.baselineStartDate > value.baselineEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "baselineStartDate must be less than or equal to baselineEndDate",
          path: ["baselineStartDate"],
        });
      }
    }
  });

export type AnalyticsDashboardQuery = z.infer<typeof analyticsDashboardQuerySchema>;

export const analyticsExportRequestSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    customerType: analyticsCustomerTypeSchema.default("ALL"),
    format: z.enum(["CSV"]).default("CSV"),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be less than or equal to endDate",
    path: ["startDate"],
  });

export function parseAnalyticsDashboardQuery(input: unknown): AnalyticsDashboardQuery {
  return analyticsDashboardQuerySchema.parse(input);
}

export function parseAnalyticsExportRequest(input: unknown) {
  return analyticsExportRequestSchema.safeParse(input);
}
