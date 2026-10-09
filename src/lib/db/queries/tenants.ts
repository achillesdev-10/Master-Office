import { TenantStatus, type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes Prisma de la liste des boutiques (module 5)
 * et support du wizard de création (module 6).
 */

/** Pagination serveur : 20 lignes par page (contrainte du module 5). */
export const TENANTS_PAGE_SIZE = 20;

export const TENANT_SORT_FIELDS = ["name", "slug", "status", "createdAt"] as const;
export type TenantSortField = (typeof TENANT_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

export type TenantStatusFilter = TenantStatus | "ALL";

export type TenantListFilters = {
  /** Recherche libre : nom, slug, email du propriétaire */
  search?: string;
  status?: TenantStatusFilter;
  page?: number;
  sort?: TenantSortField;
  dir?: SortDir;
};

export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  /** Domaine auto `${slug}.maboutique.com` ou premier domaine custom */
  primaryDomain: string;
  /** Date de création au format ISO 8601 */
  createdAt: string;
};

export type PaginatedTenants = {
  items: TenantListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function buildOrderBy(
  field: TenantSortField,
  dir: SortDir,
): Prisma.TenantOrderByWithRelationInput {
  switch (field) {
    case "name":
      return { name: dir };
    case "slug":
      return { slug: dir };
    case "status":
      return { status: dir };
    default:
      return { createdAt: dir };
  }
}

/**
 * Liste paginée des boutiques (hors supprimées logiquement),
 * filtrable par recherche et statut.
 */
export async function getTenants(
  filters: TenantListFilters = {},
): Promise<PaginatedTenants> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = TENANTS_PAGE_SIZE;
  const search = filters.search?.trim();

  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { contactEmail: { contains: search, mode: "insensitive" } },
            {
              users: {
                some: {
                  user: {
                    email: { contains: search, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(filters.sort ?? "createdAt", filters.dir ?? "desc");

  const [total, rows] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        domains: {
          orderBy: { createdAt: "asc" },
          select: { domain: true },
        },
      },
    }),
  ]);

  const items: TenantListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    primaryDomain:
      row.domains[0]?.domain ?? `${row.slug}.${getRootDomain()}`,
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

/** Lookup de slug (utilisé par la vérification d'unicité en temps réel). */
export async function findTenantBySlug(slug: string): Promise<{
  id: string;
} | null> {
  return prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
}

/** Détail d'une boutique (module 6 → page de redirection, module 7 → onglets). */
export type TenantDetails = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  description: string | null;
  currency: string;
  language: string;
  timezone: string;
  primaryColor: string | null;
  logoUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactCountry: string | null;
  createdAt: string;
  updatedAt: string;
  theme: { id: string; name: string; slug: string } | null;
  domains: { id: string; domain: string; sslStatus: string }[];
};

export async function getTenantById(id: string): Promise<TenantDetails | null> {
  const row = await prisma.tenant.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      description: true,
      currency: true,
      language: true,
      timezone: true,
      primaryColor: true,
      logoUrl: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      contactCountry: true,
      createdAt: true,
      updatedAt: true,
      theme: { select: { id: true, name: true, slug: true } },
      domains: {
        orderBy: { createdAt: "asc" },
        select: { id: true, domain: true, sslStatus: true },
      },
    },
  });

  if (!row) return null;

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Thèmes disponibles (étape 4 du wizard + onglet Thème de la fiche). */
export type ThemeOption = {
  id: string;
  name: string;
  slug: string;
  previewUrl: string | null;
  isPremium: boolean;
};

export async function getThemeOptions(): Promise<ThemeOption[]> {
  return prisma.theme.findMany({
    orderBy: [{ isPremium: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      previewUrl: true,
      isPremium: true,
    },
  });
}

/** Domaine racine de la plateforme (`maboutique.com` par défaut). */
export function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
}