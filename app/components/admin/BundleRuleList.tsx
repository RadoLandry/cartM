import { useState } from "react";
import { Badge, BlockStack, Button, Card, Checkbox, EmptyState, InlineStack, List, Text, TextField } from "@shopify/polaris";
import { Form, useNavigate } from "react-router";

type BundleRuleListItem = {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  status: string;
  priority: number;
  discountType: string;
  discountValue: string;
  components: Array<{ id: string }>;
};

type BundleRuleListProps = {
  bundleRules: BundleRuleListItem[];
  selectedRuleId?: string | null;
  validationByRuleId?: Record<string, string[]>;
  includeArchived?: boolean;
  search?: string;
};

function statusTone(status: string): "success" | "critical" | "info" {
  if (status === "ACTIVE") {
    return "success";
  }

  if (status === "DRAFT") {
    return "critical";
  }

  return "info";
}

export function BundleRuleList({
  bundleRules,
  selectedRuleId,
  validationByRuleId = {},
  includeArchived = false,
  search = "",
}: BundleRuleListProps) {
  const [query, setQuery] = useState(search);
  const [showArchived, setShowArchived] = useState(includeArchived);
  const navigate = useNavigate();

  return (
    <BlockStack gap="400">
      <Form method="get">
        <InlineStack gap="300" align="start" blockAlign="end">
          <div style={{ minWidth: "16rem", flex: "1 1 16rem" }}>
            <TextField
              label="Search rules"
              type="search"
              name="q"
              value={query}
              onChange={setQuery}
              autoComplete="off"
              placeholder="Key or label"
              clearButton
              onClearButtonClick={() => setQuery("")}
            />
          </div>
          <Checkbox
            label="Show archived"
            name="includeArchived"
            value="true"
            checked={showArchived}
            onChange={setShowArchived}
          />
          <Button submit>Apply filters</Button>
        </InlineStack>
      </Form>

      {bundleRules.length === 0 ? (
        <EmptyState
          heading="No bundle rules yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Bundle rules created here will become the source of truth for deterministic cart offers.</p>
        </EmptyState>
      ) : (
        bundleRules.map((rule) => (
        <Card key={rule.id}>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <div>
                <Text as="h3" variant="headingSm">
                  {rule.label}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {rule.key}
                </Text>
              </div>
              <InlineStack gap="300" align="end" blockAlign="center">
                <Badge tone={statusTone(rule.status)}>{rule.status}</Badge>
                <Text as="span" variant="bodySm" tone="subdued">
                  Priority {rule.priority}
                </Text>
                <Button
                  size="micro"
                  variant={selectedRuleId === rule.id ? "primary" : "secondary"}
                  onClick={() => navigate(`/app/bundles?ruleId=${encodeURIComponent(rule.id)}`)}
                >
                  {selectedRuleId === rule.id ? "Editing" : "Edit"}
                </Button>
              </InlineStack>
            </InlineStack>

            <Text as="p" variant="bodyMd">
              {rule.description || "No description yet."}
            </Text>

            <Text as="p" variant="bodySm" tone="subdued">
              {rule.components.length} component(s) · {rule.discountType} {rule.discountValue}
            </Text>

            {rule.status === "DRAFT" && (validationByRuleId[rule.id]?.length ?? 0) > 0 ? (
              <List type="bullet">
                {validationByRuleId[rule.id].map((message) => (
                  <List.Item key={`${rule.id}-${message}`}>
                    <Text as="span" variant="bodySm" tone="critical">
                      {message}
                    </Text>
                  </List.Item>
                ))}
              </List>
            ) : null}

            <InlineStack gap="200">
              {rule.status === "ACTIVE" ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="pause-bundle-rule" />
                  <input type="hidden" name="bundleRuleId" value={rule.id} />
                  <input type="hidden" name="toStatus" value="PAUSED" />
                  <Button submit size="micro">Pause</Button>
                </Form>
              ) : null}

              {rule.status === "PAUSED" ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="resume-bundle-rule" />
                  <input type="hidden" name="bundleRuleId" value={rule.id} />
                  <input type="hidden" name="toStatus" value="ACTIVE" />
                  <Button submit size="micro">Resume</Button>
                </Form>
              ) : null}

              {rule.status !== "ARCHIVED" ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="archive-bundle-rule" />
                  <input type="hidden" name="bundleRuleId" value={rule.id} />
                  <Button submit size="micro" tone="critical">Archive</Button>
                </Form>
              ) : null}

              <Form method="post">
                <input type="hidden" name="intent" value="duplicate-bundle-rule" />
                <input type="hidden" name="bundleRuleId" value={rule.id} />
                <Button submit size="micro">Duplicate</Button>
              </Form>
            </InlineStack>
          </BlockStack>
        </Card>
        ))
      )}
    </BlockStack>
  );
}
