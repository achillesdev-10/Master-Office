/**
 * Rate limiting avec Upstash REST (sans nouvelle dépendance).
 * INCR + EXPIRE à la première incrémentation.
 * Laisse passer la requête si Redis est indisponible (fail-open).
 */

const RATE_LIMIT_PREFIX = "ratelimit:";

function getRestEndpoint(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/**
 * Vérifie et incrémente un compteur de rate-limit.
 * @param key Clé unique (ex: "order:tenantId:ip")
 * @param limit Nombre max de requêtes
 * @param windowMs Fenêtre de temps en millisecondes
 * @returns { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const rest = getRestEndpoint();
  if (!rest) {
    // Fail-open: si Redis n'est pas configuré, on autorise
    return { allowed: true, remaining: limit };
  }

  const fullKey = `${RATE_LIMIT_PREFIX}${key}`;
  const windowSec = Math.ceil(windowMs / 1000);

  try {
    // INCR + EXPIRE (seulement à la première incrémentation)
    const response = await fetch(`${rest.url}/incr/${encodeURIComponent(fullKey)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rest.token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[rate-limit] INCR failed:", response.status);
      return { allowed: true, remaining: limit };
    }

    const data = (await response.json()) as { result: number };
    const current = data.result;

    // Si c'est la première incrémentation, on pose l'expiration
    if (current === 1) {
      await fetch(`${rest.url}/expire/${encodeURIComponent(fullKey)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rest.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ex: windowSec }),
        cache: "no-store",
      });
    }

    const remaining = Math.max(0, limit - current);
    return { allowed: current <= limit, remaining };
  } catch (error) {
    console.error("[rate-limit] error:", error);
    // Fail-open: en cas d'erreur Redis, on autorise
    return { allowed: true, remaining: limit };
  }
}

/**
 * Génère une clé de rate-limit pour les commandes.
 * Combine IP (premier élément de x-forwarded-for) + tenantId.
 */
export function getOrderRateLimitKey(tenantId: string, forwardedFor: string | null): string {
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  return `order:${tenantId}:${ip}`;
}