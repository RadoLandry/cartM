export interface FreshnessStatus {
  isFresh: boolean;
  staleMinutes: number;
}

export function evaluateKpiFreshness(
  computedAt: Date,
  now: Date = new Date(),
  freshnessThresholdMinutes = 60,
): FreshnessStatus {
  const ageMs = now.getTime() - computedAt.getTime();
  const staleMinutes = Math.max(0, Math.floor(ageMs / (1000 * 60)));

  return {
    isFresh: staleMinutes <= freshnessThresholdMinutes,
    staleMinutes,
  };
}
