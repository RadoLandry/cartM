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
