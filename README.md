# Super Admin Dashboard — SaaS Multi-tenant E-commerce

Console d'administration (Super Admin) de la plateforme SaaS multi-tenant e-commerce.

**Stack :** Next.js 15 (App Router) · React 19 · TypeScript strict · Prisma · Clerk · Tailwind CSS · shadcn/ui · Upstash Redis · Vercel

> 📦 **État actuel — Modules 1 → 15 livrés :** shell, dashboard, boutiques (liste + wizard + fiche), domaines, utilisateurs, abonnements, thèmes, journal d’activité, paramètres, résolution multi-tenant (`/store/[slug]`, `/suspended`) et socle doc/CI sont implémentés et vérifiés (`pnpm lint`, `pnpm typecheck`, `pnpm build` ✓). Reste à exécuter côté base : `pnpm db:migrate` puis `pnpm db:seed`.
>
> 📚 **Docs :** [architecture](./docs/architecture.md) · [onboarding & première boutique](./docs/onboarding-client.md) · CI GitHub Actions (`.github/workflows/ci.yml`).

---

## 1. Prérequis

| Outil   | Version recommandée |
| ------- | ------------------- |
| Node.js | ≥ 20.9 (22 LTS idéalement) |
| pnpm    | ≥ 9 (`corepack enable`) |
| Git     | ≥ 2.x |

Comptes à préparer : **Vercel** (ou tout hoster), **Clerk**, **Neon / Supabase / Vercel Postgres**, **Upstash**, **Resend**, **Vercel Blob**.

---

## 2. Installation

```bash
# 1. Cloner et installer les dépendances
git clone <url-du-repo> super-admin-dashboard
cd super-admin-dashboard
pnpm install

# 2. Configurer l'environnement
cp .env.example .env
# → éditer .env et renseigner les valeurs (voir section 4)

# 3. Générer le client Prisma
pnpm db:generate

# 4. Initialiser shadcn/ui (crée components.json + src/components/ui)
npx shadcn@latest init

# 5. Lancer le serveur de dev
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

---

## 3. Commandes

| Commande             | Description                                        |
| -------------------- | -------------------------------------------------- |
| `pnpm dev`           | Serveur de développement (Next.js)                 |
| `pnpm build`         | Build de production                                |
| `pnpm start`         | Servir le build de production                      |
| `pnpm lint`          | Lint ESLint (config Next.js)                       |
| `pnpm typecheck`     | Vérification TypeScript **strict** (`tsc --noEmit`) |
| `pnpm db:generate`   | Générer le client Prisma                           |
| `pnpm db:push`       | Pousser le schéma en dev (sans migration)          |
| `pnpm db:migrate`    | Créer/appliquer une migration (dev)                |
| `pnpm db:deploy`     | Appliquer les migrations en prod                   |
| `pnpm db:studio`     | Prisma Studio (inspection de la BDD)                |
| `pnpm db:seed`       | Seed de démonstration (idempotent)                  |

---

## 4. Variables d'environnement

Tout est documenté dans [`.env.example`](./.env.example). Résumé :

| Variable                              | Rôle                                        |
| ------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`                        | PostgreSQL (runtime Prisma)                 |
| `DIRECT_URL`                          | PostgreSQL direct (migrations, optionnel)   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | Clé publique Clerk                          |
| `CLERK_SECRET_KEY`                    | Clé secrète Clerk                           |
| `CLERK_WEBHOOK_SECRET`                | Signature des webhooks Clerk (svix)         |
| `UPSTASH_REDIS_REST_URL`              | URL REST Upstash Redis                      |
| `UPSTASH_REDIS_REST_TOKEN`            | Token Upstash Redis                         |
| `BLOB_READ_WRITE_TOKEN`               | Stockage de fichiers (Vercel Blob)          |
| `NEXT_PUBLIC_ROOT_DOMAIN`             | Domaine racine multi-tenant (`{t}.racine`)  |
| `NEXT_PUBLIC_APP_URL`                 | URL publique de l'app                       |
| `ENCRYPTION_KEY`                      | 64 hex — chiffre les secrets (AES-256-GCM)  |
| `RESEND_API_KEY`                      | Emails transactionnels                      |
| `EMAIL_FROM`                          | Expéditeur des emails                       |

