# Onboarding — mise en route & première boutique

Guide pas-à-pas pour lancer la plateforme et créer une boutique de démonstration.
Complément du [`README`](../README.md) (installation, variables d'env).

## 1. Prérequis

- Node.js ≥ 20.9, pnpm ≥ 9 (`corepack enable`)
- Une base PostgreSQL (Neon, Supabase, Vercel Postgres…)
- Comptes : **Clerk** (auth), **Upstash** (Redis, optionnel en dev),
  **Vercel Blob** (logos/aperçus), **Vercel** (hébergement)

## 2. Installation locale

```bash
pnpm install                # génère le client Prisma (postinstall)
cp .env.example .env        # puis renseigner les valeurs
pnpm db:migrate             # applique les migrations SQL
pnpm db:seed                # données de démo (idempotent)
pnpm dev                    # http://localhost:3000
```

`http://localhost:3000` redirige vers `/admin/dashboard` → `/login` si non
connecté.

## 3. Comptes & rôles

Le seed crée :

| Email | Rôle | Usage |
| ----- | ---- | ----- |
| `admin@maboutique.com` | `SUPER_ADMIN` | Premier compte plateforme |
| `owner@example.com` | `ADMIN` | Membre d'une boutique |
| `staff@example.com` | `MEMBER` | Membre d'une boutique |

**Clerk d'abord** : créez le compte dans Clerk (page `/login`), puis remplacez
`clerkId` « placeholder » de la ligne `admin@maboutique.com` par le vrai
identifiant Clerk (Prisma Studio : `pnpm db:studio`), ou laissez le webhook
`/api/webhooks/clerk` synchroniser `User` (`user.created`, `user.updated`,
`user.deleted` + *Signing secret* dans `CLERK_WEBHOOK_SECRET`).

Seul un `SUPER_ADMIN` non désactivé accède à `/admin/**`.

## 4. Créer une boutique (module 5 → 7)

1. Sidebar → **Boutiques** → **Nouvelle boutique**.
2. Le wizard de 7 étapes :
   1. **Identité** — nom, slug (`https://{slug}.{racine}`), description ;
   2. **Contact** — nom/email/pays du client porteur ;
   3. **Apparence** — thème du catalogue + couleur principale ;
   4. **Livraison** — modes (gratuit, forfait, retrait…) ;
   5. **Paiements** — providers (Stripe, PayPal, COD…) + clés API
      (**chiffrées AES-256-GCM**, jamais stockées en clair) ;
   6. **Plan** — attribution d'un abonnement (Starter / Pro / Business) ;
   7. **Récapitulatif** — vérification puis création.
3. À la création, le back-office :
   - crée l'organisation Clerk associée (si configurée) ;
   - **provisionne Redis** (`tenant:{slug}` + `tenant:host:{host}`, TTL 5 min) ;
   - journalise `tenant.create` dans le journal d'activité.

Ensuite, depuis la **fiche boutique** (`/admin/tenants/[id]`) : infos,
apparence (aperçus visuels des thèmes), paiements, livraison, membres,
domaines, stats et zone dangereuse (suspendre / archiver).

## 5. Sous-domaines (module 14)

- `NEXT_PUBLIC_ROOT_DOMAIN` = domaine racine (ex. `maboutique.com`).
- DNS : enregistrement **A/ALIAS** vers Vercel + **wildcard `*`** pour
  `{slug}.maboutique.com`.
- Middleware : le sous-domaine → réécriture `/store/{slug}` (Redis en Edge,
  validation finale en base). Statut ≠ `ACTIVE` → page `/suspended`.
- Localement : utilisez un outil comme `*.lvh.me` ou ajoutez une entrée
  `hosts` (`127.0.0.1 monboutique.localhost`) — le slug doit correspondre.

## 6. Paramètres de la plateforme (module 13)

Sidebar → **Paramètres**, 5 onglets :

| Onglet | Contenu |
| ------ | ------- |
| Général | nom, domaine racine, email support, devise, mode maintenance |
| Emails | expéditeur + SMTP (mot de passe chiffré) |
| Paiements | clés Stripe (secrètes chiffrées), mode test |
| Intégrations | URL Redis, DSN Sentry, ID analytics |
| Sécurité | 2FA obligatoire, durée de session, rétention du journal, liste blanche IP |

Un champ secret vide conserve la valeur actuelle. Sans `ENCRYPTION_KEY`,
l'enregistrement d'un secret est refusé (jamais de stockage en clair).

## 7. Journal d'activité (module 12)

`/admin/audit-logs` : filtres action / entité / boutique / utilisateur /
période, métadonnées dépliables (copie JSON), export CSV
(`/api/audit-logs/export`, Super Admin uniquement).
Toutes les mutations écrivent une entrée avec `entity`, `entityId` et `ip`.

## 8. Dépannage

| Symptôme | Cause probable |
| -------- | -------------- |
| `prisma migrate` échoue | `DATABASE_URL` / `DIRECT_URL` absentes ou base injoignable |
| Redirection `/login` en boucle | compte Clerk sans `clerkId` dans `User` |
| 403 « rôle Super Admin requis » | rôle ≠ `SUPER_ADMIN` ou compte `disabled` |
| Secret refusé à l'enregistrement | `ENCRYPTION_KEY` manquante (< 16 caractères) |
| Sous-domaine → 404 | slug inexistant, wildcard DNS absent, ou cache Redis périmé (TTL 5 min) |
| Boutique non accessible | statut `DRAFT/SUSPENDED/ARCHIVED` → page `/suspended` |
| `pnpm build` erreur Prisma | lancer `pnpm db:generate` (ou réinstaller) |

Healthcheck : `GET /api/health` → `{ "status": "ok", "database": "up" }`.
