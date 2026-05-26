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
import {
  ThresholdBenefitType,
  ThresholdDuplicatePurchasePolicy,
  ThresholdRuleStatus,
} from "@prisma/client";

import {
  getDistinctDisciplineTagsForShop,
  getDistinctProductCategoryTagsForShop,
  listProductsForThresholdEditor,
  listThresholdRulesForShop,
} from "../lib/db/queries";
import { authenticate } from "../shopify.server";

const SaveThresholdRuleSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(ThresholdRuleStatus),
  priority: z.coerce.number().int().min(0),
  benefitType: z.nativeEnum(ThresholdBenefitType),
  benefitLabel: z.string().min(1),
  targetSubtotal: z.string().min(1),
  actionableWindow: z.string().min(1),
  allowOvershoot: z.enum(["true", "false"]),
  maxSuggestions: z.coerce.number().int().min(1).max(3),
  supportedCategoryTags: z.string().optional(),
  supportedDisciplineTags: z.string().optional(),
  excludedShopifyProductIds: z.string().optional(),
  duplicatePurchasePolicy: z.nativeEnum(ThresholdDuplicatePurchasePolicy),
});

const ArchiveThresholdRuleSchema = z.object({
  thresholdRuleId: z.string().min(1),
});

const PreviewThresholdRuleSchema = z.object({
  thresholdRuleId: z.string().min(1),
  cartFixture: z.string().min(2),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [thresholdRules, products, categoryTags, disciplineTags] = await Promise.all([
    listThresholdRulesForShop(session.shop),
    listProductsForThresholdEditor(session.shop),
    getDistinctProductCategoryTagsForShop(session.shop),
    getDistinctDisciplineTagsForShop(session.shop),
  ]);

  return {
    thresholdRules,
    products,
    categoryTags,
    disciplineTags,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-threshold-rule") {
    const parsed = SaveThresholdRuleSchema.safeParse(Object.fromEntries(formData));
    return parsed.success
      ? { ok: true, intent, scaffold: true }
      : { ok: false, intent, error: parsed.error.message };
  }

  if (intent === "archive-threshold-rule") {
    const parsed = ArchiveThresholdRuleSchema.safeParse(Object.fromEntries(formData));
    return parsed.success
      ? { ok: true, intent, scaffold: true }
      : { ok: false, intent, error: parsed.error.message };
  }

  if (intent === "preview-threshold-rule") {
    const parsed = PreviewThresholdRuleSchema.safeParse(Object.fromEntries(formData));
    return parsed.success
      ? { ok: true, intent, scaffold: true, preview: null }
      : { ok: false, intent, error: parsed.error.message };
  }

  return { ok: false, intent, error: "Unknown threshold action intent." };
};

export default function ThresholdRulesPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page
      title="Threshold manager"
      subtitle="Configure deterministic spend thresholds that power near-threshold cart suggestions."
      primaryAction={{ content: "Create threshold rule", disabled: true }}
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
                {data.thresholdRules.length} rules loaded
              </Text>
            </InlineStack>

            {data.thresholdRules.length === 0 ? (
              <EmptyState
                heading="No threshold rules yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Threshold rules created here will become the source of truth for deterministic near-threshold prompts.</p>
              </EmptyState>
            ) : (
              <BlockStack gap="200">
                {data.thresholdRules.map((rule) => (
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
                        {rule.benefitType} · Target ${rule.targetSubtotal.toFixed(2)} · Window ${rule.actionableWindow.toFixed(2)}
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
              The route now validates threshold action contracts; persistence and preview execution are wired next.
            </Text>
            <Form method="post">
              <BlockStack gap="300">
                <input type="hidden" name="intent" value="save-threshold-rule" />
                <input type="hidden" name="status" value="DRAFT" />
                <input type="hidden" name="priority" value="10" />
                <input type="hidden" name="benefitType" value="FREE_SHIPPING" />
                <input type="hidden" name="benefitLabel" value="Free shipping" />
                <input type="hidden" name="targetSubtotal" value="100" />
                <input type="hidden" name="actionableWindow" value="25" />
                <input type="hidden" name="allowOvershoot" value="true" />
                <input type="hidden" name="maxSuggestions" value="3" />
                <input type="hidden" name="duplicatePurchasePolicy" value="DISALLOW" />
                <TextField label="Threshold key" name="key" autoComplete="off" />
                <TextField label="Threshold label" name="label" autoComplete="off" />
                <Button submit>Validate save-threshold-rule intent</Button>
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
              {data.products.length} products, {data.categoryTags.length} category tags, and {data.disciplineTags.length} discipline tags are available for upcoming threshold-rule editing flows.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}