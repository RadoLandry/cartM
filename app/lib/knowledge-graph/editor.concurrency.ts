export type ConcurrencyEnvelope = {
  revision: number;
  updatedAt: Date;
};

export type StaleWriteConflict = {
  code: "STALE_WRITE";
  message: string;
  serverRevision: number;
  serverUpdatedAt: string;
};

export function assertRevisionMatches(
  current: ConcurrencyEnvelope,
  requestedRevision: number,
): StaleWriteConflict | null {
  if (requestedRevision === current.revision) {
    return null;
  }

  return {
    code: "STALE_WRITE",
    message: "The record was updated by another admin. Refresh and retry.",
    serverRevision: current.revision,
    serverUpdatedAt: current.updatedAt.toISOString(),
  };
}
