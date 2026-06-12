import {
  extension,
  Banner,
  BlockStack,
  Text,
  Link,
  Divider,
} from "@shopify/ui-extensions/checkout";

function isExpired(item) {
  if (!item || !item.expiresAt) return false;
  return new Date(item.expiresAt) <= new Date();
}

function filterAndOrderItems(items) {
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const typeOrder = { size_warning: 0, kit_nudge: 1, bundle_offer: 2 };
  return items
    .filter((item) => !isExpired(item))
    .sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      if (sevDiff !== 0) return sevDiff;
      const typDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typDiff !== 0) return typDiff;
      return (a.priority ?? 0) - (b.priority ?? 0);
    });
}

function parseFeed(rawValue) {
  if (rawValue == null) return null;
  try {
    const parsed = JSON.parse(String(rawValue));
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toneFromSeverity(severity) {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  return "info";
}

export default extension("purchase.checkout.block.render", (root, api) => {
  const metafields = api.appMetafields;

  function render() {
    while (root.children.length > 0) {
      root.removeChild(root.children[root.children.length - 1]);
    }

    const entry = metafields.current && metafields.current[0];
    const rawValue = entry && entry.metafield && entry.metafield.value;
    const feed = parseFeed(rawValue);
    if (!feed || !feed.items || feed.items.length === 0) return;

    const ordered = filterAndOrderItems(feed.items);
    if (ordered.length === 0) return;

    const stack = root.createComponent(BlockStack, {});
    stack.appendChild(root.createComponent(Divider, {}));

    for (const item of ordered) {
      const banner = root.createComponent(Banner, {
        status: toneFromSeverity(item.severity),
        title: item.title,
      });
      const innerStack = root.createComponent(BlockStack, {});
      innerStack.appendChild(root.createComponent(Text, {}, item.message));
      if (item.action && item.action.target) {
        innerStack.appendChild(
          root.createComponent(Link, { to: item.action.target }, item.action.label),
        );
      }
      banner.appendChild(innerStack);
      stack.appendChild(banner);
    }

    root.appendChild(stack);
  }

  metafields.subscribe(render);
  render();
});
