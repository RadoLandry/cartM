export type KnowledgeGraphAuditAction =
  | "create"
  | "update"
  | "delete"
  | "activate"
  | "deactivate"
  | "bulk_apply";

export type KnowledgeGraphAuditEntry = {
  actorId: string;
  entityType: string;
  entityId: string;
  action: KnowledgeGraphAuditAction;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  reason?: string;
  createdAt: Date;
};

export function buildKnowledgeGraphAuditEntry(input: {
  actorId: string;
  entityType: string;
  entityId: string;
  action: KnowledgeGraphAuditAction;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  reason?: string;
}): KnowledgeGraphAuditEntry {
  return {
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    reason: input.reason,
    createdAt: new Date(),
  };
}
