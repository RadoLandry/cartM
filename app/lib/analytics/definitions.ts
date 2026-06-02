export const ANALYTICS_KPI_KEYS = {
  aovLift: "aov_lift",
  sizeReturnRateChange: "size_return_rate_change",
  cartAbandonmentChange: "cart_abandonment_change",
  kitCompletionRate: "kit_completion_rate",
  chatEngagementRate: "chat_engagement_rate",
} as const;

export type AnalyticsKpiKey =
  (typeof ANALYTICS_KPI_KEYS)[keyof typeof ANALYTICS_KPI_KEYS];

export interface AnalyticsKpiDefinition {
  key: AnalyticsKpiKey;
  displayName: string;
  description: string;
  formula: string;
  numeratorDefinition: string;
  denominatorDefinition?: string;
  isRate: boolean;
  caveats?: string[];
}

export const ANALYTICS_KPI_DEFINITIONS: Record<AnalyticsKpiKey, AnalyticsKpiDefinition> = {
  [ANALYTICS_KPI_KEYS.aovLift]: {
    key: ANALYTICS_KPI_KEYS.aovLift,
    displayName: "AOV Lift",
    description: "Delta in average order value between current and baseline periods.",
    formula: "(current_aov - baseline_aov)",
    numeratorDefinition: "Current period AOV minus baseline period AOV",
    isRate: false,
  },
  [ANALYTICS_KPI_KEYS.sizeReturnRateChange]: {
    key: ANALYTICS_KPI_KEYS.sizeReturnRateChange,
    displayName: "Size Return Rate Change",
    description: "Change in size-related return rate between current and baseline periods.",
    formula: "(current_size_returns / current_orders) - (baseline_size_returns / baseline_orders)",
    numeratorDefinition: "Size-related returns",
    denominatorDefinition: "Completed orders",
    isRate: true,
  },
  [ANALYTICS_KPI_KEYS.cartAbandonmentChange]: {
    key: ANALYTICS_KPI_KEYS.cartAbandonmentChange,
    displayName: "Cart Abandonment Change",
    description: "Change in abandonment rate between current and baseline periods.",
    formula: "(current_abandoned_carts / current_started_carts) - (baseline_abandoned_carts / baseline_started_carts)",
    numeratorDefinition: "Abandoned carts",
    denominatorDefinition: "Started carts",
    isRate: true,
  },
  [ANALYTICS_KPI_KEYS.kitCompletionRate]: {
    key: ANALYTICS_KPI_KEYS.kitCompletionRate,
    displayName: "Kit Completion Rate",
    description: "Share of carts reaching kit completion criteria.",
    formula: "completed_kits / eligible_carts",
    numeratorDefinition: "Carts satisfying kit completion criteria",
    denominatorDefinition: "Eligible carts",
    isRate: true,
  },
  [ANALYTICS_KPI_KEYS.chatEngagementRate]: {
    key: ANALYTICS_KPI_KEYS.chatEngagementRate,
    displayName: "Chat Engagement Rate",
    description: "Share of sessions that start at least one chat interaction.",
    formula: "chat_engaged_sessions / total_sessions",
    numeratorDefinition: "Sessions with chat start",
    denominatorDefinition: "Total sessions",
    isRate: true,
  },
};

export const ANALYTICS_KPI_DEFINITION_LIST = Object.values(ANALYTICS_KPI_DEFINITIONS);
