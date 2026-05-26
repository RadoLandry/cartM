export type CustomerProfileIdentityMode = "customer" | "session" | "anonymous";
export type ProfileRecencyState = "fresh" | "aging" | "stale";
export type GuidanceMode = "generic" | "light_personalization" | "strong_personalization";
export type PersonalizationSource =
  | "explicit"
  | "purchase_history"
  | "behavior"
  | "size_profile"
  | "fallback";

export interface ProfileInput {
  discipline?: string;
  disciplines?: string[];
  experienceLevel?: string;
  weightClass?: string;
  priceSensitivity?: string;
  knownSizes?: Record<string, string>;
}

export interface ProfileSignalEnvelope {
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  cartSignals?: Record<string, unknown>;
  browsingSignals?: Record<string, unknown>;
  explicitInput?: ProfileInput;
  storedProfile?: CustomerProfileSnapshot | null;
  purchaseSummary?: Record<string, unknown>;
}

export interface CustomerProfileSnapshot {
  profileKey: string;
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  sizeProfile: Record<string, string>;
  disciplineProfile: Record<string, unknown>;
  explicitProfile: Record<string, unknown>;
  purchaseSummary: Record<string, unknown>;
  behaviorSummary: Record<string, unknown>;
  confidenceSummary: Record<string, unknown>;
  lastActiveAt: Date | null;
}

export interface DisciplinePreference {
  discipline: string;
  score: number;
  source: PersonalizationSource;
}

export interface PersonalizationSourceSummary {
  attribute: string;
  source: PersonalizationSource;
  confidence: number;
  updatedAt?: Date;
}

export interface ResolvedCustomerProfile {
  profileKey: string;
  identityMode: CustomerProfileIdentityMode;
  disciplinePreferences: DisciplinePreference[];
  knownSizes: Record<string, string>;
  experienceLevel?: string;
  weightClass?: string;
  priceSensitivity?: string;
  purchaseFrequency?: string;
  confidence: number;
  recencyState: ProfileRecencyState;
  sourceSummary: PersonalizationSourceSummary[];
  guidanceMode: GuidanceMode;
}

export interface ProfileUpdateCommand {
  shop: string;
  shopifyCustomerId?: string;
  sessionId?: string;
  explicitInput?: ProfileInput;
  observedBehavior?: Record<string, unknown>;
  purchaseSummaryPatch?: Record<string, unknown>;
  mergeAnonymousSessionId?: string;
}

export function buildProfileKey(
  shop: string,
  shopifyCustomerId?: string | null,
  sessionId?: string | null,
): string {
  if (shopifyCustomerId) {
    return `${shop}:customer:${shopifyCustomerId}`;
  }

  if (sessionId) {
    return `${shop}:session:${sessionId}`;
  }

  return `${shop}:anonymous`;
}

export function mergeStringMaps(
  base: Record<string, string> = {},
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    ...base,
    ...overrides,
  };
}

export function mergeSummaryRecords<T extends Record<string, unknown>>(
  base: T = {} as T,
  overrides: Partial<T> = {},
): T {
  return {
    ...base,
    ...overrides,
  };
}

export function computeProfileRecencyState(
  lastActiveAt?: Date | string | null,
  now = new Date(),
): ProfileRecencyState {
  if (!lastActiveAt) {
    return "stale";
  }

  const lastSeen = typeof lastActiveAt === "string"
    ? new Date(lastActiveAt)
    : lastActiveAt;
  const ageInDays = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 30) {
    return "fresh";
  }

  if (ageInDays <= 90) {
    return "aging";
  }

  return "stale";
}

export function mergeProfileInput(
  storedExplicitProfile: Record<string, unknown> = {},
  explicitInput?: ProfileInput,
): Record<string, unknown> {
  return mergeSummaryRecords(storedExplicitProfile, explicitInput ?? {});
}

export function mergeKnownSizes(
  storedKnownSizes: Record<string, string> = {},
  explicitKnownSizes?: Record<string, string>,
): Record<string, string> {
  return mergeStringMaps(storedKnownSizes, explicitKnownSizes ?? {});
}

