import { BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

import type {
  KnowledgeGraphEditorSnapshot,
  KnowledgeGraphRouteScaffold,
} from "../../lib/knowledge-graph/editor.types";
import { KnowledgeGraphReviewQueue } from "./KnowledgeGraphReviewQueue";
import { KnowledgeGraphSizeMappings, type SizeMappingRow } from "./KnowledgeGraphSizeMappings";
import { KnowledgeGraphBulkOperations } from "./KnowledgeGraphBulkOperations";
import { KnowledgeGraphAuditTrail, type ChangeHistoryRow } from "./KnowledgeGraphAuditTrail";

type ReviewQueueItem = {
  id: string;
  shopifyProductId: string;
  title: string;
  handle: string;
  disciplineTags: string[];
  categoryTags: string[];
  classificationConfidence: number | null;
  isManuallyClassified: boolean;
};

type KnowledgeGraphEditorShellProps = {
  scaffold: KnowledgeGraphRouteScaffold;
  snapshot: KnowledgeGraphEditorSnapshot;
  reviewItems?: ReviewQueueItem[];
  availableDisciplines?: string[];
  availableCategories?: string[];
  governedSizeMappings?: SizeMappingRow[];
  changeHistory?: ChangeHistoryRow[];
};

export function KnowledgeGraphEditorShell({
  scaffold,
  snapshot,
  reviewItems = [],
  availableDisciplines = [],
  availableCategories = [],
  governedSizeMappings = [],
  changeHistory = [],
}: KnowledgeGraphEditorShellProps) {
  return (
    <BlockStack gap="400">
      <Card>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Knowledge Graph Editor
          </Text>
          <Text as="p" tone="subdued" variant="bodySm">
            {snapshot.totalProductsCount} products · {snapshot.visualProfilesCount} visual profiles · {snapshot.sizeChartsCount} size charts
          </Text>
        </InlineStack>
        {snapshot.lowConfidenceCount > 0 && (
          <Text as="p" tone="caution" variant="bodySm">
            {snapshot.lowConfidenceCount} product{snapshot.lowConfidenceCount !== 1 ? "s" : ""} pending review
          </Text>
        )}
        <Text as="p" tone="subdued" variant="bodySm">
          Intents: {scaffold.intents.length} registered
        </Text>
      </Card>

      {reviewItems.length > 0 && (
        <KnowledgeGraphReviewQueue
          items={reviewItems}
          availableDisciplines={availableDisciplines}
          availableCategories={availableCategories}
        />
      )}

      <KnowledgeGraphSizeMappings mappings={governedSizeMappings} categoryTags={availableCategories} />

      <KnowledgeGraphBulkOperations categoryTags={availableCategories} disciplineTags={availableDisciplines} />

      <KnowledgeGraphAuditTrail entries={changeHistory} />
    </BlockStack>
  );
}

