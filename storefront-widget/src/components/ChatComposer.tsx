import type { FormEvent } from "react";

interface ChatComposerProps {
  draft: string;
  disabled: boolean;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
}

export function ChatComposer({ draft, disabled, onDraftChange, onSubmit }: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="cm-composer" onSubmit={handleSubmit}>
      <label className="cm-composer__label" htmlFor="cartmind-chat-input">Ask CartMind</label>
      <textarea
        id="cartmind-chat-input"
        className="cm-composer__input"
        rows={3}
        maxLength={2000}
        placeholder="Ask about fit, comparisons, or what to add next."
        value={draft}
        disabled={disabled}
        onChange={(event) => onDraftChange(event.target.value)}
      />
      <div className="cm-composer__actions">
        <span>{draft.length}/2000</span>
        <button type="submit" disabled={disabled || draft.trim().length === 0}>Send</button>
      </div>
    </form>
  );
}