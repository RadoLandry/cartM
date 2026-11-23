// Locale and intent detection for the storefront chat. Supported shopper markets:
// NL, FR, CH (de/fr/it), DE, IT, ES, UK/US/EN, JP, RU. ROW and unknown text fall back to English.

export type ChatLocale = "en" | "fr" | "de" | "nl" | "it" | "es" | "ja" | "ru";

export const CHAT_LOCALE_NAMES: Record<ChatLocale, string> = {
  en: "English",
  fr: "French",
  de: "German",
  nl: "Dutch",
  it: "Italian",
  es: "Spanish",
  ja: "Japanese",
  ru: "Russian",
};

export const CHAT_INTL_LOCALES: Record<ChatLocale, string> = {
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  nl: "nl-NL",
  it: "it-IT",
  es: "es-ES",
  ja: "ja-JP",
  ru: "ru-RU",
};

type LatinLocale = Exclude<ChatLocale, "ja" | "ru">;

const LATIN_STOPWORDS: Record<LatinLocale, RegExp> = {
  fr: /\b(est|ce|cette|les|des|pour|dans|avec|sont|vous|moi|mon|ma|mes|tailles|panier|verifie|coherence|la|le|et|une|du|au|que|qui|je|il|elle|ils|nous|votre|notre|adapt[eé]s?|gants|taille|boxe|sparring|entrainement|entra[iî]nement|bonjour|salut|merci|pourquoi|comment|aussi|quel|quelle|quels|quelles|convient|adapté|d[eé]bute|vendez|conseillez|populaires?|montre)\b/gi,
  de: /\b(der|die|das|und|ist|ich|mit|f[uü]r|ein|eine|nicht|was|wie|welche[rsn]?|mein|meine|zu|auf|bitte|hallo|guten|anf[aä]nger|einsteiger|verkauft|verkaufen|ihr|sie|mir|brauche|empfehlen|empfehlt|habt|gr[oö](ss|ß)e|warenkorb|handschuhe|danke)\b/gi,
  nl: /\b(het|een|en|ik|mijn|voor|met|wat|welke|jullie|hoe|niet|kan|ook|hallo|hoi|verkopen|verkoop|graag|nodig|bent|zijn|winkelwagen|handschoenen|bedankt|maat|beginner|aanraden|aanbevelen)\b/gi,
  it: /\b(il|lo|gli|un|una|di|che|per|con|sono|come|quale|quali|cosa|vendete|ciao|buongiorno|buonasera|mio|mia|principiante|consigli|consigliate|vorrei|ho|carrello|guanti|taglia|grazie|prodotti)\b/gi,
  es: /\b(el|los|las|un|una|para|con|por|soy|como|cu[aá]l|cuales|qu[eé]|vendes|venden|vend[eé]is|hola|buenas|mi|principiante|recomiendas|recomiendan|necesito|tengo|quiero|carrito|guantes|talla|gracias|productos)\b|[¿¡ñ]/gi,
  en: /\b(the|is|are|what|which|do|you|i|my|me|for|with|and|to|of|an|this|that|how|can|show|need|want|looking|sell|products|best|popular|beginner|hello|hi|hey|please|cart|size|gloves)\b/gi,
};

const FRENCH_ACCENTS = /[éèêàâùûçôîï]/gi;
const GERMAN_MARKERS = /[äöüß]/gi;

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

// Returns null when the text carries no language signal (for example a bare "2m, 90kg" reply).
export function detectLocaleSignal(text: string): ChatLocale | null {
  const value = text.toLowerCase();
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value)) return "ja";
  if (/[\u0400-\u04ff]/.test(value)) return "ru";

  const scores = (Object.keys(LATIN_STOPWORDS) as LatinLocale[]).map((locale) => {
    let score = countMatches(value, LATIN_STOPWORDS[locale]);
    if (locale === "fr") score += countMatches(value, FRENCH_ACCENTS) * 0.5;
    if (locale === "de") score += countMatches(value, GERMAN_MARKERS) * 2;
    return { locale, score };
  });

  const best = scores.reduce((top, current) => (current.score > top.score ? current : top));
  return best.score >= 1 ? best.locale : null;
}

