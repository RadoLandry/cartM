export const AI_BEHAVIOR_DEFAULTS = {
  tone: "PROFESSIONAL",
  aggressiveness: 0.35,
  safetyPriority: "SAFETY_FIRST",
  customGuidance: "",
  conversationStarters: [
    "Can you quickly check if my cart looks complete?",
    "Help me optimize this cart while keeping safety first.",
  ],
} as const;

export const AI_BEHAVIOR_LIMITS = {
  maxCustomGuidanceLength: 2000,
  maxConversationStarters: 8,
  maxConversationStarterLength: 160,
  maxTotalStarterCharacters: 600,
  maxPromptCharacters: 2400,
  maxSafetyFirstAggressiveness: 0.6,
  minAggressiveness: 0,
  maxAggressiveness: 1,
} as const;

export interface AIBehaviorDraftPayload {
  tone: "PROFESSIONAL" | "FRIENDLY" | "CONCISE" | "COACHING";
  aggressiveness: number;
  safetyPriority: "SAFETY_FIRST" | "BALANCED";
  customGuidance: string;
  conversationStarters: string[];
}

export type AIBehaviorValidationIssueCode =
  | "INVALID_AGGRESSIVENESS"
  | "CUSTOM_GUIDANCE_TOO_LONG"
  | "TOO_MANY_STARTERS"
  | "STARTER_EMPTY"
  | "STARTER_TOO_LONG"
  | "STARTERS_TOTAL_TOO_LONG";

export interface AIBehaviorValidationIssue {
  code: AIBehaviorValidationIssueCode;
  message: string;
}

export interface AIBehaviorPolicyConflict {
  code: "SAFETY_PRIORITY_AGGRESSIVENESS_CLAMPED";
  message: string;
}

export function clampAggressiveness(value: number): number {
  if (Number.isNaN(value)) {
    return AI_BEHAVIOR_DEFAULTS.aggressiveness;
  }

  return Math.min(
    AI_BEHAVIOR_LIMITS.maxAggressiveness,
    Math.max(AI_BEHAVIOR_LIMITS.minAggressiveness, value),
  );
}

export function normalizeCustomGuidance(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, AI_BEHAVIOR_LIMITS.maxCustomGuidanceLength);
}

export function normalizeConversationStarters(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.slice(0, AI_BEHAVIOR_LIMITS.maxConversationStarterLength));

  const deduped = Array.from(new Set(normalized));
  const capped = deduped.slice(0, AI_BEHAVIOR_LIMITS.maxConversationStarters);
  let totalCharacters = 0;

  return capped.filter((starter) => {
    if (totalCharacters >= AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters) {
      return false;
    }

    totalCharacters += starter.length;
    return totalCharacters <= AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters;
  });
}

export function normalizeAIBehaviorDraftPayload(input: Partial<AIBehaviorDraftPayload>): AIBehaviorDraftPayload {
  return {
    tone: input.tone ?? AI_BEHAVIOR_DEFAULTS.tone,
    aggressiveness: clampAggressiveness(Number(input.aggressiveness ?? AI_BEHAVIOR_DEFAULTS.aggressiveness)),
    safetyPriority: input.safetyPriority ?? AI_BEHAVIOR_DEFAULTS.safetyPriority,
    customGuidance: normalizeCustomGuidance(input.customGuidance),
    conversationStarters: normalizeConversationStarters(input.conversationStarters),
  };
}

