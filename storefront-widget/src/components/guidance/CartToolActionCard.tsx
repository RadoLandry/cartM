import type { CartToolAction } from "../../../../app/lib/ai/schemas";

interface CartToolActionCardProps {
  action: CartToolAction;
  isSubmitting: boolean;
  onApprove: (action: CartToolAction) => void;
  onApproveSelection: (action: CartToolAction, selection: { productId: string; variantId?: string }) => void;
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
    case "compareProducts":
      return "Apply comparison choice";
  }
}

export function CartToolActionCard({
  action,
  isSubmitting,
  onApprove,
  onApproveSelection,
  onDecline,
}: CartToolActionCardProps) {
  const isComparisonSelection = action.payload.actionType === "comparison_select";

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
      {isComparisonSelection ? (
        <div className="cm-guidance__actions">
          <button
            type="button"
            onClick={() => onApproveSelection(action, {
              productId: action.payload.recommended.productId,
              variantId: action.payload.recommended.variantId,
            })}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Applying..." : `Choose ${action.payload.recommended.title}`}
          </button>
          {action.payload.alternatives.map((alternative) => (
            <button
              key={`${action.actionId}-${alternative.productId}`}
              type="button"
              onClick={() => onApproveSelection(action, {
                productId: alternative.productId,
                variantId: alternative.variantId,
              })}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Applying..." : `Choose ${alternative.title}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onDecline(action)}
            disabled={isSubmitting}
          >
            Skip
          </button>
        </div>
      ) : (
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
      )}
    </section>
  );
}
