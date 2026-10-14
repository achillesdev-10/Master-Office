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
 * 2. Protection Clerk du back-office `/admin/**` et `/dashboard/**`.
 * 3. Sur un domaine de boutique, bloque l'accès direct à `/store/*`, `/admin`, `/dashboard`.
 */

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/dashboard(.*)"]);
const isPublicRoute = createRouteMatcher(["/login(.*)", "/auth/redirect"]);

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
  "test",
  "preview",
]);

/** Routes servies telles quelles, même sur un sous-domaine. */
function isTenantPassthrough(pathname: string): boolean {
  return (
    pathname === "/suspended" ||
    pathname.startsWith("/suspended/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/redirect") ||
    pathname.startsWith("/api")
  );
}

/**
 * Vérifie si le host est un domaine de boutique (plateforme ou custom).
 * Si oui, bloque l'accès à /store/*, /admin/*, /dashboard/*.
 */
function isStoreHost(host: string, rootDomain: string): boolean {
  if (!host) return false;
  const normalizedHost = host.toLowerCase().split(":")[0] ?? "";
  if (!normalizedHost) return false;

  // Sous-domaine plateforme : {slug}.{rootDomain} ou www.{slug}.{rootDomain}
  if (normalizedHost.endsWith(`.${rootDomain}`)) {
    const prefix = normalizedHost.slice(0, -(rootDomain.length + 1));
    if (prefix) {
      const label = prefix.split(".")[0] ?? "";
      if (label && !RESERVED_SUBDOMAINS.has(label)) {
        return true;
      }
    }
  }

  // Note: Les domaines custom sont vérifiés via Redis dans getTenantSlugFromHost
  return false;
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
  // Allow public routes to pass through without auth
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
  const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? `https://${rootDomain}`).host.toLowerCase();
  const isVercelPreviewHost = host.endsWith(".vercel.app");
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  // 1. Détection domaine boutique (plateforme ou custom via Redis)
  const tenantSlug = await getTenantSlugFromHost(req);
  const isStoreDomain = !!tenantSlug;

  // 2. Sur un domaine de boutique, bloque l'accès direct à /store/*, /admin/*, /dashboard/*
  if (isStoreDomain) {
    const pathname = req.nextUrl.pathname;
    if (
      pathname.startsWith("/store/") ||
      pathname === "/store" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard")
    ) {
      // Redirige vers l'hôte de l'app principal
      const redirectUrl = new URL(req.url);
      redirectUrl.host = appHost;
      redirectUrl.pathname = pathname;
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 3. Si pas domaine boutique, et pas hôte app/vercel/localhost, pas de réécriture
  if (!isStoreDomain) {
    // Laisse passer les requêtes sur l'hôte principal, Vercel, localhost
    const isAppHost = host === appHost;
    if (!isAppHost && !isVercelPreviewHost && !isLocalhost) {
      // Hôte inconnu, on laisse passer (le layout store fera le 404)
    }
  }

  // 4. Domaine boutique (plateforme ou custom) → réécriture /store/{slug}/…
  if (tenantSlug && !isTenantPassthrough(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = `/store/${tenantSlug}${req.nextUrl.pathname}`;

    const headers = new Headers(req.headers);
    headers.set("x-tenant-slug", tenantSlug);

    return NextResponse.rewrite(url, { request: { headers } });
  }

  // 5. Back-office protégé par Clerk
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
    // Clerk
    "/__clerk/:path*",
  ],
};