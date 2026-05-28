# Quickstart: Chat Interface (Storefront Widget)

## Goal

Validate the storefront chat widget end to end: bootstrap, streamed reply handling, structured guidance rendering, and reopen behavior inside Shopify cart surfaces.

## Prerequisites

- Shopify app development environment is configured and the app installs on a dev store.
- Theme App Extension assets can be previewed on a development theme.
- Environment variables for Shopify auth and the selected AI provider are available.
- Local testing that needs real streaming should prefer a localhost-compatible setup because Cloudflare tunnel buffering can hide token-by-token behavior during `shopify app dev`.

## Implementation Validation Steps

1. Install dependencies so the new `storefront-widget/` bundle and the theme extension loader can build.
2. Run `npm run build:storefront-widget` and confirm the public asset is generated at `public/storefront/cartmind-chat-app.js`.
3. In the theme editor, add the `CartMind chat` app block and set `App base URL` to the current app origin used for `/api/ai/chat`.
4. Start the app with the normal Shopify development workflow.
5. Open a dev store cart drawer with the theme block enabled and confirm the chat entry point is visible.
6. Open the chat, verify the proxied bootstrap succeeds, and confirm a first shopper message creates an in-progress assistant state immediately.
7. Ask a question that should produce structured guidance and confirm the streamed block renders inline with the assistant message.
8. Collapse and reopen the chat within the same session and confirm the recent thread is preserved.
9. Repeat on the full cart page and a narrow mobile viewport.

## Focused Automated Checks

```powershell
npx vitest run tests/integration/routes/storefront-chat-bootstrap.test.ts tests/integration/routes/storefront-chat-stream.test.ts tests/unit/storefront/chat-session-state.test.ts tests/unit/storefront/chat-guidance-model.test.ts
```

```powershell
shopify app config validate --json
```

## Additional Validation

```powershell
npm run lint
```

```powershell
npm run typecheck
```

Note: repository memory records an existing unrelated TypeScript blocker in `app/lib/cart-intelligence/size-conflicts.ts`; if that remains unresolved, use focused route/widget checks to validate this slice and record the pre-existing failure separately.

## Manual Acceptance Checklist

- Chat opens from both cart drawer and cart page without redirecting the shopper.
- The cart remains usable and checkout remains reachable while chat is open.
- Stream failures produce a readable retry path.
- Empty-cart chat still works with general guidance and a clear limitation message.
- Structured guidance never renders as broken markup when a block type is unsupported.