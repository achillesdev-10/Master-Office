# Architecture — Super Admin Dashboard

Documentation technique du back-office (modules 1 → 15 du cahier des charges).

## 1. Stack & fondations

| Couche | Choix |
| ------ | ----- |
| Framework | Next.js 15 (App Router, React Server Components par défaut) |
| Langage | TypeScript strict + `noUncheckedIndexedAccess`, alias `@/*` → `src/*` |
| Données | PostgreSQL + Prisma 6 (`pnpm db:migrate`, `pnpm db:seed`) |
| Auth | Clerk (webhook svix → table `User`, rôles dans `publicMetadata`) |
| Cache | Upstash Redis (REST) — provisioning boutique + résolution host |
| Stockage | Vercel Blob (logos, aperçus de thèmes) |
| UI | Tailwind CSS + composants maison dans `src/components/ui` |
| Validation | Zod (un schéma par formulaire, dans `src/lib/validators`) |
| Mutations | Server Actions (retour `ActionResult`, jamais de `useActionState`) |

### Conventions de code

- **Server Components par défaut** ; `"use client"` uniquement pour l'interaction
  (`useTransition`, `router.refresh()`, sonner, états locaux).
- **Toute mutation suit le même chemin** :
  `requireSuperAdmin()` (refus des comptes `disabled`) → validation Zod →
  mutation Prisma → `logAction()` (audit) → `revalidatePath/Tag` →
  retour `ActionResult` (`{ success } | { success: false, error, fieldErrors }`).
- **Client** : appel de l'action → `toast.success/error` → `router.refresh()`.
- Encodage : fichiers UTF-8 sans BOM — ne jamais écrire les sources avec
  `Set-Content`/`Add-Content` PowerShell (casse les accents).

## 2. Structure

```
src/
├── app/
│   ├── (auth)/login/        # <SignIn /> Clerk
│   ├── admin/               # Back-office (garde Super Admin dans le layout)
│   │   ├── dashboard/       # M4   KPIs + croissance
│   │   ├── tenants/         # M5-7 liste, wizard 7 étapes, fiche 8 onglets
│   │   ├── domains/         # M8   liste + fiche DNS/SSL
│   │   ├── users/           # M9   liste + fiche /admin/users/[id]
│   │   ├── plans/           # M10  CRUD des plans
│   │   ├── subscriptions/   # M10  abonnements
│   │   ├── themes/          # M11  catalogue + /admin/themes/new
│   │   ├── audit-logs/      # M12  journal + filtres + pagination
│   │   ├── settings/        # M13  5 onglets (Général → Sécurité)
│   │   └── support/         #      état vide (tickets à venir)
│   ├── store/[slug]/        # M14  vitrine boutique (placeholder)
│   ├── suspended/           # M14  boutique non publique (DRAFT/SUSPENDED/…)
│   ├── api/
│   │   ├── audit-logs/export/ # M12 export CSV (Super Admin, BOM UTF-8)
│   │   ├── health/           # M15 healthcheck (SELECT 1)
│   │   └── webhooks/clerk/   #     sync User (signature svix)
│   ├── page.tsx             # "/" → /admin/dashboard
│   └── not-found.tsx        # 404 global (dont slug boutique inconnu)
├── middleware.ts            # routing multi-tenant + protection /admin
├── components/admin/        # tables, toolbars, managers, settings…
└── lib/
    ├── actions/             # Server Actions (tenants, themes, settings…)
    ├── audit/log.ts         # logAction() → action, entity, entityId, ip, metadata
    ├── auth/permissions.ts  # getCurrentUser / requireSuperAdmin / hasRole
    ├── db/{prisma,queries}/ # client Prisma + lectures par module
    ├── security/crypto.ts   # AES-256-GCM (secrets, format v1.iv.tag.data)
    ├── tenant/
    │   ├── provision.ts     # Redis : tenant:{slug}, tenant:host:{host} (TTL 5 min)
    │   └── resolve.ts       # mémoire → Redis → PostgreSQL (runtime Node)
    ├── validators/          # Zod : tenant, user, subscription, theme, settings…
    └── utils.ts             # cn(), formatNumber/Currency/Percent
```

