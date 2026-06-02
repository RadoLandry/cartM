import { describe, expect, it } from "vitest";

import { getTemplateVersion, listLayoutProfiles, resolveLayoutProfile } from "../../../app/lib/visual/templates";

describe("kit preview templates", () => {
  it("lists registered layout profiles", () => {
    const profiles = listLayoutProfiles();

    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.some((profile) => profile.layoutId === "mixed-neutral")).toBe(true);
  });

  it("resolves discipline-specific profile when available", () => {
    const profile = resolveLayoutProfile("boxing", 3);

    expect(profile.layoutId).toBe("boxing-default");
    expect(profile.fallback).toBe(false);
    expect(profile.slots.length).toBe(3);
  });

  it("resolves fallback profile for mixed or unknown disciplines", () => {
    const mixed = resolveLayoutProfile(null, 2);
    const unknown = resolveLayoutProfile("unknown_discipline", 2);

    expect(mixed.layoutId).toBe("mixed-neutral");
    expect(mixed.fallback).toBe(true);
    expect(unknown.layoutId).toBe("mixed-neutral");
  });

  it("exposes template version identifier", () => {
    expect(getTemplateVersion()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });
});
