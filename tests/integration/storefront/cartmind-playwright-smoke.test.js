import { test, expect } from '@playwright/test';

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
