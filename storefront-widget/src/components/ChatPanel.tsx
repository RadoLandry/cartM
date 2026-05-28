import type { ChatSessionState } from "../hooks/useChatSessionState";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";

interface ChatPanelProps {
  state: ChatSessionState;
  launcherLabel: string;
  panelTitle: string;
  assistantGreeting: string;
  onOpen: () => void;
  onClose: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}

export function ChatPanel({
  state,
  launcherLabel,
  panelTitle,
  assistantGreeting,
  onOpen,
  onClose,
  onCollapse,
  onExpand,
  onDraftChange,
  onSubmit,
  onRetry,
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

          <ChatMessageList messages={state.messages} assistantGreeting={assistantGreeting} />
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