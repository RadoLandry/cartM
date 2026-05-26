import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { z } from "zod";

import {
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  InlineStack,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { BundleDiscountType, BundleRuleStatus } from "@prisma/client";

import {
  archiveBundleRule,
  deleteBundleRuleComponent,
  getBundleRuleById,
  getDistinctProductCategoryTagsForShop,
  listBundlePreviewCartItems,
  listBundleRulesForShop,
  listProductsForBundleEditor,
  upsertBundleRule,
  upsertBundleRuleComponent,
} from "../lib/db/queries";
import { detectBundles } from "../lib/cart-intelligence/bundles";
import { authenticate } from "../shopify.server";

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [bundleRules, products, categoryTags] = await Promise.all([
    listBundleRulesForShop(session.shop),
    listProductsForBundleEditor(session.shop),
    getDistinctProductCategoryTagsForShop(session.shop),
  ]);

  return {
    bundleRules,
    products,
    categoryTags,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-bundle-rule") {
    const parsed = SaveBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: parsed.error.message };
    }

    if (parsed.data.status === BundleRuleStatus.ACTIVE) {
      const existingRule = parsed.data.id ? await getBundleRuleById(parsed.data.id) : null;
      if (!existingRule || !existingRule.components.some((component) => component.isRequired)) {
        return { ok: false, intent, error: "active_rule_requires_required_component" };
      }
    }

    try {
      await upsertBundleRule({
        shop: session.shop,
        ...parsed.data,
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
      return { ok: false, intent, error: parsed.error.message };
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
      return { ok: false, intent, error: parsed.error.message };
    }

    await deleteBundleRuleComponent(parsed.data.componentId);
    return { ok: true, intent };
  }

  if (intent === "archive-bundle-rule") {
    const parsed = ArchiveBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: parsed.error.message };
    }

    await archiveBundleRule(parsed.data.bundleRuleId);
    return { ok: true, intent };
  }

  if (intent === "preview-bundle-rule") {
    const parsed = PreviewBundleRuleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, intent, error: parsed.error.message };
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
      primaryAction={{ content: "Create bundle rule", disabled: true }}
    >
      <BlockStack gap="500">
        {actionData?.error ? (
          <Banner tone="warning">
            <p>{actionData.error}</p>
          </Banner>
        ) : null}

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

            {data.bundleRules.length === 0 ? (
              <EmptyState
                heading="No bundle rules yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Bundle rules created here will become the source of truth for deterministic cart offers.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="200">
                {data.bundleRules.map((rule) => (
                  <Card key={rule.id}>
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">
                          {rule.label}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {rule.status} · Priority {rule.priority}
                        </Text>
                      </InlineStack>
                      <Text as="p" variant="bodyMd">
                        {rule.description || "No description yet."}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {rule.components.length} component(s) · {rule.discountType} {rule.discountValue}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Action scaffolding
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              The route already validates the bundle action contracts; persistence and preview execution are wired next.
            </Text>
            <Form method="post">
              <BlockStack gap="300">
                <input type="hidden" name="intent" value="save-bundle-rule" />
                <TextField label="Bundle key" name="key" autoComplete="off" />
                <TextField label="Bundle label" name="label" autoComplete="off" />
                <Button submit>Validate save-bundle-rule intent</Button>
              </BlockStack>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Editor inputs
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {data.products.length} products and {data.categoryTags.length} category tags are available for upcoming bundle-rule editing flows.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}