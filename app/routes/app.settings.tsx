import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { BlockStack, Button, Page, Select, Text, TextField } from "@shopify/polaris";

import {
  AI_BEHAVIOR_DEFAULTS,
  normalizeConversationStarters,
  resolveAndValidateAIBehaviorDraft,
} from "../lib/ai/behavior-config";
import {
  AIBehaviorVersionConflictError,
  getAIBehaviorDraft,
  getAIBehaviorVersionHistory,
  getActiveAIBehaviorConfigWithFallback,
  saveAIBehaviorDraft,
  writeAIBehaviorDraftSavedAudit,
} from "../lib/db/queries";
import { SafetyPolicySection } from "../components/admin/ai-behavior/SafetyPolicySection";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [draft, active, history] = await Promise.all([
    getAIBehaviorDraft(session.shop),
    getActiveAIBehaviorConfigWithFallback(session.shop),
    getAIBehaviorVersionHistory(session.shop),
  ]);

  return {
    shop: session.shop,
    versionToken: draft?.versionToken ?? "initial",
    draft: draft?.config ?? active.config,
    active: active.config,
    history: history.map((entry) => ({
      id: entry.id,
      versionNumber: entry.versionNumber,
      status: entry.status,
      publishedAt: entry.publishedAt.toISOString(),
      publishedBy: entry.publishedBy,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const versionToken = String(formData.get("versionToken") ?? "").trim();
  const tone = String(formData.get("tone") ?? AI_BEHAVIOR_DEFAULTS.tone);
  const safetyPriority = String(formData.get("safetyPriority") ?? AI_BEHAVIOR_DEFAULTS.safetyPriority);
  const aggressiveness = Number(formData.get("aggressiveness") ?? AI_BEHAVIOR_DEFAULTS.aggressiveness);
  const customGuidance = String(formData.get("customGuidance") ?? "");
  const startersRaw = String(formData.get("conversationStarters") ?? "");

  const draftInput = {
    tone: tone as "PROFESSIONAL" | "FRIENDLY" | "CONCISE" | "COACHING",
    aggressiveness,
    safetyPriority: safetyPriority as "SAFETY_FIRST" | "BALANCED",
    customGuidance,
    conversationStarters: normalizeConversationStarters(
      startersRaw
        .split("\n")
        .map((line) => line.trim()),
    ),
  };

  const resolved = resolveAndValidateAIBehaviorDraft(draftInput);

  if (!resolved.ok) {
    return {
      ok: false,
      error: "Invalid behavior configuration.",
      issues: resolved.issues,
    };
  }

  try {
    const existingDraft = await getAIBehaviorDraft(session.shop);
    const saved = await saveAIBehaviorDraft({
      shop: session.shop,
      actorId: session.shop,
      config: resolved.adjusted,
      expectedVersionToken: versionToken,
    });

    await writeAIBehaviorDraftSavedAudit({
      shop: session.shop,
      actorId: session.shop,
      draftId: saved.id,
      ...(existingDraft ? { beforeSnapshot: existingDraft.config } : {}),
      afterSnapshot: saved.config,
    });

    return {
      ok: true,
      versionToken: saved.versionToken,
      conflicts: resolved.conflicts,
    };
  } catch (error) {
    if (error instanceof AIBehaviorVersionConflictError) {
      return {
        ok: false,
        error: "This draft changed in another tab. Refresh and try again.",
      };
    }

    throw error;
  }
};

export default function AppSettingsRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [tone, setTone] = useState(data.draft.tone);
  const [versionToken, setVersionToken] = useState(data.versionToken);
  const [policy, setPolicy] = useState({
    safetyPriority: data.draft.safetyPriority,
    aggressiveness: data.draft.aggressiveness,
    customGuidance: data.draft.customGuidance,
  });
  const [conversationStarters, setConversationStarters] = useState(data.draft.conversationStarters.join("\n"));

  const isSaving = navigation.state !== "idle";

  useEffect(() => {
    if (actionData?.ok && actionData.versionToken && actionData.versionToken !== versionToken) {
      setVersionToken(actionData.versionToken);
    }
  }, [actionData, versionToken]);

  return (
    <Page title="AI settings">
      <BlockStack gap="500">
        <Text as="p" tone="subdued">
          Configure storefront assistant behavior with safety-first defaults.
        </Text>

        <Form method="post">
          <BlockStack gap="400">
            <Select
              label="Tone"
              options={[
                { label: "Professional", value: "PROFESSIONAL" },
                { label: "Friendly", value: "FRIENDLY" },
                { label: "Concise", value: "CONCISE" },
                { label: "Coaching", value: "COACHING" },
              ]}
              value={tone}
              onChange={(value) => setTone(value as typeof tone)}
            />

            <SafetyPolicySection
              value={policy}
              onChange={setPolicy}
              disabled={isSaving}
            />

            <TextField
              label="Conversation starters"
              multiline={4}
              value={conversationStarters}
              autoComplete="off"
              onChange={setConversationStarters}
            />

            <input type="hidden" name="versionToken" value={versionToken} />
            <input type="hidden" name="tone" value={tone} />
            <input type="hidden" name="safetyPriority" value={policy.safetyPriority} />
            <input type="hidden" name="aggressiveness" value={policy.aggressiveness} />
            <input type="hidden" name="customGuidance" value={policy.customGuidance} />
            <input type="hidden" name="conversationStarters" value={conversationStarters} />

            <Button submit loading={isSaving} variant="primary">
              Save draft
            </Button>
          </BlockStack>
        </Form>

        {actionData?.ok ? (
          <Text as="p" tone="success">
            Draft saved.
          </Text>
        ) : null}

        {actionData && !actionData.ok ? (
          <Text as="p" tone="critical">
            {actionData.error}
          </Text>
        ) : null}

        <Text as="h2" variant="headingSm">
          Version history
        </Text>
        <BlockStack gap="200">
          {data.history.length === 0 ? (
            <Text as="p" tone="subdued">
              No published versions yet.
            </Text>
          ) : data.history.map((entry) => (
            <Text key={entry.id} as="p" tone="subdued">
              v{entry.versionNumber} · {entry.status} · {new Date(entry.publishedAt).toLocaleString()} · {entry.publishedBy}
            </Text>
          ))}
        </BlockStack>
      </BlockStack>
    </Page>
  );
}
