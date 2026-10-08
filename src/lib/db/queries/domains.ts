import { SslStatus, type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes de la liste `/admin/domains` et de sa page de détail
 * (module 8).
 */

/** Pagination serveur : 20 lignes par page. */
export const DOMAINS_PAGE_SIZE = 20;

export type DomainSslFilter = SslStatus | "ALL";
export type DomainVerifiedFilter = "ALL" | "yes" | "no";

export type DomainListFilters = {
  search?: string;
  ssl?: DomainSslFilter;
  verified?: DomainVerifiedFilter;
  page?: number;
};

export type DomainListItem = {
  id: string;
  domain: string;
  type: "SUBDOMAIN" | "CUSTOM";
  sslStatus: SslStatus;
  verified: boolean;
  verifiedAt: string | null;
  checkedAt: string | null;
  tenant: { id: string; name: string };
  createdAt: string;
};

export type PaginatedDomains = {
  items: DomainListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function classify(domain: string, rootDomain: string): "SUBDOMAIN" | "CUSTOM" {
  return domain.toLowerCase().endsWith(`.${rootDomain.toLowerCase()}`)
    ? "SUBDOMAIN"
    : "CUSTOM";
}

/** Liste paginée des domaines (recherche, filtres SSL / vérification). */
export async function getDomains(
  filters: DomainListFilters = {},
): Promise<PaginatedDomains> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = DOMAINS_PAGE_SIZE;
  const search = filters.search?.trim();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";

  const where: Prisma.TenantDomainWhereInput = {
    ...(filters.ssl && filters.ssl !== "ALL" ? { sslStatus: filters.ssl } : {}),
    ...(filters.verified === "yes"
      ? { verified: true }
      : filters.verified === "no"
        ? { verified: false }
        : {}),
    ...(search
      ? {
          OR: [
            { domain: { contains: search, mode: "insensitive" } },
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { slug: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.tenantDomain.count({ where }),
    prisma.tenantDomain.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        domain: true,
        sslStatus: true,
        verified: true,
        verifiedAt: true,
        checkedAt: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
    }),
  ]);

  const items: DomainListItem[] = rows.map((row) => ({
    id: row.id,
    domain: row.domain,
    type: classify(row.domain, rootDomain),
    sslStatus: row.sslStatus,
    verified: row.verified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    tenant: row.tenant,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Détail d'un domaine (page `/admin/domains/[id]`). */
export type DomainDetails = DomainListItem & {
  tenant: { id: string; name: string; slug: string; status: string };
};

export async function getDomainById(id: string): Promise<DomainDetails | null> {
  const row = await prisma.tenantDomain.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      sslStatus: true,
      verified: true,
      verifiedAt: true,
      checkedAt: true,
      createdAt: true,
      tenant: { select: { id: true, name: true, slug: true, status: true } },
    },
  });

  if (!row) return null;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
  return {
    id: row.id,
    domain: row.domain,
    type: classify(row.domain, rootDomain),
    sslStatus: row.sslStatus,
    verified: row.verified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    tenant: row.tenant,
  };
}

// ======================== HISTORIQUE =============================

export type DomainHistoryAction =
  | "domain.add"
  | "domain.verify"
  | "domain.ssl"
  | "domain.remove";

export type DomainHistoryItem = {
  id: string;
  action: DomainHistoryAction;
  /** Résultat lisible ("ok", "echec", …) */
  result: string | null;
  /** Enregistrements CNAME retournés lors d'une vérification */
  records: string[];
  user: string | null;
  createdAt: string;
};

const HISTORY_ACTIONS: DomainHistoryAction[] = [
  "domain.add",
  "domain.verify",
  "domain.ssl",
  "domain.remove",
];

/**
 * Historique des vérifications / demandes SSL d'un domaine,
 * reconstitué depuis le journal d'audit (`AuditLog.metadata.domainId`).
 */
export async function getDomainHistory(
  domainId: string,
  tenantId: string,
): Promise<DomainHistoryItem[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: { in: HISTORY_ACTIONS },
      metadata: { path: ["domainId"], equals: domainId },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  return rows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};

    return {
      id: row.id,
      action: row.action as DomainHistoryAction,
      result: typeof meta["result"] === "string" ? meta["result"] : null,
      records: Array.isArray(meta["records"])
        ? meta["records"].filter((value): value is string => typeof value === "string")
        : [],
      user: row.user?.email ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