const LEGACY_FRENCH_RE = /\b(est|ce|cette|les|des|pour|dans|avec|sont|vous|moi|mon|ma|mes|tailles|panier|verifie|coherence|la|le|et|une|du|au|que|qui|je|il|elle|ils|nous|votre|notre|adapt[eé]s?|gants|taille|boxe|sparring|entrainement|entra[iî]nement|bonjour|merci|pourquoi|comment|aussi|quel|quelle|quels|quelles|convient|adapté)\b/i;

// Other locales win only on a clear signal, so the French/English heuristic that the
// deterministic copy was tuned against keeps its previous behaviour.
export function detectMessageLocale(text: string): ChatLocale {
  const signal = detectLocaleSignal(text);
  if (signal && signal !== "fr" && signal !== "en") return signal;
  if (/[éèêàâùûçôîï]/i.test(text) || LEGACY_FRENCH_RE.test(text)) return "fr";
  return "en";
}

// Deterministic copy exists in French and English only; every other locale reads English copy,
// while LLM replies follow the shopper's own language.
export function toCopyLang(locale: ChatLocale): "fr" | "en" {
  return locale === "fr" ? "fr" : "en";
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Words pointing at the cart or a specific item; such messages are cart questions, not shop discovery.
const CART_REFERENCE_RE = new RegExp([
  "\\b(?:panier|cart|basket|warenkorb|winkelwagen|carrello|carrito|cesta)\\b",
  "\\b(?:this|these|cet|cette|ces|ceci|dieser|diese|dieses|deze|questo|questa|questi|este|esta|estos)\\s+\\w",
  "\\bce\\s+(?!que\\b|qui\\b|soir\\b)\\w",
  "カート|この|корзин|этот|эта|это |эти ",
].join("|"), "i");

function leadingBoundaryRegExp(parts: string[]) {
  return new RegExp(`\\b(?:${parts.join("|")})`, "i");
}

const SHOP_INQUIRY_RE = leadingBoundaryRegExp([
  // en
  "what\\s+(?:do|can|would)\\s+you\\s+(?:sell|offer|have)",
  "what(?:'s|\\s+is|\\s+are)\\s+(?:in\\s+)?(?:your|the)\\s+(?:shop|store|catalog(?:ue)?|range|products)",
  "(?:what|which)\\s+(?:products|items|gear|equipment)",
  "do\\s+you\\s+(?:sell|have|carry)",
  "(?:show|browse)\\s+(?:me\\s+)?(?:your\\s+)?(?:products|catalog(?:ue)?|collection|shop|store)",
  // fr
  "qu'?est-?ce\\s+que\\s+(?:vous|tu)\\s+(?:vendez|vends|proposez|proposes)",
  "que\\s+(?:vendez|proposez)",
  "(?:quels?|quelles?)\\s+(?:produits|articles|[eé]quipements)",
  "vendez-?vous",
  "(?:votre|vos)\\s+(?:boutique|catalogue|produits)",
  "montre[rz]?(?:-?\\s*moi)?\\s+(?:des\\s+|vos\\s+|les\\s+)?(?:produits|articles)",
  // de
  "was\\s+(?:verkauft|verkaufen|bietet|bieten|habt|gibt)\\s+(?:ihr|sie|du|es)",
  "welche\\s+(?:produkte|artikel|ausr[uü]stung)",
  "(?:euer|ihr)\\s+sortiment",
  "zeig(?:e|en)?\\s+(?:mir\\s+)?(?:produkte|artikel)",
  // nl
  "wat\\s+(?:verkopen|verkoop|bieden|hebben)\\s+(?:jullie|u|je)",
  "welke\\s+(?:producten|artikelen)",
  "jullie\\s+assortiment",
  "toon\\s+(?:me|mij)\\s+(?:producten|artikelen)",
  // it
  "(?:che\\s+)?cosa\\s+(?:vendete|vendi|offrite|avete)",
  "(?:quali|che)\\s+(?:prodotti|articoli)",
  "(?:il\\s+vostro|vostro)\\s+catalogo",
  "mostra(?:mi)?\\s+(?:i\\s+)?(?:prodotti|articoli)",
  // es
  "que\\s+(?:vendes|venden|vendeis|ofrecen|ofreces|tienen)",
  "(?:cuales|que)\\s+(?:productos|articulos)",
  "su\\s+catalogo",
  "muestra(?:me)?\\s+(?:los\\s+)?(?:productos|articulos)",
]);

const BEGINNER_RE = leadingBoundaryRegExp([
  "beginner|new\\s+to|just\\s+(?:start|began|begun)|starting\\s+out|first\\s+time|getting\\s+started",
  "d[eé]but(?:e|ant|ante|er|ons)?|commenc(?:e|er|ons)|nouveau\\s+(?:en|dans)|premi[eè]re\\s+fois",
  "anf[aä]nger|einsteiger|neu\\s+(?:in|im|bei)|fange?\\s+gerade|f[uü]r\\s+den\\s+einstieg",
  "starter|nieuw\\s+(?:in|bij)|net\\s+begonnen|beginnen",
  "principiante|alle\\s+prime\\s+armi|sto\\s+iniziando|inizio",
  "empezando|nuevo\\s+en|nueva\\s+en|primera\\s+vez|comienzo|empiezo",
]);

const POPULAR_RE = leadingBoundaryRegExp([
  "popular|best[-\\s]?sellers?|top[-\\s]rated|most\\s+(?:bought|sold)|trending",
  "populaires?|meilleures?\\s+ventes|plus\\s+vendus|tendance",
  "beliebt|meistverkauft|am\\s+h[aä]ufigsten|bestseller",
  "populair|meest\\s+verkocht|bestsellers?",
  "popolari|pi[uù]\\s+venduti|di\\s+tendenza",
  "populares?|m[aá]s\\s+vendidos|mejores\\s+ventas|tendencia",
]);

const ADVICE_REQUEST_RE = leadingBoundaryRegExp([
  "what\\s+(?:do|would|should)\\s+you\\s+(?:recommend|suggest)|any\\s+(?:recommendations?|advice|tips)",
  "que\\s+(?:me\\s+)?(?:conseill|recommand|propos)(?:ez|es)?-?\\s*vous",
  "was\\s+(?:empfiehlst|empfehlt|empfehlen\\s+sie|r[aä]tst)",
  "wat\\s+(?:raad|adviseer|beveel)\\s+(?:je|u|jullie)",
  "cosa\\s+(?:mi\\s+)?(?:consigli|consigliate|suggerite)",
  "que\\s+(?:me\\s+)?(?:recomiendas|recomiendan|aconsejas|aconsejan)",
]);

const JA_RU_DISCOVERY_RE = new RegExp([
  "何を(?:売|販売)|どんな(?:商品|製品)|おすすめ|オススメ|人気|売れ筋|初心者|始めたばかり|初めて|商品を(?:見せ|教え)",
  "что\\s+(?:вы\\s+)?(?:продаёте|продаете|предлагаете)|какие\\s+(?:товары|продукты)|покажите\\s+(?:товары|продукты)|посоветуйте|что\\s+(?:вы\\s+)?(?:рекомендуете|советуете)|популярн|хит[ыа]?\\s+продаж|новичок|начинающ|только\\s+начина",
].join("|"), "i");

const GREETING_ONLY_RE = new RegExp([
  "^(?:hi|hello|hey|good\\s+(?:morning|afternoon|evening)|bonjour|salut|bonsoir|coucou|hallo|guten\\s+(?:tag|morgen|abend)|hoi|goedendag|goedemorgen|ciao|buongiorno|buonasera|hola|buenos\\s+d[ií]as|buenas(?:\\s+tardes)?|こんにちは|こんばんは|ハロー|привет|здравствуйте|добрый\\s+(?:день|вечер))\\W*(?:cartmind)?\\W*$",
].join("|"), "i");

// A message about the shop, a discipline, or a newcomer's needs that is not tied to a cart item.
export function isGeneralShopIntent(message: string) {
  const raw = message.trim();
  if (!raw) return false;
  const text = stripDiacritics(raw);

  if (GREETING_ONLY_RE.test(raw.toLowerCase()) || GREETING_ONLY_RE.test(text)) return true;
  if (CART_REFERENCE_RE.test(text) || CART_REFERENCE_RE.test(raw)) return false;

  return SHOP_INQUIRY_RE.test(text)
    || BEGINNER_RE.test(text)
    || POPULAR_RE.test(text)
    || ADVICE_REQUEST_RE.test(text)
    || JA_RU_DISCOVERY_RE.test(raw.toLowerCase());
}

const DISCIPLINE_MENTION_RE = /\b(?:box(?:e|ing|en|eo)?|boksen|pugilato|muay|thai|kick\s*boxing|kickboxing|mma|bjj|jiu[-\s]?jitsu|judo|grappling|karate|wrestling|lutte)\b|ボクシング|ムエタイ|柔術|бокс|муай|единоборств/i;

const JA_RU_SHOP_INQUIRY_RE = /何を(?:売|販売)|どんな(?:商品|製品)|что\s+(?:вы\s+)?(?:продаёте|продаете|предлагаете)|какие\s+(?:товары|продукты)/;

// "What do you sell?" without naming a discipline: the answer should sample the whole shop.
export function isShopOverviewIntent(message: string) {
  const text = stripDiacritics(message.trim());
  if (!text) return false;
  if (GREETING_ONLY_RE.test(text) || GREETING_ONLY_RE.test(message.trim().toLowerCase())) return true;
  if (CART_REFERENCE_RE.test(text) || DISCIPLINE_MENTION_RE.test(text)) return false;
  if (JA_RU_SHOP_INQUIRY_RE.test(message.trim().toLowerCase())) return true;
  return SHOP_INQUIRY_RE.test(text) && !BEGINNER_RE.test(text) && !POPULAR_RE.test(text);
}

const GENERAL_SHOP_COPY: Record<ChatLocale, { cartItems: string; emptyCart: string }> = {
  en: {
    cartItems: "Hello! I'm CartMind, your combat-sports gear coach. Tell me your discipline (boxing, Muay Thai, MMA, BJJ…), your level and your size, and I'll suggest gear from the shop. You can also ask me about the items in your cart.",
    emptyCart: "Hello! I'm CartMind, your combat-sports gear coach. Your cart is empty: tell me your discipline (boxing, Muay Thai, MMA, BJJ…), your level and your size, and I'll suggest gear from the shop.",
  },
  fr: {
    cartItems: "Bonjour ! Je suis CartMind, votre coach équipement de sports de combat. Dites-moi votre discipline (boxe, Muay Thai, MMA, JJB…), votre niveau et votre taille, et je vous proposerai du matériel de la boutique. Vous pouvez aussi me poser des questions sur les articles de votre panier.",
    emptyCart: "Bonjour ! Je suis CartMind, votre coach équipement de sports de combat. Votre panier est vide : dites-moi votre discipline (boxe, Muay Thai, MMA, JJB…), votre niveau et votre taille, et je vous proposerai du matériel de la boutique.",
  },
  de: {
    cartItems: "Hallo! Ich bin CartMind, dein Ausrüstungs-Coach für Kampfsport. Sag mir deine Disziplin (Boxen, Muay Thai, MMA, BJJ…), dein Niveau und deine Größe, und ich empfehle dir passende Ausrüstung aus dem Shop. Du kannst mich auch zu den Artikeln in deinem Warenkorb fragen.",
    emptyCart: "Hallo! Ich bin CartMind, dein Ausrüstungs-Coach für Kampfsport. Dein Warenkorb ist leer: Sag mir deine Disziplin (Boxen, Muay Thai, MMA, BJJ…), dein Niveau und deine Größe, und ich empfehle dir passende Ausrüstung aus dem Shop.",
  },
  nl: {
    cartItems: "Hallo! Ik ben CartMind, je uitrustingscoach voor vechtsporten. Vertel me je discipline (boksen, Muay Thai, MMA, BJJ…), je niveau en je maat, dan stel ik passende uitrusting uit de winkel voor. Je kunt me ook vragen stellen over de artikelen in je winkelwagen.",
    emptyCart: "Hallo! Ik ben CartMind, je uitrustingscoach voor vechtsporten. Je winkelwagen is leeg: vertel me je discipline (boksen, Muay Thai, MMA, BJJ…), je niveau en je maat, dan stel ik passende uitrusting uit de winkel voor.",
  },
  it: {
    cartItems: "Ciao! Sono CartMind, il tuo coach per l'attrezzatura da sport da combattimento. Dimmi la tua disciplina (boxe, Muay Thai, MMA, BJJ…), il tuo livello e la tua taglia, e ti suggerirò l'attrezzatura del negozio. Puoi anche farmi domande sugli articoli nel tuo carrello.",
    emptyCart: "Ciao! Sono CartMind, il tuo coach per l'attrezzatura da sport da combattimento. Il tuo carrello è vuoto: dimmi la tua disciplina (boxe, Muay Thai, MMA, BJJ…), il tuo livello e la tua taglia, e ti suggerirò l'attrezzatura del negozio.",
  },
  es: {
    cartItems: "¡Hola! Soy CartMind, tu coach de equipamiento de deportes de combate. Dime tu disciplina (boxeo, Muay Thai, MMA, BJJ…), tu nivel y tu talla, y te sugeriré equipo de la tienda. También puedes preguntarme por los artículos de tu carrito.",
    emptyCart: "¡Hola! Soy CartMind, tu coach de equipamiento de deportes de combate. Tu carrito está vacío: dime tu disciplina (boxeo, Muay Thai, MMA, BJJ…), tu nivel y tu talla, y te sugeriré equipo de la tienda.",
  },
  ja: {
    cartItems: "こんにちは！格闘技ギアのコーチ、CartMindです。競技（ボクシング、ムエタイ、MMA、BJJなど）、レベル、サイズを教えてください。ショップの商品からおすすめをご提案します。カート内の商品についてもご質問いただけます。",
    emptyCart: "こんにちは！格闘技ギアのコーチ、CartMindです。カートは空です。競技（ボクシング、ムエタイ、MMA、BJJなど）、レベル、サイズを教えてください。ショップの商品からおすすめをご提案します。",
  },
  ru: {
    cartItems: "Здравствуйте! Я CartMind, ваш тренер по экипировке для единоборств. Расскажите о вашей дисциплине (бокс, муай-тай, ММА, БЖЖ…), уровне и размере, и я подберу снаряжение из магазина. Вы также можете спросить меня о товарах в корзине.",
    emptyCart: "Здравствуйте! Я CartMind, ваш тренер по экипировке для единоборств. Ваша корзина пуста: расскажите о вашей дисциплине (бокс, муай-тай, ММА, БЖЖ…), уровне и размере, и я подберу снаряжение из магазина.",
  },
};

export function buildGeneralShopReply(locale: ChatLocale, hasCartItems: boolean) {
  const copy = GENERAL_SHOP_COPY[locale];
  return hasCartItems ? copy.cartItems : copy.emptyCart;
}

// Messages that the deterministic rule engine answers better than the LLM:
// cart mutations, sizing, budget, comparison and explanations of cart recommendations.
// Discipline names alone (boxing, MMA…) are deliberately absent so shop questions reach the LLM.
const RULE_ENGINE_INTENT_RE = /\b(budget|optimi[sz]|compare|add|remove|swap|quantit|quantity|sizes?|fit|sparring|combat|tailles?|pratique|adapt[eé]|recommend|recommand|suggest|sugg[eè]re|conseil|propose|s['’]?accorde|accorde|va\s+bien|works?\s+well|goes?\s+well)\b/;

export function isRuleEngineIntent(message: string) {
  return RULE_ENGINE_INTENT_RE.test(message) && !isGeneralShopIntent(message);
}
