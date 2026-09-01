import { createHash } from "crypto";

export type PropagationStatus = "pending" | "propagated" | "retry_required";

export function createPropagationToken(parts: Array<string | number | Date>) {
  const normalized = parts
    .map((part) => (part instanceof Date ? part.toISOString() : String(part)))
    .join("|");

  return createHash("sha256").update(normalized).digest("hex").slice(0, 20);
}

export function resolvePropagationStatus(input: {
  startedAt: Date;
  completedAt?: Date | null;
  deadlineMs?: number;
}): PropagationStatus {
  const deadlineMs = input.deadlineMs ?? 60_000;

  if (input.completedAt) {
    return "propagated";
  }

  const elapsed = Date.now() - input.startedAt.getTime();
  return elapsed > deadlineMs ? "retry_required" : "pending";
}

// ---------------------------------------------------------------------------
// T040 — propagation status metrics and retry-flag logging
// ---------------------------------------------------------------------------

export type PropagationMetric = {
  entityType: string;
  entityId: string;
  status: PropagationStatus;
  elapsedMs: number;
};

/**
 * Compute a propagation metric for a single mutation and log a warning when
 * the SC-002 (<1 minute visibility) contract is at risk, so retry-required
 * entities are observable in application logs.
 */
export function evaluatePropagationMetric(input: {
  entityType: string;
  entityId: string;
  startedAt: Date;
  completedAt?: Date | null;
  deadlineMs?: number;
}): PropagationMetric {
  const status = resolvePropagationStatus(input);
  const elapsedMs = (input.completedAt ?? new Date()).getTime() - input.startedAt.getTime();
  const metric: PropagationMetric = { entityType: input.entityType, entityId: input.entityId, status, elapsedMs };

  if (status === "retry_required") {
    console.warn(
      `[KnowledgeGraphEditor] propagation retry required for ${input.entityType}:${input.entityId} after ${elapsedMs}ms`,
    );
  }

  return metric;
}
