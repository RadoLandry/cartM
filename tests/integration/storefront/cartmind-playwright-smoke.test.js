import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const runtime = readFileSync('public/storefront/cartmind-chat-block-runtime.js', 'utf8');
const historyKey = 'cartmind-chat:history:v1:preview.myshopify.com:cart_page';

async function mountConversationPreview(page, options = {}) {
  const config = {
    shop: 'preview.myshopify.com', surface: 'cart_page', placementId: 'preview',
    labels: { launcherLabel: 'Chat', panelTitle: 'CartMind', assistantGreeting: 'Bonjour !' },
    features: { showChatEntry: false, showRecommendations: false, showKitCompleteness: false, showSizeWarnings: false },
    cart: { cartId: 'preview', currencyCode: 'EUR', items: [{ lineId: 'line-1', productId: '1', variantId: '2', productTitle: 'Short de sport', quantity: 1 }] },
  };
  if (options.cart) config.cart = options.cart;
  await page.route('http://cartmind.test/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/cart.js') {
      return route.fulfill({ json: { token: 'preview', currency: 'EUR', items: [{ key: 'line-1', product_id: 1, variant_id: 2, product_title: 'Short de sport', quantity: 1 }] } });
    }
    if (pathname === '/runtime.js') return route.fulfill({ contentType: 'text/javascript', body: runtime });
    if (pathname !== '/') return route.fulfill({ status: 503, json: { error: { message: 'Service indisponible' } } });
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
      <div data-cartmind-chat-root data-config-id="cartmind-chat-config-preview"></div>
      <script type="application/json" id="cartmind-chat-config-preview">${JSON.stringify(config)}</script><script src="/runtime.js"></script></body></html>` });
  });
  if (options.storage !== undefined) {
    await page.addInitScript(({ key, value }) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('seeded', 'true');
      }
    }, { key: historyKey, value: options.storage });
  }
  if (options.blockStorage) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
  }
  await page.goto('http://cartmind.test/');
  await expect(page.locator('.cm-panel')).toBeVisible();
}

test.describe('conversation history', () => {
  test('minimizes, preserves drafts, and stays minimized after reload without a configured launcher', async ({ page }) => {
    await mountConversationPreview(page);
    await page.locator('textarea').fill('Quelle taille choisir ?');
    await page.getByRole('button', { name: 'Réduire le chat' }).click();
    await expect(page.locator('.cm-panel')).toBeHidden();
    await expect(page.getByRole('button', { name: 'AI Chat' })).toBeFocused();
    await page.reload();
    await expect(page.locator('.cm-panel')).toBeHidden();
    await page.getByRole('button', { name: 'AI Chat' }).click();
    await expect(page.locator('textarea')).toHaveValue('Quelle taille choisir ?');
  });

  test('creates, resumes and deletes conversations while keeping cart context', async ({ page }) => {
    await mountConversationPreview(page);
    await page.locator('textarea').fill('Ma première question');
    await page.getByRole('button', { name: 'Nouvelle conversation', exact: true }).click();
    await expect(page.locator('textarea')).toHaveValue('');
    await page.locator('textarea').fill('Une autre question');
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await expect(page.locator('.cm-history__row')).toHaveCount(2);
    await page.locator('.cm-history__open').filter({ hasText: 'Ma première question' }).click();
    await expect(page.locator('textarea')).toHaveValue('Ma première question');
    await expect(page.locator('.cm-cart-summary')).toContainText('Short de sport');
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await page.getByRole('button', { name: 'Supprimer la conversation : Ma première question', exact: true }).click();
    await expect(page.locator('.cm-history__row')).toHaveCount(1);
    await page.reload();
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await expect(page.locator('.cm-history__row')).toHaveCount(1);
    await expect(page.locator('.cm-history')).not.toContainText('Ma première question');
  });

  test('restores text but never saved cart actions or unsafe markup', async ({ page }) => {
    const stored = { activeId: 'old', conversations: [{ id: 'old', updatedAt: Date.now(), draft: '', messages: [
      { role: 'user', content: '<img src=x onerror=alert(1)>' },
      { role: 'assistant', content: 'Ancienne réponse', actionProposals: [{ actionId: 'danger', confirmationToken: 'secret' }], guidanceBlocks: [{ type: 'recommendation' }] },
    ] }] };
    await mountConversationPreview(page, { storage: JSON.stringify(stored) });
    await expect(page.locator('.cm-message')).toHaveCount(2);
    await expect(page.locator('.cm-messages')).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('.cm-messages img, [data-action-id]')).toHaveCount(0);
    const saved = await page.evaluate((key) => localStorage.getItem(key), historyKey);
    expect(saved).not.toMatch(/secret|actionProposals|guidanceBlocks/);
    await page.reload();
    await expect(page.locator('.cm-messages')).toContainText('Ancienne réponse');
  });

  test('handles corrupt or unavailable storage', async ({ page }) => {
    await mountConversationPreview(page, { storage: '{invalid' });
    await expect(page.locator('.cm-messages')).toContainText('Bonjour');
    await page.evaluate(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
    await page.locator('textarea').fill('Brouillon sans stockage');
    await page.getByRole('button', { name: 'Réduire le chat' }).click();
    await page.getByRole('button', { name: 'AI Chat' }).click();
    await expect(page.locator('textarea')).toHaveValue('Brouillon sans stockage');
    await expect(page.getByRole('status')).toContainText('Sauvegarde indisponible');
  });

  test('expires old conversations and limits history to twenty entries', async ({ page }) => {
    const conversations = Array.from({ length: 25 }, (_, index) => ({
      id: `entry-${index}`, updatedAt: Date.now() - index * 1000, draft: '', messages: [{ role: 'user', content: `Question ${index}` }],
    }));
    conversations.unshift({ id: 'expired', updatedAt: Date.now() - 31 * 86400000, draft: '', messages: [] });
    await mountConversationPreview(page, { storage: JSON.stringify({ conversations }) });
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await expect(page.locator('.cm-history__row')).toHaveCount(20);
    expect(await page.evaluate((key) => localStorage.getItem(key), historyKey)).not.toContain('expired');
  });

  test('fits mobile and desktop viewports', async ({ page }, testInfo) => {
    await mountConversationPreview(page);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 740 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      const bounds = await page.locator('.cm-panel').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      const title = await page.locator('.cm-panel__title').boundingBox();
      const tools = await page.locator('.cm-panel__tools').boundingBox();
      expect(title.x + title.width).toBeLessThanOrEqual(tools.x);
      await page.screenshot({ path: testInfo.outputPath(`conversation-${viewport.width}.png`), animations: 'disabled' });
    }
  });

  test('keeps replies while minimized and resumes with a fresh authenticated session', async ({ page }) => {
    await mountConversationPreview(page);
    const sessionIds = [];
    const requests = [];
    await page.route('**/apps/cartmind-chat/chat-bootstrap', (route) => {
      sessionIds.push(route.request().postDataJSON().sessionId);
      return route.fulfill({ json: { ok: true, bootstrap: {
        sessionKey: `session-${sessionIds.length}`, streamToken: 'private-token',
        expiresAt: new Date(Date.now() + 60000).toISOString(), chatUrl: '/chat-stream',
      } } });
    });
    let releaseReply;
    const replyGate = new Promise((resolve) => { releaseReply = resolve; });
    await page.route('**/chat-stream', async (route) => {
      requests.push(route.request().postDataJSON());
      await replyGate;
      await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ type: 'text-delta', text: 'Prenez la taille M.' })}\n\n` });
    });
    await page.locator('textarea').fill('Quelle taille ?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nouvelle conversation', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await expect(page.locator('.cm-history__open')).toBeDisabled();
    await page.getByRole('button', { name: 'Retour au chat', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-panel')).toBeHidden();
    releaseReply();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), historyKey)).toContain('Prenez la taille M.');
    await expect(page.locator('.cm-panel')).toBeHidden();
    await page.getByRole('button', { name: 'AI Chat' }).click();
    await expect(page.locator('.cm-messages')).toContainText('Prenez la taille M.');
    await page.getByRole('button', { name: 'Nouvelle conversation', exact: true }).click();
    await page.getByRole('button', { name: 'Historique des conversations', exact: true }).click();
    await page.locator('.cm-history__open').filter({ hasText: 'Quelle taille ?' }).click();
    await page.locator('textarea').fill('Et pour le short ?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    expect(sessionIds).toHaveLength(2);
    expect(sessionIds[0]).not.toBe(sessionIds[1]);
    expect(requests[1].messages).toEqual(expect.arrayContaining([
      { role: 'user', content: 'Quelle taille ?' }, { role: 'assistant', content: 'Prenez la taille M.' },
      { role: 'user', content: 'Et pour le short ?' },
    ]));
    expect(await page.evaluate((key) => localStorage.getItem(key), historyKey)).not.toContain('private-token');
  });
});

