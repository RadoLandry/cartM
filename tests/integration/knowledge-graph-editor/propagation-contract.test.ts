/**
 * Integration tests: Knowledge Graph Editor — Propagation contract (T041)
 *
 * Covers the propagation token/status contract that downstream cart
 * intelligence consumers rely on (SC-002: admin edits reflected within
 * 1 minute of save).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createPropagationToken,
  resolvePropagationStatus,
  evaluatePropagationMetric,
} from "../../../app/lib/knowledge-graph/editor.propagation";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPropagationToken", () => {
  it("is deterministic for identical inputs", () => {
    const date = new Date("2026-06-01T00:00:00Z");
    const a = createPropagationToken(["product_1", "CLASSIFICATION_OVERRIDE", date]);
    const b = createPropagationToken(["product_1", "CLASSIFICATION_OVERRIDE", date]);
    expect(a).toBe(b);
  });

  it("differs when any part changes", () => {
    const date = new Date("2026-06-01T00:00:00Z");
    const a = createPropagationToken(["product_1", "CLASSIFICATION_OVERRIDE", date]);
    const b = createPropagationToken(["product_2", "CLASSIFICATION_OVERRIDE", date]);
    expect(a).not.toBe(b);
  });
});

describe("resolvePropagationStatus — <1 minute visibility contract", () => {
  it("returns propagated once completedAt is set, regardless of elapsed time", () => {
    const startedAt = new Date(Date.now() - 5 * 60_000);
    const completedAt = new Date(Date.now() - 4 * 60_000);
    expect(resolvePropagationStatus({ startedAt, completedAt })).toBe("propagated");
  });

  it("returns pending while within the 1-minute deadline", () => {
    const startedAt = new Date(Date.now() - 10_000);
    expect(resolvePropagationStatus({ startedAt })).toBe("pending");
  });

  it("returns retry_required once the deadline has elapsed without completion", () => {
    const startedAt = new Date(Date.now() - 90_000);
    expect(resolvePropagationStatus({ startedAt })).toBe("retry_required");
  });

  it("honors a custom deadline override", () => {
    const startedAt = new Date(Date.now() - 5_000);
    expect(resolvePropagationStatus({ startedAt, deadlineMs: 1_000 })).toBe("retry_required");
  });
});

describe("evaluatePropagationMetric — retry-flag logging", () => {
  it("logs a warning when propagation is retry_required", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const startedAt = new Date(Date.now() - 90_000);

    const metric = evaluatePropagationMetric({
      entityType: "SIZE_MAPPING_RULE",
      entityId: "map_1",
      startedAt,
    });

    expect(metric.status).toBe("retry_required");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("map_1"));
  });

  it("does not log when propagation completes within the deadline", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const startedAt = new Date(Date.now() - 5_000);
    const completedAt = new Date();

    const metric = evaluatePropagationMetric({
      entityType: "SIZE_MAPPING_RULE",
      entityId: "map_2",
      startedAt,
      completedAt,
    });

    expect(metric.status).toBe("propagated");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
