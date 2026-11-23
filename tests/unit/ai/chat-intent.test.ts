import { describe, expect, it } from "vitest";

import {
  buildGeneralShopReply,
  detectMessageLocale,
  isGeneralShopIntent,
  isRuleEngineIntent,
  isShopOverviewIntent,
} from "../../../app/lib/ai/chat-intent";

describe("detectMessageLocale", () => {
  it.each([
    ["Je débute en boxe, que me conseillez-vous ?", "fr"],
    ["What do you sell?", "en"],
    ["Was verkauft ihr eigentlich? Ich brauche Handschuhe", "de"],
    ["Wat verkopen jullie? Ik ben beginner", "nl"],
    ["Cosa vendete? Sono principiante", "it"],
    ["¿Qué vendéis? Soy principiante", "es"],
    ["初心者におすすめの商品は？", "ja"],
    ["Что вы продаёте? Я новичок", "ru"],
  ])("detects %s", (text, locale) => {
    expect(detectMessageLocale(text)).toBe(locale);
  });
});

describe("isGeneralShopIntent", () => {
  it.each([
    "Bonjour, qu'est-ce que vous vendez ?",
    "Je débute en boxe, que me conseillez-vous ?",
    "Montre-moi des produits populaires pour le boxe",
    "I'm a beginner in boxing",
    "Hello",
    "Was verkauft ihr?",
    "Welke producten zijn populair?",
    "Quali prodotti sono più venduti?",
    "¿Qué productos tienen para principiantes?",
    "おすすめの商品を教えてください",
    "Какие товары самые популярные?",
  ])("treats %s as a shop-level question", (message) => {
    expect(isGeneralShopIntent(message)).toBe(true);
  });

  it.each([
    "Qu'est-ce qui s'accorde bien avec les articles déjà présents dans votre panier ?",
    "what works well with this product?",
    "Ces gants conviennent-ils à un débutant en boxe ?",
    "Ajoute des gants de boxe",
    "Does this fit a beginner?",
  ])("keeps %s tied to the cart", (message) => {
    expect(isGeneralShopIntent(message)).toBe(false);
  });
});

describe("isShopOverviewIntent", () => {
  it.each([
    "Qu'est-ce que vous vendez ?",
    "What do you sell?",
    "Hallo",
    "Что вы продаёте?",
  ])("samples the whole shop for %s", (message) => {
    expect(isShopOverviewIntent(message)).toBe(true);
  });

  it.each([
    "Quels produits pour la boxe ?",
    "Montre-moi des produits populaires",
    "Je débute en boxe, que me conseillez-vous ?",
  ])("keeps a targeted search for %s", (message) => {
    expect(isShopOverviewIntent(message)).toBe(false);
  });
});

describe("isRuleEngineIntent", () => {
  it("does not send discipline names alone to the rule engine", () => {
    expect(isRuleEngineIntent("quels gants de boxe me conseillez-vous ?")).toBe(false);
    expect(isRuleEngineIntent("je débute en boxe, que me conseillez-vous ?")).toBe(false);
  });

  it("keeps cart, size and budget requests on the rule engine", () => {
    expect(isRuleEngineIntent("add the gloves in size m")).toBe(true);
    expect(isRuleEngineIntent("compare these two")).toBe(true);
  });
});

describe("buildGeneralShopReply", () => {
  it("answers in the shopper's locale without cart-specific content", () => {
    expect(buildGeneralShopReply("de", false)).toContain("Warenkorb ist leer");
    expect(buildGeneralShopReply("ja", true)).toContain("CartMind");
  });
});
