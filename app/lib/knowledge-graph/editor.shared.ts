// Client-safe helpers: must not import server-only modules (db queries).
import type {
  KnowledgeGraphEditorSnapshot,
  KnowledgeGraphRouteScaffold,
} from "./editor.types";

export const KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS = [
  "override-taxonomy",
  "save-visual-override",
  "reset-visual-override",
  "save-compatibility-rule",
  "delete-compatibility-rule",
  "save-size-chart-override",
  "reset-size-chart-override",
  "create-cross-size-mapping",
  "delete-cross-size-mapping",
  "preview-cross-size-conflict",
  "upsert-size-mapping-rule",
  "deactivate-size-mapping-rule",
  "preview-bulk-operation",
  "confirm-bulk-operation",
  "cancel-bulk-operation",
  "approve-relationship",
  "reject-relationship",
  "disable-relationship",
  "create-relationship",
  "mark-reviewed",
  "reflag-for-review",
  "save-kit-definition",
  "save-kit-requirement",
  "delete-kit-requirement",
  "archive-kit-definition",
] as const;

export function createKnowledgeGraphRouteScaffold(): KnowledgeGraphRouteScaffold {
  return {
    hasLoader: true,
    hasAction: true,
    intents: [...KNOWLEDGE_GRAPH_EDITOR_ROUTE_INTENTS],
  };
}

export function createKnowledgeGraphEditorSnapshot(input: {
  lowConfidenceCount: number;
  totalProductsCount: number;
  visualProfilesCount: number;
  sizeChartsCount: number;
  availableCategoryTagsCount: number;
}): KnowledgeGraphEditorSnapshot {
  return {
    lowConfidenceCount: input.lowConfidenceCount,
    totalProductsCount: input.totalProductsCount,
    visualProfilesCount: input.visualProfilesCount,
    sizeChartsCount: input.sizeChartsCount,
    availableCategoryTagsCount: input.availableCategoryTagsCount,
  };
}
