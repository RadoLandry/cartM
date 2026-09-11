import { describe, expect, it } from "vitest";

import {
  computeProfileRecencyState,
  resolveCustomerProfile,
} from "../../../app/lib/cart-intelligence/customer-profile";
import {
  TEST_CUSTOMER_ID,
  TEST_SESSION_ID,
  TEST_SHOP,
  makeStoredCustomerProfileFixture,
} from "../../helpers/customer-profile-fixtures";

describe("resolveCustomerProfile", () => {
  it("builds a strong recognized-shopper profile from stored history", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");
    const resolved = resolveCustomerProfile({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      storedProfile: {
        profileKey: `${TEST_SHOP}:customer:${TEST_CUSTOMER_ID}`,
        ...makeStoredCustomerProfileFixture(),
      },
    }, now);

    expect(resolved).toMatchObject({
      profileKey: `${TEST_SHOP}:customer:${TEST_CUSTOMER_ID}`,
      identityMode: "customer",
      knownSizes: {
        gloves_oz: "14oz",
        apparel_alpha: "M",
      },
      experienceLevel: "advanced",
      confidence: 0.87,
      recencyState: "fresh",
      purchaseFrequency: "repeat",
      guidanceMode: "strong_personalization",
    });
    expect(resolved.disciplinePreferences[0]).toEqual({
      discipline: "boxing",
      score: 0.91,
      source: "purchase_history",
    });
    expect(resolved.sourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attribute: "discipline",
          source: "purchase_history",
          confidence: 0.91,
        }),
        expect.objectContaining({
          attribute: "knownSizes",
          source: "size_profile",
          confidence: 0.93,
        }),
      ]),
    );
  });

  it("softens confidence and guidance when a recognized shopper profile is stale", () => {
    const resolved = resolveCustomerProfile({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      storedProfile: {
        profileKey: `${TEST_SHOP}:customer:${TEST_CUSTOMER_ID}`,
        ...makeStoredCustomerProfileFixture({
          lastActiveAt: new Date("2025-12-01T00:00:00.000Z"),
          confidenceSummary: { overall: 0.87, sizeProfile: 0.93 },
        }),
      },
    }, new Date("2026-05-26T12:00:00.000Z"));

    expect(resolved.recencyState).toBe("stale");
    expect(resolved.confidence).toBe(0.57);
    expect(resolved.guidanceMode).toBe("light_personalization");
  });

  it("builds a session-scoped profile for an anonymous shopper without leaking purchase frequency", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");
    const resolved = resolveCustomerProfile({
      shop: TEST_SHOP,
      sessionId: TEST_SESSION_ID,
      storedProfile: {
        profileKey: `${TEST_SHOP}:session:${TEST_SESSION_ID}`,
        ...makeStoredCustomerProfileFixture({
          shopifyCustomerId: undefined,
          sessionId: TEST_SESSION_ID,
          explicitProfile: {},
          purchaseSummary: {},
          disciplineProfile: {
            primaryDiscipline: "muay-thai",
            weights: {
              "muay-thai": 0.72,
            },
          },
          confidenceSummary: { overall: 0.68, sizeProfile: 0.8 },
        }),
      },
    }, now);

    expect(resolved).toMatchObject({
      profileKey: `${TEST_SHOP}:session:${TEST_SESSION_ID}`,
      identityMode: "session",
      confidence: 0.68,
      recencyState: "fresh",
      guidanceMode: "light_personalization",
      knownSizes: {
        gloves_oz: "14oz",
        apparel_alpha: "M",
      },
    });
    expect(resolved.purchaseFrequency).toBeUndefined();
    expect(resolved.disciplinePreferences).toEqual([
      {
        discipline: "muay-thai",
        score: 0.72,
        source: "purchase_history",
      },
    ]);
  });

  it("falls back to a generic anonymous profile when no identity or stored profile exists", () => {
    const resolved = resolveCustomerProfile({
      shop: TEST_SHOP,
    });

    expect(resolved).toEqual({
      profileKey: `${TEST_SHOP}:anonymous`,
      identityMode: "anonymous",
      disciplinePreferences: [],
      knownSizes: {},
      confidence: 0.35,
      recencyState: "stale",
      sourceSummary: [],
      guidanceMode: "generic",
    });
  });

  it("lets explicit input override conflicting stored purchase-history discipline and size signals", () => {
    const resolved = resolveCustomerProfile({
      shop: TEST_SHOP,
      shopifyCustomerId: TEST_CUSTOMER_ID,
      explicitInput: {
        discipline: "muay-thai",
        knownSizes: { gloves_oz: "16oz" },
      },
      storedProfile: {
        profileKey: `${TEST_SHOP}:customer:${TEST_CUSTOMER_ID}`,
        ...makeStoredCustomerProfileFixture(),
      },
    }, new Date("2026-05-26T12:00:00.000Z"));

    expect(resolved.disciplinePreferences[0]).toEqual({
      discipline: "muay-thai",
      score: 1,
      source: "explicit",
    });
    expect(resolved.knownSizes.gloves_oz).toBe("16oz");
    expect(resolved.sourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attribute: "discipline", source: "explicit" }),
        expect.objectContaining({ attribute: "knownSizes", source: "explicit" }),
      ]),
    );
  });
});

describe("computeProfileRecencyState", () => {
  it("classifies fresh, aging, and stale profile timestamps", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");

    expect(computeProfileRecencyState(new Date("2026-05-15T12:00:00.000Z"), now)).toBe("fresh");
    expect(computeProfileRecencyState(new Date("2026-03-15T12:00:00.000Z"), now)).toBe("aging");
    expect(computeProfileRecencyState(new Date("2025-12-15T12:00:00.000Z"), now)).toBe("stale");
  });
});