test.describe('cart confirmation regression', () => {
  for (const outcome of ['success', 'wrong-quantity', 'replay', 'ambiguous', 'expired']) {
    test(`resumes the swap without fictitious success or duplicate execution: ${outcome}`, async ({ page }) => {
      let variant = 441;
      let quantity = 11;
      let mutations = 0;
      const requests = [];
      const cart = { cartId: 'preview', currencyCode: 'EUR', items: [{
        lineId: 'pants-xs', productId: '44', variantId: '441',
        productTitle: 'Pantalon Bordeaux', variantTitle: 'XS / Bordeaux', quantity: 11,
      }] };
      await mountConversationPreview(page, { cart });
      await page.route('**/cart.js', (route) => route.fulfill({ json: {
        token: 'preview', currency: 'EUR', items: [{ key: variant === 441 ? 'pants-xs' : 'pants-s',
          product_id: 44, variant_id: variant, product_title: 'Pantalon Bordeaux',
          variant_title: variant === 441 ? 'XS / Bordeaux' : 'S / Bordeaux', quantity,
        }],
      } }));
      await page.route('**/apps/cartmind-chat/chat-bootstrap', (route) => route.fulfill({ json: {
        ok: true, bootstrap: { sessionKey: 'swap-session', streamToken: 'test-token',
          expiresAt: new Date(Date.now() + 60000).toISOString(), chatUrl: '/chat-stream' },
      } }));
      await page.route('**/chat-stream', (route) => {
        const request = route.request().postDataJSON();
        requests.push(request);
        const latest = request.messages.at(-1).content;
        const events = [{ type: 'text-delta', text: latest.includes('taille O')
          ? 'Quelle taille souhaitez-vous ?' : latest === 'oui'
            ? 'Aucune modification supplementaire.' : 'Confirmez la carte ci-dessous.' }];
        if (latest.includes('taille S') || latest === 'S') {
          events.push({ type: 'tool-action-proposed', action: {
            actionId: latest === 'S' ? 'second-swap' : 'first-swap', toolName: 'swapVariant',
            shop: 'preview.myshopify.com', sessionKey: 'swap-session', confirmationToken: 'test-confirmation',
            expiresAt: new Date(Date.now() + (latest === 'S' && outcome === 'expired' ? -60000 : 60000)).toISOString(),
            payload: { actionType: 'swap_variant', lineId: 'pants-xs', newMerchandiseId: '442', quantity: 11 },
            preview: { before: 'Pantalon Bordeaux / XS', after: 'Pantalon Bordeaux / S' },
          } });
          if (latest === 'S' && outcome === 'ambiguous') {
            events.push({ type: 'tool-action-proposed', action: { ...events[1].action, actionId: 'other-swap' } });
          }
        }
        return route.fulfill({ contentType: 'text/event-stream', body: events
          .map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') });
      });
      const confirmations = [];
      await page.route('**/apps/cartmind-chat/chat-actions-confirm', (route) => {
        const request = route.request().postDataJSON();
        confirmations.push(request);
        return route.fulfill({ json: { ok: true, result: { actionId: request.actionId,
          status: request.decision === 'decline' ? 'declined' : 'executed',
          ...(outcome === 'replay' && request.decision === 'approve' ? { idempotentReplay: true } : {}),
        } } });
      });
      await page.route('**/cart/change.js', (route) => {
        mutations += 1;
        return route.fulfill({ json: {} });
      });
      await page.route('**/cart/add.js', (route) => {
        mutations += 1;
        variant = 442;
        quantity = outcome === 'wrong-quantity' ? 1 : route.request().postDataJSON().quantity;
        return route.fulfill({ json: {} });
      });
      const send = async (text) => {
        await page.locator('textarea').fill(text);
        await page.getByRole('button', { name: 'Send', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
      };
      await send('Remplace le pantalon en taille S en gardant la quantite.');
      await send('non');
      await expect(page.locator('.cm-messages')).toContainText('declined');
      await send('Remplace le pantalon en taille O en gardant la quantite.');
      expect(requests.at(-1).messages.some((message) => message.content.includes('swapVariant: declined'))).toBeTruthy();
      await send('S');
      await send('oui');
      if (outcome === 'ambiguous' || outcome === 'expired') {
        expect(confirmations.map((request) => request.decision)).toEqual(['decline']);
        expect(mutations).toBe(0);
        expect(quantity).toBe(11);
        return;
      }
      await expect(page.locator('.cm-messages')).toContainText(outcome === 'success' ? 'Modification verifiee' : 'failed');
      expect(confirmations.map((request) => request.decision)).toEqual(['decline', 'approve']);
      expect(confirmations[1].actionId).toBe('second-swap');
      expect(mutations).toBe(outcome === 'replay' ? 0 : 2);
      if (outcome === 'success') {
        expect(quantity).toBe(11);
        await expect(page.locator('.cm-messages')).toContainText('Modification verifiee');
      } else {
        await expect(page.locator('.cm-messages')).toContainText('failed');
        await expect(page.locator('.cm-messages')).not.toContainText('Modification verifiee');
      }
      await send('oui');
      expect(confirmations).toHaveLength(2);
      expect(mutations).toBe(outcome === 'replay' ? 0 : 2);
    });
  }
});

test('custom drawer mounts CartMind on storefront', async ({ page }) => {
  await page.goto('https://landry-randrianandrasana.myshopify.com/products/fightshort_noir_pride_or_die_busted_knuckles_venum', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/Enter store using password|Mot de passe|password/i);

  await page.waitForTimeout(3000);

  const cartTriggers = [
    '.js-menu__open',
    'a[href="/cart"]',
    'button[name="add"]',
    '.header__icon--cart',
    'summary.header__icon',
  ];

  let clicked = false;
  for (const selector of cartTriggers) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        await locator.click({ timeout: 5000 });
        clicked = true;
        break;
      } catch {
        // Try the next trigger.
      }
    }
  }

  expect(clicked).toBeTruthy();

  await page.waitForTimeout(5000);

  const diagnostics = await page.evaluate(() => {
    const discovered = document.querySelector('[data-cartmind-discovered-root="true"]');
    const sourceRoot = document.querySelector('[data-cartmind-chat-root]');
    const inDrawer = document.querySelector('.js-menu__context #main-nav [data-cartmind-discovered-root="true"]');
    const drawerOpen = Boolean(document.querySelector('.js-menu__context.js-menu__expanded, .js-menu--right.js-menu__expanded'));

    return {
      sourceRootCount: document.querySelectorAll('[data-cartmind-chat-root]').length,
      discoveredCount: document.querySelectorAll('[data-cartmind-discovered-root="true"]').length,
      hasDiscovered: Boolean(discovered),
      discoveredInDrawer: Boolean(inDrawer),
      drawerOpen,
      sourceRootTag: sourceRoot?.tagName ?? null,
      discoveredParentId: discovered?.parentElement?.id ?? null,
      discoveredParentClass: discovered?.parentElement?.className ?? null,
      shadowMounted: Boolean(discovered?.shadowRoot),
      shadowText: discovered?.shadowRoot?.textContent?.slice(0, 300) ?? null,
    };
  });

  console.log('PLAYWRIGHT_DIAGNOSTICS', JSON.stringify(diagnostics, null, 2));

  expect(diagnostics.drawerOpen).toBeTruthy();
  expect(diagnostics.sourceRootCount).toBeGreaterThan(0);
  expect(diagnostics.discoveredCount).toBeGreaterThan(0);
  expect(diagnostics.discoveredInDrawer).toBeTruthy();
  expect(diagnostics.shadowMounted).toBeTruthy();
});
