import { Card, InlineStack, Text } from "@shopify/polaris";

import type {
  KnowledgeGraphEditorSnapshot,
  KnowledgeGraphRouteScaffold,
} from "../../lib/knowledge-graph/editor.types";

type KnowledgeGraphEditorShellProps = {
  scaffold: KnowledgeGraphRouteScaffold;
  snapshot: KnowledgeGraphEditorSnapshot;
};

export function KnowledgeGraphEditorShell({
  scaffold,
  snapshot,
}: KnowledgeGraphEditorShellProps) {
  return (
    <Card>
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h2" variant="headingSm">
          Editor Scaffold
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          Loader: {scaffold.hasLoader ? "yes" : "no"} | Action: {scaffold.hasAction ? "yes" : "no"}
        </Text>
      </InlineStack>
      <Text as="p" tone="subdued" variant="bodySm">
        {snapshot.lowConfidenceCount} pending review | {snapshot.totalProductsCount} products | {snapshot.visualProfilesCount} visual profiles | {snapshot.sizeChartsCount} size charts
      </Text>
    </Card>
  );
}
