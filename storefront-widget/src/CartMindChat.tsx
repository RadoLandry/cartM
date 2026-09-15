import type { StructuredGuidanceBlock } from "./types";
import type { ChatSessionState, ChatThreadMessage } from "./hooks/useChatSessionState";
import { resolveBudgetOptimizationSelectedCandidateIds } from "./hooks/useStorefrontChat";
import { BudgetOptimizationCard } from "./components/guidance/BudgetOptimizationCard";
import { getGuidanceRenderModel } from "./components/guidance/getGuidanceRenderModel";

export interface CartMindChatProps {
  state: ChatSessionState;
  selectedCandidateIdsByBlock?: Record<string, string[]>;
  onCandidateDecision?: (optimizationContextId: string, candidateId: string, accepted: boolean) => void;
}

function isBudgetOptimizationBlock(
  block: StructuredGuidanceBlock,
): block is Extract<StructuredGuidanceBlock, { type: "budget_optimization" }> {
  return block.type === "budget_optimization";
}

function resolveOptimizationContextId(blockId: string) {
  return blockId.replace(/^budget-/, "");
}

function renderGuidanceBlock(
  block: StructuredGuidanceBlock,
  props: CartMindChatProps,
) {
  if (isBudgetOptimizationBlock(block)) {
    const optimizationContextId = resolveOptimizationContextId(block.blockId);
    const selectedCandidateIds = props.selectedCandidateIdsByBlock?.[block.blockId]
      ?? resolveBudgetOptimizationSelectedCandidateIds(block, props.state, optimizationContextId);

    return (
      <BudgetOptimizationCard
        key={block.blockId}
        block={block}
        selectedCandidateIds={selectedCandidateIds}
        onCandidateDecision={(candidateId, accepted) => props.onCandidateDecision?.(optimizationContextId, candidateId, accepted)}
      />
    );
  }

  const model = getGuidanceRenderModel(block);
  return (
    <section key={block.blockId} aria-label={model.title}>
      <h3>{model.title}</h3>
      <p>{model.summary}</p>
    </section>
  );
}

function renderMessage(message: ChatThreadMessage, props: CartMindChatProps) {
  const guidanceBlocks = (message.guidanceBlocks ?? []) as StructuredGuidanceBlock[];

  return (
    <article key={message.id} data-role={message.role} data-state={message.state}>
      <p>{message.content}</p>
      {guidanceBlocks.map((block) => renderGuidanceBlock(block, props))}
    </article>
  );
}

export function CartMindChat(props: CartMindChatProps) {
  const { state } = props;

  return (
    <div aria-label="CartMind chat" data-open={state.isOpen} data-status={state.status}>
      {state.messages.map((message) => renderMessage(message, props))}
    </div>
  );
}
