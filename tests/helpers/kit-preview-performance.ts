export interface PreviewLatencySample {
  label: string;
  durationMs: number;
}

export function assertLatencyUnderThreshold(
  sample: PreviewLatencySample,
  thresholdMs: number,
): void {
  if (sample.durationMs > thresholdMs) {
    throw new Error(
      `${sample.label} exceeded threshold: ${sample.durationMs}ms > ${thresholdMs}ms`,
    );
  }
}

export function assertReuseFasterThanFirstRender(
  firstRenderMs: number,
  reuseMs: number,
): void {
  if (reuseMs >= firstRenderMs) {
    throw new Error(
      `Expected reuse path to be faster than first render. firstRender=${firstRenderMs}ms reuse=${reuseMs}ms`,
    );
  }
}
