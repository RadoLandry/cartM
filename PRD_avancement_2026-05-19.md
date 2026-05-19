# Avancement des fonctionnalités PRD CartMind (19 mai 2026)

| Capability / Feature                                 | Statut    | Preuve / Détail                                                                                 |
|------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------|
| **Foundation (Phase 0)**                             |           |                                                                                                 |
| Shopify app scaffold (React Router, auth, session)    | ajouté    | app/shopify.server.ts, app/routes/app.tsx, package.json                                         |
| Vercel deploy config, API version, scopes            | ajouté    | shopify.app.toml, app/shopify.server.ts                                                         |
| Prisma/PostgreSQL/pgvector, schéma DB                | ajouté    | prisma/schema.prisma, migration.sql                                                             |
| App Bridge + Polaris shell                           | ajouté    | app/routes/app.tsx, package.json                                                                |
| shadcn/ui + Tailwind CSS                             | absent    | Pas de trace dans package.json ni composants shadcn                                             |
| Shopify Billing API                                  | absent    | Pas de billing.tsx, pas de logique d’abonnement                                                 |
| App Proxy config                                     | absent    | Pas de api.app-proxy.tsx, pas de config proxy dans shopify.app.toml                             |
| Vercel AI SDK/provider registry                      | absent    | Pas de ai/ ni de config AI visible                                                              |
| **Product Knowledge Graph (Phase 1)**                |           |                                                                                                 |
| Catalog ingestion & sync                             | partiel   | Schéma, migration, stubs ingestion.ts, normalisation.ts, webhooks déclarés mais non branchés    |
| Discipline/category taxonomy                         | absent    | Pas de taxonomy.ts, pas de logique de classification                                            |
| Product relationship mapping                         | absent    | Pas de relationships.ts, pas de logique de graph                                                |
| Size & fit intelligence                              | absent    | Pas de sizing.ts, pas de mapping de tailles                                                     |
| Colorway & collection tracking                       | partiel   | Stub colorways.ts, champ dominantColors en DB, pas de logique réelle                            |
| **Cart Intelligence Engine (Phase 2)**               | absent    | Aucun module cart-intelligence/ présent                                                         |
| **Conversational Cart Sidebar (Phase 3)**            | absent    | Pas de ai/, pas de widget chat, pas de tools                                                    |
| **Visual Kit Preview (Phase 3)**                     | absent    | Pas de visual/, pas de compositing                                                              |
| **Merchant Admin Dashboard (Phase 3)**               | absent    | Pas de UI admin métier, SyncStatusCard/SyncFailureTable sont des stubs                          |
| **Shopify Storefront Integration (Phase 3)**         | absent    | Pas d’extensions/, pas de widget, pas de liquid block                                           |

**Résumé :**
- Fondations techniques (Shopify app, DB, API, webhooks, shell admin) : OK
- Ingestion catalogue : amorcée (DB, stubs, webhooks déclarés) mais pas fonctionnelle
- Intelligence produit, cart, AI, UI avancée, extensions : pas encore présentes

Mise à jour : 19/05/2026
