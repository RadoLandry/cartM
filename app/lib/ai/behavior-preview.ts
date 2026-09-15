import type { AIBehaviorDraftPayload } from "./behavior-config";
import { resolveBehaviorPolicyConflict } from "./behavior-config";
import type { AIBehaviorPreviewScenarioResult } from "./schemas";

export function runAIBehaviorPreviewScenarios(input: {
  draft: AIBehaviorDraftPayload;
  scenarios: Array<{ scenarioId: string; shopperMessage: string }>;
}): AIBehaviorPreviewScenarioResult[] {
  const behavior = resolveBehaviorPolicyConflict(input.draft).adjusted;
  const tone = behavior.tone.toLowerCase();
  const safetyNote = behavior.safetyPriority === "SAFETY_FIRST"
    ? "Safety and compatibility are checked before commercial suggestions."
    : "Safety remains a required check before recommendations."
  ;

  return input.scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    assistantResponse: `${tone === "concise" ? "Short answer: " : ""}I can help with that. I will review the cart for fit, compatibility, and availability before suggesting a relevant next step.${behavior.customGuidance ? ` ${behavior.customGuidance}` : ""}`,
    policyChecks: {
      safetyCompliant: true,
      notes: [
        safetyNote,
        `Previewed shopper message: ${scenario.shopperMessage}`,
        behavior.aggressiveness <= 0.3
          ? "Conservative recommendation mode is active."
          : "Relevant improvement opportunities may be presented without pressure.",
      ],
    },
  }));
}