function roundConfidence(value: number): number {
  return Number(value.toFixed(2));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRecencyWeight(recencyState: ProfileRecencyState): number {
  switch (recencyState) {
    case "fresh":
      return 1;
    case "aging":
      return 0.85;
    default:
      return 0.65;
  }
}

function resolvePurchaseFrequency(totalOrders: number): ResolvedCustomerProfile["purchaseFrequency"] {
  if (totalOrders >= 8) {
    return "high_frequency";
  }

  if (totalOrders >= 4) {
    return "repeat";
  }

  if (totalOrders >= 2) {
    return "occasional";
  }

  return totalOrders >= 1 ? "one_off" : undefined;
}

function resolveGuidanceMode(
  confidence: number,
  purchaseFrequency?: ResolvedCustomerProfile["purchaseFrequency"],
): GuidanceMode {
  if (confidence >= 0.75 && (purchaseFrequency === "repeat" || purchaseFrequency === "high_frequency")) {
    return "strong_personalization";
  }

  if (confidence >= 0.45) {
    return "light_personalization";
  }

  return "generic";
}

function resolveDisciplinePreferences(
  envelope: ProfileSignalEnvelope,
): DisciplinePreference[] {
  const explicitDisciplines = envelope.explicitInput?.disciplines ?? [];
  const explicitPrimary = envelope.explicitInput?.discipline;
  const storedDisciplineProfile = asRecord(envelope.storedProfile?.disciplineProfile);
  const weights = asRecord(storedDisciplineProfile.weights);

  if (explicitPrimary || explicitDisciplines.length > 0) {
    const ordered = explicitPrimary ? [explicitPrimary, ...explicitDisciplines.filter((value) => value !== explicitPrimary)] : explicitDisciplines;

    return ordered.map((discipline, index) => ({
      discipline,
      score: index === 0 ? 1 : 0.8,
      source: "explicit",
    }));
  }

  const weighted = Object.entries(weights)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1])
    .map(([discipline, score]) => ({
      discipline,
      score: roundConfidence(score),
      source: "purchase_history" as const,
    }));

  if (weighted.length > 0) {
    return weighted;
  }

  const storedPrimary = asString(storedDisciplineProfile.primaryDiscipline);
  if (storedPrimary) {
    return [{ discipline: storedPrimary, score: 0.7, source: "behavior" }];
  }

  return [];
}

export function resolveCustomerProfile(
  envelope: ProfileSignalEnvelope,
  now = new Date(),
): ResolvedCustomerProfile {
  const hasStoredProfile = Boolean(envelope.storedProfile);
  const storedExplicitProfile = asRecord(envelope.storedProfile?.explicitProfile);
  const storedPurchaseSummary = asRecord(envelope.purchaseSummary ?? envelope.storedProfile?.purchaseSummary);
  const storedConfidenceSummary = asRecord(envelope.storedProfile?.confidenceSummary);
  const recencyState = computeProfileRecencyState(envelope.storedProfile?.lastActiveAt, now);
  const baseConfidence = asNumber(storedConfidenceSummary.overall) ?? 0.35;
  const confidence = roundConfidence(
    hasStoredProfile ? baseConfidence * getRecencyWeight(recencyState) : baseConfidence,
  );
  const purchaseFrequency = resolvePurchaseFrequency(asNumber(storedPurchaseSummary.totalOrders) ?? 0);
  const disciplinePreferences = resolveDisciplinePreferences(envelope);
  const knownSizes = mergeKnownSizes(
    envelope.storedProfile?.sizeProfile ?? {},
    envelope.explicitInput?.knownSizes,
  );
  const mergedExplicitProfile = mergeProfileInput(storedExplicitProfile, envelope.explicitInput);
  const experienceLevel = asString(mergedExplicitProfile.experienceLevel);
  const weightClass = asString(mergedExplicitProfile.weightClass);
  const priceSensitivity = asString(mergedExplicitProfile.priceSensitivity);
  const identityMode: CustomerProfileIdentityMode = envelope.shopifyCustomerId
    ? "customer"
    : envelope.sessionId
      ? "session"
      : "anonymous";
  const sourceSummary: PersonalizationSourceSummary[] = [];

  if (disciplinePreferences[0]) {
    sourceSummary.push({
      attribute: "discipline",
      source: disciplinePreferences[0].source,
      confidence: disciplinePreferences[0].score,
      updatedAt: envelope.storedProfile?.lastActiveAt ?? undefined,
    });
  }

  if (Object.keys(knownSizes).length > 0) {
    sourceSummary.push({
      attribute: "knownSizes",
      source: envelope.explicitInput?.knownSizes ? "explicit" : "size_profile",
      confidence: asNumber(storedConfidenceSummary.sizeProfile) ?? confidence,
      updatedAt: envelope.storedProfile?.lastActiveAt ?? undefined,
    });
  }

  if (purchaseFrequency) {
    sourceSummary.push({
      attribute: "purchaseFrequency",
      source: "purchase_history",
      confidence,
      updatedAt: envelope.storedProfile?.lastActiveAt ?? undefined,
    });
  }

  return {
    profileKey: envelope.storedProfile?.profileKey ?? buildProfileKey(
      envelope.shop,
      envelope.shopifyCustomerId,
      envelope.sessionId,
    ),
    identityMode,
    disciplinePreferences,
    knownSizes,
    ...(experienceLevel ? { experienceLevel } : {}),
    ...(weightClass ? { weightClass } : {}),
    ...(priceSensitivity ? { priceSensitivity } : {}),
    ...(purchaseFrequency ? { purchaseFrequency } : {}),
    confidence,
    recencyState,
    sourceSummary,
    guidanceMode: resolveGuidanceMode(confidence, purchaseFrequency),
  };
}