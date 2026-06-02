import type { AnalyticsPeriod } from "./aggregation";

export interface ChatOutcomeRecord {
  sessions: number;
  conversions: number;
  assistedRevenue: number;
}

export interface ChatOutcomeSummary {
  sessions: number;
  conversions: number;
  conversionRate: number;
  assistedRevenue: number;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function aggregateChatOutcomes(records: ChatOutcomeRecord[]): ChatOutcomeSummary {
  const totals = records.reduce(
    (acc, record) => {
      acc.sessions += record.sessions;
      acc.conversions += record.conversions;
      acc.assistedRevenue += record.assistedRevenue;
      return acc;
    },
    {
      sessions: 0,
      conversions: 0,
      assistedRevenue: 0,
    },
  );

  return {
    sessions: totals.sessions,
    conversions: totals.conversions,
    conversionRate: safeRate(totals.conversions, totals.sessions),
    assistedRevenue: totals.assistedRevenue,
  };
}

export async function getChatOutcomeSummaryForPeriod(_input: {
  shop: string;
  currentPeriod: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod;
}): Promise<ChatOutcomeSummary> {
  return {
    sessions: 0,
    conversions: 0,
    conversionRate: 0,
    assistedRevenue: 0,
  };
}
