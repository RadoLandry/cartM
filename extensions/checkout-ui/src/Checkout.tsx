import {
  reactExtension,
  useSettings,
  useAppMetafields,
  BlockStack,
  Banner,
  Text,
  Link,
  Divider,
} from "@shopify/ui-extensions-react/checkout";

// ---------------------------------------------------------------------------
// Checkout guidance item types (mirrored from shared schemas for function scope)
// ---------------------------------------------------------------------------

type GuidanceType = "size_warning" | "bundle_offer" | "kit_nudge";
type GuidanceSeverity = "info" | "warning" | "critical";

interface CheckoutGuidanceItem {
  guidanceId: string;
  type: GuidanceType;
  severity: GuidanceSeverity;
  priority: number;
  title: string;
  message: string;
  relatedLineIds: string[];
  action?: {
    type: "review_cart" | "change_size" | "add_item" | "acknowledge";
    label: string;
    target?: string;
  };
  expiresAt?: string;
}

interface CheckoutGuidanceFeed {
  shop: string;
  guidanceId: string;
  items: CheckoutGuidanceItem[];
  projectionVersion: number;
  placement: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_TO_STATUS = {
  critical: "critical",
  warning: "warning",
  info: "info",
} as const;

function isExpired(item: CheckoutGuidanceItem): boolean {
  if (!item.expiresAt) return false;
  return new Date(item.expiresAt) <= new Date();
}

function filterAndOrderItems(items: CheckoutGuidanceItem[]): CheckoutGuidanceItem[] {
  const SEVERITY_ORDER: Record<GuidanceSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const TYPE_ORDER: Record<GuidanceType, number> = { size_warning: 0, kit_nudge: 1, bundle_offer: 2 };

  return items
    .filter((item) => !isExpired(item))
    .sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      if (typeDiff !== 0) return typeDiff;
      return a.priority - b.priority;
    });
}

function parseFeedFromMetafield(raw: unknown): CheckoutGuidanceFeed | null {
  if (!raw || typeof raw !== "object") return null;

  const feed = raw as Record<string, unknown>;

  if (
    typeof feed.shop !== "string"
    || typeof feed.guidanceId !== "string"
    || typeof feed.projectionVersion !== "number"
    || !Array.isArray(feed.items)
  ) {
    return null;
  }

  return feed as unknown as CheckoutGuidanceFeed;
}

// ---------------------------------------------------------------------------
// Guidance item component
// ---------------------------------------------------------------------------

interface GuidanceItemProps {
  item: CheckoutGuidanceItem;
}

function GuidanceItemBlock({ item }: GuidanceItemProps) {
  const status = SEVERITY_TO_STATUS[item.severity];

  return (
    <Banner status={status} title={item.title}>
      <BlockStack>
        <Text>{item.message}</Text>
        {item.action?.target ? (
          <Link to={item.action.target}>{item.action.label}</Link>
        ) : null}
      </BlockStack>
    </Banner>
  );
}

// ---------------------------------------------------------------------------
// Main checkout extension component (T040 + T041)
// ---------------------------------------------------------------------------

function CartMindCheckoutGuidance() {
  const settings = useSettings();
  const metafields = useAppMetafields();

  // Guidance data is embedded as app metafield on the cart or checkout
  const guidanceMetafield = metafields.find(
    (mf) => mf.metafield.namespace === "cartmind" && mf.metafield.key === "checkout_guidance",
  );

  const feed = parseFeedFromMetafield(
    guidanceMetafield?.metafield.value != null
      ? (() => {
          try {
            return JSON.parse(String(guidanceMetafield.metafield.value));
          } catch {
            return null;
          }
        })()
      : null,
  );

  // T041: Empty-state no-render behavior — render nothing when there's no guidance
  if (!feed || feed.items.length === 0) {
    return null;
  }

  // T041: Placement adaptation — use available checkout block placement
  const availablePlacement = settings.cartmind_guidance_path
    ? String(settings.cartmind_guidance_path)
    : "purchase.checkout.block.render";

  const isCompatiblePlacement
    = availablePlacement === "purchase.checkout.block.render"
    || availablePlacement === "purchase.checkout.cart-line-item.render-after";

  if (!isCompatiblePlacement) {
    // No supported placement available — render nothing, do not block checkout
    return null;
  }

  const orderedItems = filterAndOrderItems(feed.items);

  if (orderedItems.length === 0) {
    return null;
  }

  return (
    <BlockStack>
      <Divider />
      {orderedItems.map((item) => (
        <GuidanceItemBlock key={item.guidanceId} item={item} />
      ))}
    </BlockStack>
  );
}

// Export the extension targeting the standard checkout block placement
export default reactExtension(
  "purchase.checkout.block.render",
  () => <CartMindCheckoutGuidance />,
);
