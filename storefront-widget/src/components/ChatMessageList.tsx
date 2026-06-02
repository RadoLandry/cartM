import type { CartToolAction, StructuredGuidanceBlock } from "../../../app/lib/ai/schemas";
import type { ChatThreadMessage } from "../hooks/useChatSessionState";
import { ComparisonTable } from "./guidance/ComparisonTable";
import { CartToolActionCard } from "./guidance/CartToolActionCard";
import { FallbackNotice } from "./guidance/FallbackNotice";
import { RecommendationList } from "./guidance/RecommendationList";
import { SizeSummary } from "./guidance/SizeSummary";

interface ChatMessageListProps {
  messages: ChatThreadMessage[];
  assistantGreeting: string;
  pendingActionId?: string;
  onApproveAction: (action: CartToolAction) => void;
  onDeclineAction: (action: CartToolAction) => void;
}

function renderGuidanceBlock(block: StructuredGuidanceBlock) {
  switch (block.type) {
    case "recommendation_list":
      return <RecommendationList key={block.blockId} block={block} />;
    case "comparison_table":
      return <ComparisonTable key={block.blockId} block={block} />;
    case "size_summary":
      return <SizeSummary key={block.blockId} block={block} />;
    case "fallback_notice":
      return <FallbackNotice key={block.blockId} block={block} />;
  }
}

export function ChatMessageList({
  messages,
  assistantGreeting,
  pendingActionId,
  onApproveAction,
  onDeclineAction,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="cm-thread cm-thread--empty">
        <p>{assistantGreeting}</p>
      </div>
    );
  }

  return (
    <div className="cm-thread" aria-live="polite">
      {messages.map((message) => (
        <article key={message.id} className={`cm-message cm-message--${message.role}`}>
          <header>
            <strong>{message.role === "assistant" ? "CartMind" : "You"}</strong>
            {message.state === "streaming" ? <span className="cm-pill">Typing</span> : null}
            {message.state === "failed" ? <span className="cm-pill cm-pill--error">Needs retry</span> : null}
          </header>
          {message.content ? <p>{message.content}</p> : <p className="cm-message__placeholder">Preparing response…</p>}
          {message.guidanceBlocks.map((block) => renderGuidanceBlock(block))}
          {message.actionProposals.map((action) => (
            <CartToolActionCard
              key={action.actionId}
              action={action}
              isSubmitting={pendingActionId === action.actionId}
              onApprove={onApproveAction}
              onDecline={onDeclineAction}
            />
          ))}
        </article>
      ))}
    </div>
  );
}