⚠️ `.env` est gitignoré. Seul `.env.example` est committé.

### Configuration Clerk en détail

1. Créer une application Clerk (dev + prod) et copier les clés dans `.env`
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
2. `NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"` pointe vers la page
   `src/app/(auth)/login` (composant `<SignIn />`).
3. **Webhook** : dashboard Clerk → *Webhooks → Add endpoint*, URL
   `https://<domaine>/api/webhooks/clerk`, événements `user.created`,
   `user.updated`, `user.deleted`. Copier le *Signing secret* (`whsec_…`)
   dans `CLERK_WEBHOOK_SECRET`. La route vérifie la signature svix puis
   synchronise la table `User` de façon idempotente (upsert sur `clerkId`,
   `deleteMany` à la suppression).
4. **Jamais de mot de passe côté Prisma** : Clerk reste le seul détenteur
   des identifiants.
5. Les routes `/admin/*` sont protégées par `src/middleware.ts` (redirigées
   vers `/login`) puis par `requireSuperAdmin()` dans le layout `src/app/admin`.

---

## 5. Structure du projet

```
.
├── prisma/
│   ├── schema.prisma        # Tenant, Plan, Subscription, Theme, AuditLog, PlatformSetting…
│   ├── seed.ts              # Seed démo idempotent (plans prix/features, thèmes, audit, settings)
│   └── migrations/          # Migrations SQL
├── docs/
│   ├── architecture.md      # Technique : stack, multi-tenant, données, secrets, CI
│   └── onboarding-client.md # Mise en route, création d'une boutique, dépannage
├── .github/workflows/ci.yml # CI : lint → typecheck → build
├── public/                  # Assets statiques
├── scripts/                 # Scripts utilitaires
├── src/
│   ├── app/
│   │   ├── page.tsx         # "/" → /admin/dashboard
│   │   ├── not-found.tsx    # 404 global (dont slug boutique inconnu)
│   │   ├── (auth)/login/    # /login → <SignIn />
│   │   ├── admin/           # Zone protégée (requireSuperAdmin)
│   │   │   ├── layout.tsx   # Shell + garde rôle Super Admin
│   │   │   ├── dashboard/   # Module 4 — KPIs, croissance
│   │   │   ├── tenants/     # Modules 5-6 — liste + wizard ; [id]/ → fiche 8 onglets (7)
│   │   │   ├── domains/     # Module 8 — liste + fiche (DNS/SSL)
│   │   │   ├── users/       # Module 9 — liste + fiche /admin/users/[id]
│   │   │   ├── plans/       # Module 10 — CRUD des plans
│   │   │   ├── subscriptions/ # Module 10 — abonnements
│   │   │   ├── themes/      # Module 11 — catalogue + /themes/new
│   │   │   ├── audit-logs/  # Module 12 — journal (entité, IP, boutique)
│   │   │   ├── settings/    # Module 13 — 5 onglets (Général → Sécurité)
│   │   │   └── support/     # État vide (tickets à venir)
│   │   ├── store/[slug]/    # Module 14 — vitrine boutique (placeholder)
│   │   ├── suspended/       # Module 14 — boutique non publique
│   │   └── api/
│   │       ├── audit-logs/export/ # Module 12 — export CSV (Super Admin)
│   │       ├── health/            # Module 15 — healthcheck (SELECT 1)
│   │       └── webhooks/clerk/    # Sync User (svix, idempotent)
│   ├── middleware.ts        # Multi-tenant (sous-domaine → /store) + /admin → /login
│   ├── components/
│   │   ├── admin/           # Tables, toolbars, formulaires, managers, settings
│   │   │   ├── tenant-form/ # Wizard 7 étapes (création)
│   │   │   └── tenant-detail/ # Onglets de la fiche boutique
│   │   ├── dashboard/       # Cartes KPI, chart
│   │   ├── ui/              # Composants shadcn/ui (générés)
│   │   └── {layout,shared}/ # réservés (vides)
│   ├── lib/
│   │   ├── actions/         # Server Actions (tenants, themes, settings…)
│   │   ├── audit/log.ts     # logAction() → action, entity, entityId, ip, metadata
│   │   ├── auth/permissions.ts # getCurrentUser / requireSuperAdmin / hasRole
│   │   ├── db/{prisma,queries}/ # Client Prisma + lectures par module
│   │   ├── security/crypto.ts # AES-256-GCM (secrets boutiques + paramètres)
│   │   ├── tenant/          # provision.ts (Redis) + resolve.ts (mémoire→Redis→BDD)
│   │   ├── validators/      # Schémas Zod par module
│   │   └── utils.ts         # cn(), formatNumber/Currency/Percent
│   └── {config,hooks,types}/ # réservés (vides)
├── .eslintrc.json           # next/core-web-vitals + next/typescript
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json            # strict + noUncheckedIndexedAccess + alias @/*
```

