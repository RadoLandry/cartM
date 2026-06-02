export type KnowledgeGraphReviewStatus = "pending" | "reviewed" | "needs_attention";

export type KnowledgeGraphSort =
  | "confidence_asc"
  | "confidence_desc"
  | "updated_desc";

export type KnowledgeGraphReviewQueueFilters = {
  search?: string;
  disciplineTags?: string[];
  categoryTags?: string[];
  reviewStatus?: KnowledgeGraphReviewStatus[];
  limit?: number;
  cursor?: string;
  sort?: KnowledgeGraphSort;
};

export type KnowledgeGraphRouteScaffold = {
  hasLoader: boolean;
  hasAction: boolean;
  intents: string[];
};

export type KnowledgeGraphEditorSnapshot = {
  lowConfidenceCount: number;
  totalProductsCount: number;
  visualProfilesCount: number;
  sizeChartsCount: number;
  availableCategoryTagsCount: number;
};