export function validateAIBehaviorDraftPayload(input: Partial<AIBehaviorDraftPayload>): {
  ok: true;
  normalized: AIBehaviorDraftPayload;
  issues: [];
} | {
  ok: false;
  normalized: AIBehaviorDraftPayload;
  issues: AIBehaviorValidationIssue[];
} {
  const normalized = normalizeAIBehaviorDraftPayload(input);
  const issues: AIBehaviorValidationIssue[] = [];

  if (!Number.isFinite(input.aggressiveness ?? normalized.aggressiveness)) {
    issues.push({
      code: "INVALID_AGGRESSIVENESS",
      message: "Aggressiveness must be a finite number between 0 and 1.",
    });
  }

  if (typeof input.customGuidance === "string" && input.customGuidance.trim().length > AI_BEHAVIOR_LIMITS.maxCustomGuidanceLength) {
    issues.push({
      code: "CUSTOM_GUIDANCE_TOO_LONG",
      message: `Custom guidance cannot exceed ${AI_BEHAVIOR_LIMITS.maxCustomGuidanceLength} characters.`,
    });
  }

  if (Array.isArray(input.conversationStarters) && input.conversationStarters.length > AI_BEHAVIOR_LIMITS.maxConversationStarters) {
    issues.push({
      code: "TOO_MANY_STARTERS",
      message: `Conversation starters cannot exceed ${AI_BEHAVIOR_LIMITS.maxConversationStarters} items.`,
    });
  }

  if (Array.isArray(input.conversationStarters)) {
    if (input.conversationStarters.some((starter) => typeof starter === "string" && starter.trim().length === 0)) {
      issues.push({
        code: "STARTER_EMPTY",
        message: "Conversation starters cannot contain empty values.",
      });
    }

    if (input.conversationStarters.some((starter) => typeof starter === "string" && starter.trim().length > AI_BEHAVIOR_LIMITS.maxConversationStarterLength)) {
      issues.push({
        code: "STARTER_TOO_LONG",
        message: `Each conversation starter must be at most ${AI_BEHAVIOR_LIMITS.maxConversationStarterLength} characters.`,
      });
    }

    const totalStarterChars = input.conversationStarters
      .filter((starter): starter is string => typeof starter === "string")
      .reduce((total, starter) => total + starter.trim().length, 0);

    if (totalStarterChars > AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters) {
      issues.push({
        code: "STARTERS_TOTAL_TOO_LONG",
        message: `Conversation starters cannot exceed ${AI_BEHAVIOR_LIMITS.maxTotalStarterCharacters} total characters.`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      normalized,
      issues,
    };
  }

  return {
    ok: true,
    normalized,
    issues: [],
  };
}

export function resolveBehaviorPolicyConflict(input: AIBehaviorDraftPayload): {
  adjusted: AIBehaviorDraftPayload;
  conflicts: AIBehaviorPolicyConflict[];
} {
  const conflicts: AIBehaviorPolicyConflict[] = [];
  const adjusted: AIBehaviorDraftPayload = {
    ...input,
    conversationStarters: [...input.conversationStarters],
  };

  if (
    adjusted.safetyPriority === "SAFETY_FIRST"
    && adjusted.aggressiveness > AI_BEHAVIOR_LIMITS.maxSafetyFirstAggressiveness
  ) {
    adjusted.aggressiveness = AI_BEHAVIOR_LIMITS.maxSafetyFirstAggressiveness;
    conflicts.push({
      code: "SAFETY_PRIORITY_AGGRESSIVENESS_CLAMPED",
      message: `Aggressiveness was clamped to ${AI_BEHAVIOR_LIMITS.maxSafetyFirstAggressiveness} because safety-first mode is active.`,
    });
  }

  return {
    adjusted,
    conflicts,
  };
}

export function resolveAndValidateAIBehaviorDraft(input: Partial<AIBehaviorDraftPayload>): {
  ok: true;
  normalized: AIBehaviorDraftPayload;
  adjusted: AIBehaviorDraftPayload;
  conflicts: AIBehaviorPolicyConflict[];
} | {
  ok: false;
  normalized: AIBehaviorDraftPayload;
  adjusted: AIBehaviorDraftPayload;
  conflicts: AIBehaviorPolicyConflict[];
  issues: AIBehaviorValidationIssue[];
} {
  const validation = validateAIBehaviorDraftPayload(input);
  const resolved = resolveBehaviorPolicyConflict(validation.normalized);

  if (!validation.ok) {
    return {
      ok: false,
      normalized: validation.normalized,
      adjusted: resolved.adjusted,
      conflicts: resolved.conflicts,
      issues: validation.issues,
    };
  }

  return {
    ok: true,
    normalized: validation.normalized,
    adjusted: resolved.adjusted,
    conflicts: resolved.conflicts,
  };
}

export function estimateBehaviorPromptCharacters(input: {
  customGuidance?: string;
  conversationStarters?: string[];
}): number {
  const customGuidanceLength = normalizeCustomGuidance(input.customGuidance).length;
  const startersLength = normalizeConversationStarters(input.conversationStarters)
    .reduce((total, starter) => total + starter.length, 0);

  return customGuidanceLength + startersLength;
}

export function isBehaviorPromptWithinBudget(input: {
  customGuidance?: string;
  conversationStarters?: string[];
}): boolean {
  return estimateBehaviorPromptCharacters(input) <= AI_BEHAVIOR_LIMITS.maxPromptCharacters;
}
