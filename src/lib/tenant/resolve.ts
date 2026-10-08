import prisma from "@/lib/db/prisma";
import {
  getTenantConfig,
  provisionTenant,
  type TenantProvisioning,
} from "@/lib/tenant/provision";

/**
 * Résolution de boutique côté serveur (module 14) — runtime Node.
 *
 * Ordre : cache mémoire (TTL 5 min) → Redis → PostgreSQL (avec
 * re-provision Redis). Le middleware ne fait que le routage (Redis) :
 * la validation finale (slug, statut) passe toujours par ici.
 */

/** TTL du cache mémoire par instance de serveur. */
const MEMORY_TTL_MS = 5 * 60_000;

type CacheEntry = {
  value: TenantProvisioning | null;
  expires: number;
};

const memory = new Map<string, CacheEntry>();

function memoryGet(key: string): CacheEntry | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry;
}

function memorySet(key: string, value: TenantProvisioning | null): void {
  memory.set(key, { value, expires: Date.now() + MEMORY_TTL_MS });
}

function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
}

/** Charge la config d'une boutique (null = inconnue / archivée). */
export async function resolveTenant(
  slug: string,
): Promise<TenantProvisioning | null> {
  const key = `slug:${slug}`;
  const cached = memoryGet(key);
  if (cached) return cached.value;

  const fromRedis = await getTenantConfig(slug);
  if (fromRedis) {
    memorySet(key, fromRedis);
    return fromRedis;
  }

  const row = await prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      currency: true,
      language: true,
      timezone: true,
      primaryColor: true,
      logoUrl: true,
      description: true,
      themeId: true,
      planId: true,
      domains: { select: { domain: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!row) {
    memorySet(key, null);
    return null;
  }

  const config: TenantProvisioning = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    currency: row.currency,
    language: row.language,
    timezone: row.timezone,
    primaryColor: row.primaryColor,
    logoUrl: row.logoUrl,
    description: row.description,
    themeId: row.themeId,
    planId: row.planId,
    domains: row.domains.map((domain) => domain.domain),
    rootDomain: getRootDomain(),
  };

  await provisionTenant(config);
  memorySet(key, config);
  return config;
}

/** Vide les caches d'un slug (après mutation d'une boutique). */
export function invalidateTenantResolveCache(slug: string): void {
  memory.delete(`slug:${slug}`);
}