---

## 6. Déploiement sur Vercel

1. **Importer le repo** sur [vercel.com/new](https://vercel.com/new) — framework auto-détecté : *Next.js*, build : `next build`.
2. **Brancher la base de données** (Neon / Supabase / Vercel Postgres) et copier l'`DATABASE_URL` dans les *Environment Variables*.
3. **Définir toutes les variables** du tableau ci-dessus pour les environnements *Production* et *Preview*.
4. **Clerk :** ajouter les domaines de prod (ex. `app.example.com`) dans le dashboard Clerk.
5. **Migrations :** ajouter un *Build Step* pour appliquer les migrations à chaque déploiement :
   ```bash
   prisma migrate deploy && next build
   ```
6. **DNS :** pointer le domaine racine vers Vercel ; configurer le wildcard (`*`) vers le même domaine pour `{tenant}.{root_domain}` (multi-tenant par sous-domaine), ainsi que le CNAME `.vercel-dns.com`.
7. **Redéployer** après tout changement de variable d'environnement.

---

## 7. Modules

| Périmètre | Statut |
| --------- | ------ |
| Modules 1 → 3 — fondations, auth Clerk, shell du dashboard (layout, sidebar, topbar, thème clair/sombre) | ✅ |
| Module 4 — tableau de bord (KPIs, courbe de croissance, squelettes de chargement) | ✅ |
| Modules 5 → 6 — boutiques : liste (filtres, tri, pagination), wizard de création en 7 étapes, suspension/suppression | ✅ |
| Module 7 — fiche boutique : infos, apparence (aperçus), paiements, livraison, membres, domaines, stats, zone dangereuse | ✅ |
| Module 8 — domaines : liste, fiche, vérification DNS (CNAME), instruction de configuration, SSL | ✅ |
| Module 9 — utilisateurs plateforme : liste + fiche `/admin/users/[id]`, invitation, rôle, désactivation (gardes Super Admin) | ✅ |
| Module 10 — abonnements & plans : KPIs, attribution, changement de statut, CRUD `/admin/plans` (prix, devise, features) | ✅ |
| Module 11 — catalogue des thèmes : aperçus, badges premium/catégorie, création `/admin/themes/new`, édition, suppression protégée, upload d'aperçu | ✅ |
| Module 12 — journal d’activité : filtres (action, entité, boutique, utilisateur, période), colonnes entité/IP, métadonnées, export CSV | ✅ |
| Module 13 — paramètres `/admin/settings` : Général, Emails, Paiements, Intégrations, Sécurité (secrets chiffrés AES-256-GCM) | ✅ |
| Module 14 — multi-tenant : résolution sous-domaine (Redis Edge → `/store/[slug]`), page `/suspended`, 404 | ✅ |
| Module 15 — doc (`docs/`), CI GitHub Actions, healthcheck `/api/health` | ✅ |

**Guide :** création d'une boutique → [`docs/onboarding-client.md`](./docs/onboarding-client.md) § 4.

**Périmètre restant (hors cahier des charges livré) :** front marchand complet (`/store/[slug]` : catalogue, panier, checkout), tickets support, analytics avancés, emails transactionnels (Resend) et paiements Stripe réels — les socles (schéma, settings, chiffrement) sont en place.
