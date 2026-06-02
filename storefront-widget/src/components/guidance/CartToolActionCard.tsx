import type { CartToolAction } from "../../../../app/lib/ai/schemas";

interface CartToolActionCardProps {
  action: CartToolAction;
  isSubmitting: boolean;
  onApprove: (action: CartToolAction) => void;
  onDecline: (action: CartToolAction) => void;
}

function getActionLabel(action: CartToolAction) {
  switch (action.toolName) {
    case "addToCart":
      return "Add item to cart";
    case "removeFromCart":
      return "Remove item from cart";
    case "changeQuantity":
      return "Change item quantity";
    case "swapVariant":
      return "Swap item variant";
  }
}

export function CartToolActionCard({ action, isSubmitting, onApprove, onDecline }: CartToolActionCardProps) {
  return (
    <section className="cm-guidance cm-guidance--fallback" data-action-id={action.actionId}>
      <header>
        <strong>{getActionLabel(action)}</strong>
        <span className="cm-pill">Needs confirmation</span>
      </header>
      <p>
        {action.preview?.before && action.preview?.after
          ? `${action.preview.before} -> ${action.preview.after}`
          : "Review and confirm this cart action before execution."}
      </p>
      <div className="cm-guidance__actions">
        <button
          type="button"
          onClick={() => onApprove(action)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Applying..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => onDecline(action)}
          disabled={isSubmitting}
        >
          Decline
        </button>
      </div>
    </section>
  );
}
