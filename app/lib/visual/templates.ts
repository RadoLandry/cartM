export interface LayoutSlot {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface LayoutProfile {
  layoutId: string;
  discipline: string | null;
  templateVersion: string;
  slots: LayoutSlot[];
  fallback: boolean;
}

interface ResolveLayoutOptions {
  nonComposable?: boolean;
}

const TEMPLATE_VERSION = "2026.06.02";

function buildSlots(keys: string[]): LayoutSlot[] {
  const baseSlots: Record<string, Omit<LayoutSlot, "key">> = {
    left: { x: 8, y: 20, width: 28, height: 60, zIndex: 2 },
    center: { x: 36, y: 10, width: 28, height: 76, zIndex: 3 },
    right: { x: 64, y: 20, width: 28, height: 60, zIndex: 2 },
    top: { x: 36, y: 0, width: 28, height: 18, zIndex: 4 },
    bottom: { x: 36, y: 84, width: 28, height: 14, zIndex: 1 },
  };

  return keys.map((key, index) => {
    const slot = baseSlots[key] ?? {
      x: 8 + ((index % 3) * 30),
      y: 8 + (Math.floor(index / 3) * 30),
      width: 26,
      height: 26,
      zIndex: 1,
    };

    return {
      key,
      ...slot,
    };
  });
}

const LAYOUT_PROFILES: LayoutProfile[] = [
  {
    layoutId: "boxing-default",
    discipline: "boxing",
    templateVersion: TEMPLATE_VERSION,
    slots: buildSlots(["left", "center", "right", "top", "bottom"]),
    fallback: false,
  },
  {
    layoutId: "muay-thai-default",
    discipline: "muay_thai",
    templateVersion: TEMPLATE_VERSION,
    slots: buildSlots(["left", "center", "right", "bottom", "top"]),
    fallback: false,
  },
  {
    layoutId: "bjj-default",
    discipline: "bjj",
    templateVersion: TEMPLATE_VERSION,
    slots: buildSlots(["center", "left", "right", "bottom", "top"]),
    fallback: false,
  },
  {
    layoutId: "mixed-neutral",
    discipline: null,
    templateVersion: TEMPLATE_VERSION,
    slots: buildSlots(["left", "center", "right", "top", "bottom"]),
    fallback: true,
  },
  {
    layoutId: "non-composable-neutral",
    discipline: null,
    templateVersion: TEMPLATE_VERSION,
    slots: buildSlots(["center"]),
    fallback: true,
  },
];

function normalizeDiscipline(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized.length > 0 ? normalized : null;
}

function fallbackProfile(): LayoutProfile {
  return LAYOUT_PROFILES.find((profile) => profile.layoutId === "mixed-neutral")
    ?? LAYOUT_PROFILES.find((profile) => profile.fallback)
    ?? LAYOUT_PROFILES[0];
}

function nonComposableFallbackProfile(): LayoutProfile {
  return LAYOUT_PROFILES.find((profile) => profile.layoutId === "non-composable-neutral")
    ?? fallbackProfile();
}

export function resolveLayoutProfile(
  discipline: string | null | undefined,
  itemCount: number,
  options: ResolveLayoutOptions = {},
): LayoutProfile {
  if (options.nonComposable || itemCount <= 0) {
    const nonComposable = nonComposableFallbackProfile();

    return {
      ...nonComposable,
      slots: nonComposable.slots.slice(0, 1),
    };
  }

  const normalizedDiscipline = normalizeDiscipline(discipline);

  const directMatch = LAYOUT_PROFILES.find(
    (profile) => profile.discipline === normalizedDiscipline,
  );

  const selected = directMatch ?? fallbackProfile();

  return {
    ...selected,
    slots: selected.slots.slice(0, Math.max(1, itemCount)),
  };
}

export function listLayoutProfiles(): LayoutProfile[] {
  return [...LAYOUT_PROFILES];
}

export function getTemplateVersion(): string {
  return TEMPLATE_VERSION;
}
