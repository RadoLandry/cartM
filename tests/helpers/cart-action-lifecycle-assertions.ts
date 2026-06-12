import type { CartToolActionStatusEvent } from "../../app/lib/ai/schemas";

const TERMINAL_STATUSES = new Set([
  "declined",
  "expired",
  "executed",
  "failed",
]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ["approved", "declined", "expired"],
  approved: ["executing"],
  declined: [],
  expired: [],
  executing: ["executed", "failed"],
  executed: [],
  failed: [],
};

export function assertValidActionTransition(
  fromStatus: string,
  toStatus: string,
): void {
  const allowed = VALID_TRANSITIONS[fromStatus] ?? [];

  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid action transition: ${fromStatus} -> ${toStatus}`,
    );
  }
}

export function assertTerminalStatusReplaySafe(status: string): void {
  if (!TERMINAL_STATUSES.has(status)) {
    throw new Error(`Expected terminal status, received: ${status}`);
  }
}

export function assertActionStatusHistoryMonotonic(
  statuses: string[],
): void {
  if (statuses.length < 2) {
    return;
  }

  for (let index = 1; index < statuses.length; index += 1) {
    assertValidActionTransition(statuses[index - 1], statuses[index]);
  }
}

export function assertStatusEventMatchesExpected(
  event: CartToolActionStatusEvent,
  expectedStatus: CartToolActionStatusEvent["status"],
): void {
  if (event.status !== expectedStatus) {
    throw new Error(
      `Expected status event ${expectedStatus}, received ${event.status}`,
    );
  }
}

export function assertCartSnapshotItemQuantity(
  event: CartToolActionStatusEvent,
  lineId: string,
  expectedQuantity: number,
): void {
  const line = event.cart?.items.find((item) => item.lineId === lineId);

  if (!line) {
    throw new Error(`Expected cart line ${lineId} to exist in status event snapshot.`);
  }

  if (line.quantity !== expectedQuantity) {
    throw new Error(
      `Expected line ${lineId} quantity ${expectedQuantity}, received ${line.quantity}`,
    );
  }
}