## 3. Authentification & autorisations

1. `src/middleware.ts` protège `/admin/**` : sans session Clerk →
   redirection `/login?redirect_url=…`.
2. Le layout `src/app/admin/layout.tsx` appelle `requireSuperAdmin()` :
   rôle exigé + **compte non désactivé** (`User.disabled`).
3. Chaque Server Action refait l'appel : aucune mutation sans garde serveur.
4. Rôles : `SUPER_ADMIN` (plateforme), `ADMIN`/`MEMBER` (par boutique via
   `TenantUser`). Les boutiques créées invitent leurs membres séparément.

## 4. Multi-tenant (module 14)

- **Domaine** : `{slug}.{NEXT_PUBLIC_ROOT_DOMAIN}` (wildcard DNS → Vercel).
- **Middleware (Edge)** : préfixe avant le domaine racine = slug, sauf
  réserves (`www`, `admin`, `api`, …) ; lit `tenant:host:{host}` dans Redis
  (REST Upstash, jamais Prisma en Edge) puis réécrit
  `/{…}` → `/store/{slug}/{…}` avec le header `x-tenant-slug`.
  Routes passées telles quelles sur un sous-domaine : `/suspended`,
  `/login`, `/store`, `/api`.
- **Validation serveur (Node)** : `resolveTenant(slug)` — cache mémoire
  (5 min) → Redis `tenant:{slug}` → PostgreSQL (avec re-provision Redis).
- **Statut** : layout `store/[slug]` → `notFound()` si slug inconnu/archivé,
  `redirect("/suspended?shop=…")` si statut ≠ `ACTIVE`.
- Les mutations de boutique invalident le cache Redis **et** le cache mémoire
  (`invalidateTenantCache()` + `invalidateTenantResolveCache()`).

## 5. Données principales

`User` · `Tenant` · `TenantDomain` · `TenantUser` · `TenantPayment` ·
`ShippingMethod` · `Plan` · `Subscription` · `Theme` · `AuditLog` ·
`PlatformSetting`.

Points notables :

- **Soft delete** des boutiques (`Tenant.deletedAt`), jamais de purge réelle.
- **Abonnement** : une ligne `Subscription` par boutique (statut
  `ACTIVE/TRIAL/PAST_DUE/CANCELLED`), plan de référence sur `Tenant.planId`.
- **Plans** : `price` en centimes (entier), `currency` (ISO-3),
  `features` (JSON : tableau de chaînes).
- **Thèmes** : `description`, `previewUrl` (Blob, 2 Mo max), `category`,
  `isPremium`.
- **Audit** : `action` (point), `entity`/`entityId` (cible), `userId`,
  `tenantId`, `ip` (header `x-forwarded-for`), `metadata` JSON dépliable.
  Échec d'écriture d'audit ⇒ jamais d'échec de l'action métier.
- **Paramètres** : `PlatformSetting` une ligne par section
  (`settings.general`, `.emails`, `.payments`, `.integrations`, `.security`).

## 6. Sécrets

- `src/lib/security/crypto.ts` : AES-256-GCM, clé dérivée d'`ENCRYPTION_KEY`
  (64 hex caractères ou passphrase ≥ 16).
- Champs chiffrés : clés API de paiement des boutiques, secrets des
  Paramètres (`smtpPassword`, `stripeSecretKey`, `stripeWebhookSecret`,
  `redisUrl`).
- Jamais de secret en clair côté client : l'UI n'affiche que
  « configuré / non configuré » (`maskEncrypted`), un champ vide conserve
  la valeur stockée.

## 7. Scripts

| Commande | Rôle |
| -------- | ---- |
| `pnpm dev` / `build` / `start` | cycle Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint (next/core-web-vitals + typescript) + `tsc --noEmit` |
| `pnpm db:migrate` / `db:deploy` | migrations (dev / prod) |
| `pnpm db:seed` | seed idempotent (démo complète, modules 1 → 13) |

CI (`.github/workflows/ci.yml`) : install → `prisma generate` → lint →
typecheck → build, avec variables factices (pas de BDD réelle nécessaire).
Healthcheck : `GET /api/health` → `{ status, database }` (503 si base KO).
