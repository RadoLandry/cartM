import type { CartToolAction } from "../../../app/lib/ai/schemas";
import type { ChatSessionState } from "../hooks/useChatSessionState";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";

interface ChatPanelProps {
  state: ChatSessionState;
  launcherLabel: string;
  panelTitle: string;
  assistantGreeting: string;
  showReasonTags?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onDismissComparisonContext: (comparisonContextId: string) => void;
  onApproveAction: (action: CartToolAction) => void;
  onApproveActionSelection: (action: CartToolAction, selection: { productId: string; variantId?: string }) => void;
  onDeclineAction: (action: CartToolAction) => void;
}

export function ChatPanel({
  state,
  launcherLabel,
  panelTitle,
  assistantGreeting,
  showReasonTags = true,
  onOpen,
  onClose,
  onCollapse,
  onExpand,
  onDraftChange,
  onSubmit,
  onRetry,
  onDismissComparisonContext,
  onApproveAction,
  onApproveActionSelection,
  onDeclineAction,
}: ChatPanelProps) {
  if (!state.isOpen) {
    return (
      <button className="cm-launcher" type="button" onClick={onOpen}>
        {launcherLabel}
      </button>
    );
  }

  return (
    <section className={`cm-panel${state.isCollapsed ? " cm-panel--collapsed" : ""}`}>
      <header className="cm-panel__header">
        <div>
          <strong>{panelTitle}</strong>
          <p>{state.surface === "cart_drawer" ? "Cart drawer assistant" : "Cart page assistant"}</p>
        </div>
        <div className="cm-panel__header-actions">
          <button type="button" onClick={state.isCollapsed ? onExpand : onCollapse}>
            {state.isCollapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </header>

      {state.isCollapsed ? null : (
        <>
          {state.lastError ? (
            <div className="cm-banner cm-banner--error" role="alert">
              <span>{state.lastError}</span>
              {state.retryableMessage ? (
                <button type="button" onClick={onRetry}>Retry</button>
              ) : null}
            </div>
          ) : null}

          <ChatMessageList
            messages={state.messages}
            assistantGreeting={assistantGreeting}
            showReasonTags={showReasonTags}
            pendingActionId={state.pendingActionId}
            actionHistory={state.actionHistory}
            onApproveAction={onApproveAction}
            onApproveActionSelection={onApproveActionSelection}
            onDeclineAction={onDeclineAction}
          />
          {state.actionHistory.length > 0 ? (
            <section className="cm-guidance cm-guidance--fallback" aria-label="Action history">
              <header>
                <strong>Action history</strong>
              </header>
              <ul>
                {state.actionHistory.map((item) => (
                  <li key={item.actionId}>
                    <strong>{item.toolName}</strong>: {item.status}
                    {item.summary ? ` - ${item.summary}` : ""}
                    {item.status === "failed" ? " - Recovery: refresh cart and ask for a new proposal." : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {state.latestComparisonContextId ? (
            <section className="cm-guidance cm-guidance--fallback" aria-label="Latest comparison">
              <header>
                <strong>Latest comparison</strong>
              </header>
              {state.comparisonContexts
                .filter((context) => context.comparisonContextId === state.latestComparisonContextId)
                .map((context) => (
                  <div key={context.comparisonContextId}>
                    <p>
                      {context.status}: {context.summary || "Comparison context saved for follow-up actions."}
                    </p>
                    <button
                      type="button"
                      onClick={() => onDismissComparisonContext(context.comparisonContextId)}
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
            </section>
          ) : null}
          <ChatComposer
            draft={state.draft}
            disabled={state.status === "bootstrapping" || state.status === "streaming"}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
          />
        </>
      )}
    </section>
  );
}