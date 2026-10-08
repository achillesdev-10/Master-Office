import { z } from "zod";

/**
 * Validateurs des domaines (module 8 + onglet Domaines du module 7).
 */

/**
 * Nom de domaine DNS valide : sous-domaines acceptés,
 * ex. `shop.acme.com`, `acme.fr`.
 */
export const DOMAIN_REGEX =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Ajout d'un domaine custom à une boutique. */
export const addDomainSchema = z.object({
  tenantId: z.string().cuid("Boutique invalide"),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "4 caractères minimum")
    .max(253, "253 caractères maximum")
    .regex(DOMAIN_REGEX, "Nom de domaine invalide (ex : shop.acme.com)"),
});

/** Filtres de la liste `/admin/domains` (module 8). */
export const DOMAIN_SSL_FILTERS = ["ALL", "PENDING", "ACTIVE", "FAILED"] as const;
export const DOMAIN_VERIFIED_FILTERS = ["ALL", "yes", "no"] as const;

/** Cible CNAME attendue (Vercel) — configurable via variable d'env. */
export function getSslTarget(): string {
  return process.env.VERCEL_CNAME_TARGET ?? "cname.vercel-dns.com";
}

/** Le domaine est-il un sous-domaine de la plateforme ? */
export function isSubdomain(domain: string, rootDomain: string): boolean {
  return domain.toLowerCase().endsWith(`.${rootDomain.toLowerCase()}`);
}

/** Slug de domaine → format URL (`shop.acme.com`). */
export function domainUrl(domain: string): string {
  return `https://${domain}`;
}
