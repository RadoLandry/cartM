import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { z } from "zod";

import {
  BlockStack,
  Card,
  InlineStack,
  Page,
  Text,
} from "@shopify/polaris";
import { BundleDiscountType, BundleRuleStatus } from "@prisma/client";

import { BundleRuleForm } from "../components/admin/BundleRuleForm";
import { BundleRuleList } from "../components/admin/BundleRuleList";
import { BundleRulePreviewPanel } from "../components/admin/BundleRulePreviewPanel";

import {
  archiveBundleRule,
  createBundleRule,
  deleteBundleRuleComponent,
  duplicateBundleRule,
  getBundleRuleById,
  getDistinctProductCategoryTagsForShop,
  listBundlePreviewCartItems,
  listBundleRulesForShop,
  listProductsForBundleEditor,
  logBundleRuleAuditEvent,
  updateBundleRule,
  upsertBundleRuleComponent,
} from "../lib/db/queries";
import {
  detectBundles,
  validateBundleRuleActivation,
  validateBundleRuleLifecycleTransition,
} from "../lib/cart-intelligence/bundles";
import { authenticate } from "../shopify.server";

const OptionalStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const SaveBundleRuleSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(BundleRuleStatus),
  priority: z.coerce.number().int().min(0),
  completionThreshold: z.coerce.number().gt(0).lte(1),
  discountType: z.nativeEnum(BundleDiscountType),
  discountValue: z.string().min(1),
});

const CreateBundleRuleSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: OptionalStringSchema,
  priority: z.coerce.number().int().min(0).default(100),
  completionThreshold: z.coerce.number().gt(0).lte(1),
  discountType: z.nativeEnum(BundleDiscountType),
  discountValue: z.string().min(1),
});

const UpdateBundleRuleSchema = z.object({
  bundleRuleId: z.string().min(1),
  key: OptionalStringSchema,
  label: OptionalStringSchema,
  description: z.preprocess(
    (value) => (value === undefined ? undefined : value),
    z.string().nullable().optional(),
  ),
  priority: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(0).optional(),
  ),
  completionThreshold: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().gt(0).lte(1).optional(),
  ),
  discountType: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.nativeEnum(BundleDiscountType).optional(),
  ),
  discountValue: OptionalStringSchema,
  status: z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.nativeEnum(BundleRuleStatus).optional(),
  ),
}).refine((data) => {
  const mutableFields = [
    data.key,
    data.label,
    data.description,
    data.priority,
    data.completionThreshold,
    data.discountType,
    data.discountValue,
    data.status,
  ];

  return mutableFields.some((value) => value !== undefined);
}, {
  message: "At least one mutable field is required for updates.",
  path: ["bundleRuleId"],
});

const SaveBundleComponentSchema = z.object({
  id: z.string().optional(),
  bundleRuleId: z.string().min(1),
  componentKey: z.string().min(1),
  label: z.string().min(1),
  isRequired: z.enum(["true", "false"]).transform((value) => value === "true"),
  sortOrder: z.coerce.number().int().min(0),
  minQuantity: z.coerce.number().int().min(1),
  matchMode: z.enum(["CATEGORY", "PRODUCT", "VARIANT", "CATEGORY_OR_PRODUCT"]),
  acceptedCategoryTags: z.string().optional(),
  acceptedShopifyProductIds: z.string().optional(),
  acceptedShopifyVariantIds: z.string().optional(),
});

const DeleteBundleComponentSchema = z.object({
  componentId: z.string().min(1),
});

const ArchiveBundleRuleSchema = z.object({
  bundleRuleId: z.string().min(1),
});

const PreviewBundleRuleSchema = z.object({
  bundleRuleId: z.string().min(1),
  cartFixture: z.string().min(2),
});

const TransitionBundleRuleSchema = z.object({
  bundleRuleId: z.string().min(1),
  toStatus: z.literal(BundleRuleStatus.ACTIVE),
});

const LifecycleTransitionSchema = z.object({
  bundleRuleId: z.string().min(1),
  toStatus: z.enum(["PAUSED", "ACTIVE", "ARCHIVED"] as const),
});

const DuplicateBundleRuleSchema = z.object({
  bundleRuleId: z.string().min(1),
});

const PreviewCartFixtureSchema = z.array(z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.number().int().min(1),
}));

function parseCsvList(raw: string | undefined) {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "form";
      return `${field}: ${issue.message}`;
    })
    .join("; ");
}

