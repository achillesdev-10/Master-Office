import type { TenantStatus } from "@prisma/client";

/**
 * Provisioning Redis d'un tenant (module 6 → utilisé ensuite par le
 * middleware multi-tenant du module 14).
 *
 * Client REST Upstash minimal (fetch uniquement) : compatible runtime
 * Edge — le middleware ne doit jamais importer d'API Node.
 *
 * Clés :
 *  - `tenant:{slug}`            → configuration complète de la boutique
 *  - `tenant:host:{host}`       → slug (résolution par sous-domaine, TTL 5 min)
 *
 * Redis reste un cache : toute écriture est rejouable depuis la DB.
 * Si Upstash n'est pas configuré, les fonctions retournent `null`/`false`
 * sans faire échouer l'appelant.
 */

export type TenantProvisioning = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  currency: string;
  language: string;
  timezone: string;
  primaryColor: string | null;
  logoUrl: string | null;
  description: string | null;
  themeId: string | null;
  planId: string | null;
  domains: string[];
  rootDomain: string;
};

/** TTL (secondes) du cache de résolution host → slug. */
export const HOST_CACHE_TTL = 300;

export function tenantKey(slug: string): string {
  return `tenant:${slug}`;
}

export function tenantHostKey(host: string): string {
  return `tenant:host:${host.toLowerCase()}`;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

type RestEndpoint = { url: string; token: string };

function getRest(): RestEndpoint | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/** GET /get/{key} → valeur désérialisée (JSON si possible). */
async function restGet<T>(key: string): Promise<T | null> {
  const rest = getRest();
  if (!rest) return null;

  const response = await fetch(
    `${rest.url}/get/${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${rest.token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Redis GET ${response.status}`);
  }

  const data = (await response.json()) as { result: unknown };
  const result = data.result;
  if (typeof result !== "string") return (result ?? null) as T | null;

  try {
    return JSON.parse(result) as T;
  } catch {
    return result as T;
  }
}

/** POST /set — `ex` en secondes (absent = clé permanente). */
async function restSet(
  key: string,
  value: string,
  ex?: number,
): Promise<void> {
  const rest = getRest();
  if (!rest) return;

  const response = await fetch(`${rest.url}/set`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rest.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, value, ...(ex ? { ex } : {}) }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Redis SET ${response.status}`);
  }
}

/** POST /del — suppression de plusieurs clés. */
async function restDel(keys: string[]): Promise<void> {
  const rest = getRest();
  if (!rest || keys.length === 0) return;

  const response = await fetch(`${rest.url}/del`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rest.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(keys),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Redis DEL ${response.status}`);
  }
}

/** Écrit la config du tenant + le mappage host → slug. */
export async function provisionTenant(
  config: TenantProvisioning,
): Promise<boolean> {
  if (!isRedisConfigured()) return false;

  try {
    await restSet(tenantKey(config.slug), JSON.stringify(config));
    const hosts = [
      `${config.slug}.${config.rootDomain}`,
      `www.${config.slug}.${config.rootDomain}`,
    ];
    await Promise.all(
      hosts.map((host) =>
        restSet(tenantHostKey(host), JSON.stringify(config.slug), HOST_CACHE_TTL),
      ),
    );
    return true;
  } catch (error) {
    console.error("[provision] écriture Redis impossible", error);
    return false;
  }
}

/** Invalide les entrées Redis d'un tenant (après mutation). */
export async function invalidateTenantCache(
  slug: string,
  rootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com",
): Promise<boolean> {
  if (!isRedisConfigured()) return false;

  try {
    await restDel([
      tenantKey(slug),
      tenantHostKey(`${slug}.${rootDomain}`),
      tenantHostKey(`www.${slug}.${rootDomain}`),
    ]);
    return true;
  } catch (error) {
    console.error("[provision] invalidation Redis impossible", error);
    return false;
  }
}

/** Lit la config provisionnée (null si absente / non configuré). */
export async function getTenantConfig(
  slug: string,
): Promise<TenantProvisioning | null> {
  if (!isRedisConfigured()) return null;

  try {
    return await restGet<TenantProvisioning>(tenantKey(slug));
  } catch (error) {
    console.error("[provision] lecture Redis impossible", error);
    return null;
  }
}

/**
 * Résout un host → slug via Redis (TTL 5 min). Utilisé par le middleware
 * (runtime Edge : REST Upstash uniquement, jamais Prisma ici).
 * Renvoie `null` si Redis est absent ou si le host est inconnu.
 */
export async function getTenantSlugByHost(
  host: string,
): Promise<string | null> {
  if (!isRedisConfigured()) return null;

  try {
    return await restGet<string>(tenantHostKey(host));
  } catch (error) {
    console.error("[provision] résolution host impossible", error);
    return null;
  }
}
