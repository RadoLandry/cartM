import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { BlockStack, Button, Page, Text } from "@shopify/polaris";

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
  publishAIBehaviorDraft,
  rollbackAIBehaviorVersion,
  saveAIBehaviorDraft,
  writeAIBehaviorDraftSavedAudit,
} from "../lib/db/queries";
import { SafetyPolicySection } from "../components/admin/ai-behavior/SafetyPolicySection";
import { StyleControlsSection } from "../components/admin/ai-behavior/StyleControlsSection";
import { GuidanceSection } from "../components/admin/ai-behavior/GuidanceSection";
import { ReleaseControlsSection } from "../components/admin/ai-behavior/ReleaseControlsSection";
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
    activeSource: active.source,
    activeVersionNumber: active.versionNumber,
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
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "publish") {
    try {
      const activeVersion = await publishAIBehaviorDraft({
        shop: session.shop,
        actorId: session.shop,
      });

      return { ok: true, intent: "publish" as const, activeVersion };
    } catch (error) {
      return {
        ok: false,
        intent: "publish" as const,
        error: error instanceof Error ? error.message : "Unable to publish AI behavior draft.",
      };
    }
  }

  if (intent === "rollback") {
    const targetVersionId = String(formData.get("targetVersionId") ?? "");

    if (!targetVersionId) {
      return { ok: false, intent: "rollback" as const, error: "Select a version to roll back to." };
    }

    try {
      const activeVersion = await rollbackAIBehaviorVersion({
        shop: session.shop,
        actorId: session.shop,
        targetVersionId,
      });

      return { ok: true, intent: "rollback" as const, activeVersion };
    } catch (error) {
      return {
        ok: false,
        intent: "rollback" as const,
        error: error instanceof Error ? error.message : "Unable to roll back AI behavior version.",
      };
    }
  }

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
      intent: "save" as const,
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
      intent: "save" as const,
      versionToken: saved.versionToken,
      conflicts: resolved.conflicts,
    };
  } catch (error) {
    if (error instanceof AIBehaviorVersionConflictError) {
      return {
        ok: false,
        intent: "save" as const,
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
  const submit = useSubmit();

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
    if (actionData?.ok && actionData.intent === "save" && actionData.versionToken && actionData.versionToken !== versionToken) {
      setVersionToken(actionData.versionToken);
    }
  }, [actionData, versionToken]);

  return (
    <Page title="AI settings">
      <BlockStack gap="500">
        <Text as="p" tone="subdued">
          Configure storefront assistant behavior with safety-first defaults.
        </Text>

        <Text as="p" tone="subdued">
          Active configuration source: {data.activeSource}
          {data.activeVersionNumber ? ` (v${data.activeVersionNumber})` : ""}.
        </Text>

        <Form method="post">
          <BlockStack gap="400">
            <StyleControlsSection
              tone={tone}
              aggressiveness={policy.aggressiveness}
              onToneChange={(value) => setTone(value as typeof tone)}
              onAggressivenessChange={(value) => setPolicy((current) => ({ ...current, aggressiveness: value }))}
              disabled={isSaving}
            />

            <SafetyPolicySection
              value={policy}
              onChange={setPolicy}
              disabled={isSaving}
            />

            <GuidanceSection
              customGuidance={policy.customGuidance}
              conversationStarters={conversationStarters}
              onCustomGuidanceChange={(value) => setPolicy((current) => ({ ...current, customGuidance: value }))}
              onConversationStartersChange={setConversationStarters}
              disabled={isSaving}
            />

            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="versionToken" value={versionToken} />
            <input type="hidden" name="tone" value={tone} />
            <input type="hidden" name="safetyPriority" value={policy.safetyPriority} />
            <input type="hidden" name="aggressiveness" value={policy.aggressiveness} />
            <input type="hidden" name="customGuidance" value={policy.customGuidance} />
            <input type="hidden" name="conversationStarters" value={conversationStarters} />

            <Button submit loading={isSaving && navigation.formData?.get("intent") !== "publish" && navigation.formData?.get("intent") !== "rollback"} variant="primary">
              Save draft
            </Button>
          </BlockStack>
        </Form>

        {actionData?.ok && actionData.intent === "save" ? (
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
          Release
        </Text>
        <ReleaseControlsSection
          history={data.history}
          onPublish={() => submit({ intent: "publish" }, { method: "post" })}
          onRollback={(versionId) => submit({ intent: "rollback", targetVersionId: versionId }, { method: "post" })}
          disabled={isSaving}
        />

        {actionData?.ok && (actionData.intent === "publish" || actionData.intent === "rollback") ? (
          <Text as="p" tone="success">
            {actionData.intent === "publish" ? "Draft published." : "Rolled back to selected version."}
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