function toNullableString(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value.trim() === "" ? null : value;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const selectedRuleId = url.searchParams.get("ruleId");
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const search = url.searchParams.get("q")?.trim() || undefined;

  const [bundleRules, products, categoryTags] = await Promise.all([
    listBundleRulesForShop(session.shop, { includeArchived, search }),
    listProductsForBundleEditor(session.shop),
    getDistinctProductCategoryTagsForShop(session.shop),
  ]);

  const selectedRule = selectedRuleId
    ? bundleRules.find((rule) => rule.id === selectedRuleId) ?? null
    : null;

  const validationByRuleId = Object.fromEntries(
    bundleRules.map((rule) => [
      rule.id,
      validateBundleRuleActivation(rule).map((issue) => issue.message),
    ]),
  );

  return {
    bundleRules,
    products,
    categoryTags,
    selectedRule,
    selectedRuleId,
    includeArchived,
    search: search ?? "",
    validationByRuleId,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "create-bundle-rule") {
    const parsed = CreateBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    try {
      const rule = await createBundleRule({
        shop: session.shop,
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority,
        completionThreshold: parsed.data.completionThreshold,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
      });

      await logBundleRuleAuditEvent({
        bundleRuleId: rule.id,
        actionType: "CREATED",
        actorId: session.shop,
        changeSummary: {
          key: rule.key,
          label: rule.label,
          status: rule.status,
        },
      });

      return { ok: true, intent, ruleId: rule.id };
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return { ok: false, intent, error: "A bundle rule with this key already exists." };
      }

      throw err;
    }
  }

  if (intent === "update-bundle-rule") {
    const parsed = UpdateBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const updatedRule = await updateBundleRule({
      id: parsed.data.bundleRuleId,
      shop: session.shop,
      key: parsed.data.key,
      label: parsed.data.label,
      description: toNullableString(parsed.data.description ?? undefined),
      priority: parsed.data.priority,
      completionThreshold: parsed.data.completionThreshold,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      status: parsed.data.status,
    });

    if (!updatedRule) {
      return { ok: false, intent, error: "Bundle rule not found." };
    }

    await logBundleRuleAuditEvent({
      bundleRuleId: updatedRule.id,
      actionType: "UPDATED",
      actorId: session.shop,
      changeSummary: {
        fields: Object.keys(parsed.data).filter((key) => key !== "bundleRuleId"),
      },
    });

    return { ok: true, intent, ruleId: updatedRule.id };
  }

  if (intent === "save-bundle-rule") {
    const parsed = SaveBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    if (parsed.data.id) {
      const updatedRule = await updateBundleRule({
        id: parsed.data.id,
        shop: session.shop,
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        completionThreshold: parsed.data.completionThreshold,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
      });

      if (!updatedRule) {
        return { ok: false, intent, error: "not_found" };
      }

      await logBundleRuleAuditEvent({
        bundleRuleId: updatedRule.id,
        actionType: "UPDATED",
        actorId: session.shop,
        changeSummary: {
          sourceIntent: "save-bundle-rule",
        },
      });

      return { ok: true, intent, ruleId: updatedRule.id };
    }

    try {
      const createdRule = await createBundleRule({
        shop: session.shop,
        key: parsed.data.key,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        completionThreshold: parsed.data.completionThreshold,
        discountType: parsed.data.discountType,
        discountValue: parsed.data.discountValue,
      });

      await logBundleRuleAuditEvent({
        bundleRuleId: createdRule.id,
        actionType: "CREATED",
        actorId: session.shop,
        changeSummary: {
          sourceIntent: "save-bundle-rule",
        },
      });
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        return { ok: false, intent, error: "duplicate" };
      }

      throw err;
    }

    return { ok: true, intent };
  }

  if (intent === "save-bundle-component") {
    const parsed = SaveBundleComponentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    await upsertBundleRuleComponent({
      ...parsed.data,
      acceptedCategoryTags: parseCsvList(parsed.data.acceptedCategoryTags),
      acceptedShopifyProductIds: parseCsvList(parsed.data.acceptedShopifyProductIds),
      acceptedShopifyVariantIds: parseCsvList(parsed.data.acceptedShopifyVariantIds),
    });

    return { ok: true, intent };
  }

  if (intent === "delete-bundle-component") {
    const parsed = DeleteBundleComponentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    await deleteBundleRuleComponent(parsed.data.componentId);
    return { ok: true, intent };
  }

  if (intent === "archive-bundle-rule") {
    const parsed = ArchiveBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const existingRule = await getBundleRuleById(parsed.data.bundleRuleId);
    await archiveBundleRule(parsed.data.bundleRuleId);

    await logBundleRuleAuditEvent({
      bundleRuleId: parsed.data.bundleRuleId,
      actionType: "ARCHIVED",
      actorId: session.shop,
      fromStatus: existingRule?.status,
      toStatus: BundleRuleStatus.ARCHIVED,
      changeSummary: { sourceIntent: "archive-bundle-rule" },
    });

    return { ok: true, intent };
  }

  if (intent === "pause-bundle-rule" || intent === "resume-bundle-rule") {
    const parsed = LifecycleTransitionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const rule = await getBundleRuleById(parsed.data.bundleRuleId);
    if (!rule) {
      return { ok: false, intent, error: "not_found" };
    }

    const transition = validateBundleRuleLifecycleTransition(rule.status, parsed.data.toStatus);
    if (!transition.allowed) {
      return { ok: false, intent, error: transition.code, message: transition.message, ruleId: rule.id };
    }

    const updatedRule = await updateBundleRule({
      id: rule.id,
      shop: session.shop,
      status: parsed.data.toStatus as BundleRuleStatus,
    });

    if (!updatedRule) {
      return { ok: false, intent, error: "not_found" };
    }

    await logBundleRuleAuditEvent({
      bundleRuleId: updatedRule.id,
      actionType: "STATUS_CHANGED",
      actorId: session.shop,
      fromStatus: rule.status,
      toStatus: updatedRule.status,
      changeSummary: { from: rule.status, to: updatedRule.status, sourceIntent: intent },
    });

    return { ok: true, intent, ruleId: updatedRule.id, status: updatedRule.status };
  }

  if (intent === "duplicate-bundle-rule") {
    const parsed = DuplicateBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const duplicated = await duplicateBundleRule(parsed.data.bundleRuleId);
    if (!duplicated) {
      return { ok: false, intent, error: "not_found" };
    }

    await logBundleRuleAuditEvent({
      bundleRuleId: duplicated.id,
      actionType: "DUPLICATED",
      actorId: session.shop,
      fromStatus: null,
      toStatus: duplicated.status,
      changeSummary: { sourceRuleId: parsed.data.bundleRuleId },
    });

    return { ok: true, intent, ruleId: duplicated.id };
  }

  if (intent === "transition-bundle-rule-status") {
    const parsed = TransitionBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const rule = await getBundleRuleById(parsed.data.bundleRuleId);
    if (!rule) {
      return { ok: false, intent, error: "not_found" };
    }

    if (rule.status !== BundleRuleStatus.DRAFT) {
      return { ok: false, intent, error: `invalid_transition_from_${rule.status.toLowerCase()}` };
    }

    const validationIssues = validateBundleRuleActivation(rule);
    if (validationIssues.length > 0) {
      return {
        ok: false,
        intent,
        error: "activation_validation_failed",
        validationIssues,
        ruleId: rule.id,
      };
    }

    const updatedRule = await updateBundleRule({
      id: rule.id,
      shop: session.shop,
      status: parsed.data.toStatus,
    });

    if (!updatedRule) {
      return { ok: false, intent, error: "not_found" };
    }

    await logBundleRuleAuditEvent({
      bundleRuleId: updatedRule.id,
      actionType: "STATUS_CHANGED",
      actorId: session.shop,
      fromStatus: rule.status,
      toStatus: updatedRule.status,
      changeSummary: {
        from: rule.status,
        to: updatedRule.status,
      },
    });

    return {
      ok: true,
      intent,
      ruleId: updatedRule.id,
      status: updatedRule.status,
    };
  }

  if (intent === "preview-bundle-rule") {
    const parsed = PreviewBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: formatSchemaError(parsed.error) };
    }

    const cartFixture = PreviewCartFixtureSchema.safeParse(JSON.parse(parsed.data.cartFixture));
    if (!cartFixture.success) {
      return { ok: false, intent, error: cartFixture.error.message };
    }

    const rule = await getBundleRuleById(parsed.data.bundleRuleId);
    if (!rule) {
      return { ok: false, intent, error: "not_found" };
    }

    const cartItems = await listBundlePreviewCartItems(session.shop, cartFixture.data);
    const preview = detectBundles({
      shop: session.shop,
      cartItems,
      bundleRules: [rule],
    });

    return { ok: true, intent, preview: preview.matches[0] ?? null };
  }

  return { ok: false, intent, error: "Unknown bundle action intent." };
};

export default function BundleRulesPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page
      title="Bundle manager"
      subtitle="Configure deterministic bundle rules that power cart qualification and completion guidance."
      primaryAction={{ content: "Create bundle rule", url: "/app/bundles" }}
    >
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Existing rules
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.bundleRules.length} rules loaded
              </Text>
            </InlineStack>

            <BundleRuleList
              bundleRules={data.bundleRules}
              selectedRuleId={data.selectedRuleId}
              validationByRuleId={data.validationByRuleId}
              includeArchived={data.includeArchived}
              search={data.search}
            />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Create and edit
            </Text>
            <BundleRuleForm
              selectedRule={data.selectedRule}
              categoryTags={data.categoryTags}
              actionData={actionData}
            />
          </BlockStack>
        </Card>

        <Card>
          <BundleRulePreviewPanel
            productCount={data.products.length}
            categoryCount={data.categoryTags.length}
            bundleRules={data.bundleRules}
            actionData={actionData}
          />
        </Card>
      </BlockStack>
    </Page>
  );
}