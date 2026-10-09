import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { getTenantSlugByHost } from "@/lib/tenant/provision";

/**
 * Middleware (module 14 + authentification).
 *
 * 1. Résolution de domaine : cherche le tenant dans Redis par host exact.
 *    Supporte :
 *    - Sous-domaines plateforme : `{slug}.{NEXT_PUBLIC_ROOT_DOMAIN}`
 *    - www + sous-domaine plateforme : `www.{slug}.{NEXT_PUBLIC_ROOT_DOMAIN}`
 *    - Domaines personnalisés : `boutique.ci`, `www.boutique.ci`
 *    → réécriture vers `/store/{slug}/**` avec header `x-tenant-slug`.
 *    Côté Edge uniquement Redis (REST Upstash) : jamais Prisma.
 *    Si Redis est absent, la validation finale (statut, existence) est faite
 *    par la layout `/store/[slug]` via `resolveTenant()`.
 * 2. Protection Clerk du back-office `/admin/**` (page racine uniquement).
 */

const isProtectedRoute = createRouteMatcher(["/admin(.*)"]);

/** Préfixes réservés : jamais interprétés comme un slug de boutique. */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "api",
  "app",
  "mail",
  "smtp",
  "cdn",
  "staging",
]);

/** Routes servies telles quelles, même sur un sous-domaine. */
function isTenantPassthrough(pathname: string): boolean {
  return (
    pathname === "/suspended" ||
    pathname.startsWith("/suspended/") ||
    pathname === "/login" ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/api")
  );
}

/**
 * Extrait le slug boutique depuis le host (ou le lit dans Redis).
 * `null` = host racine / réservé / inconnu → pas de réécriture.
 */
async function getTenantSlugFromHost(
  req: NextRequest,
): Promise<string | null> {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  if (!host) return null;

  // D'abord, essaie de résoudre via Redis (inclut domaines custom provisionnés)
  const fromRedis = await getTenantSlugByHost(host);
  if (fromRedis) return fromRedis;

  // Fallback : si pas dans Redis, essaie de déduire depuis sous-domaine plateforme
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
  if (!host.endsWith(`.${rootDomain}`)) return null;

  const prefix = host.slice(0, -(rootDomain.length + 1));
  if (!prefix) return null;

  const label = prefix.split(".")[0] ?? "";
  if (!label || RESERVED_SUBDOMAINS.has(label)) return null;

  return label;
}

export default clerkMiddleware(async (auth, req) => {
  // 1. Domaine boutique (plateforme ou custom) → réécriture /store/{slug}/…
  const tenantSlug = await getTenantSlugFromHost(req);
  if (tenantSlug && !isTenantPassthrough(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = `/store/${tenantSlug}${req.nextUrl.pathname}`;

    const headers = new Headers(req.headers);
    headers.set("x-tenant-slug", tenantSlug);

    return NextResponse.rewrite(url, { request: { headers } });
  }

  // 2. Back-office protégé par Clerk
  if (isProtectedRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "redirect_url",
        req.nextUrl.pathname + req.nextUrl.search,
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Fichiers statiques et Next internals exclus
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API (webhooks inclus — laissés publics, vérifiés par svix)
    "/(api|trpc)(.*)",
  ],
};