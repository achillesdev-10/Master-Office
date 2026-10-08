import { Role, type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes de la liste `/admin/users` (module 9).
 */

/** Pagination serveur : 20 lignes par page. */
export const USERS_PAGE_SIZE = 20;

export const USER_SORT_FIELDS = ["email", "role", "createdAt"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

export type UserListFilters = {
  /** Recherche par email ou nom d'une boutique rattachée */
  search?: string;
  role?: Role | "ALL";
  /** Filtre par boutique rattachée (module 9) */
  tenant?: string;
  page?: number;
  sort?: UserSortField;
  dir?: SortDir;
};

export type UserListItem = {
  id: string;
  email: string;
  role: Role;
  /** Compte désactivé (module 9) */
  disabled: boolean;
  /** Compte Clerk provisoire (invitation pas encore acceptée) */
  pending: boolean;
  /** Nombre de boutiques auxquelles l'utilisateur est rattaché */
  tenantCount: number;
  /** Premieres boutiques (affichage tronqué) */
  tenants: string[];
  createdAt: string;
};

export type PaginatedUsers = {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function buildOrderBy(
  field: UserSortField,
  dir: SortDir,
): Prisma.UserOrderByWithRelationInput {
  switch (field) {
    case "email":
      return { email: dir };
    case "role":
      return { role: dir };
    default:
      return { createdAt: dir };
  }
}

/** Liste paginée des comptes de la plateforme. */
export async function getUsers(
  filters: UserListFilters = {},
): Promise<PaginatedUsers> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = USERS_PAGE_SIZE;
  const search = filters.search?.trim();

  const where: Prisma.UserWhereInput = {
    ...(filters.role && filters.role !== "ALL" ? { role: filters.role } : {}),
    ...(filters.tenant
      ? { tenantUsers: { some: { tenantId: filters.tenant } } }
      : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            {
              tenantUsers: {
                some: {
                  tenant: {
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      { slug: { contains: search, mode: "insensitive" } },
                    ],
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
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        clerkId: true,
        role: true,
        disabled: true,
        createdAt: true,
        _count: { select: { tenantUsers: true } },
        tenantUsers: {
          take: 3,
          orderBy: { createdAt: "asc" },
          select: { tenant: { select: { name: true } } },
        },
      },
    }),
  ]);

  const items: UserListItem[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    disabled: row.disabled,
    pending: row.clerkId.startsWith("pending_"),
    tenantCount: row._count.tenantUsers,
    tenants: row.tenantUsers.map((link) => link.tenant.name),
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

/** Compteurs par rôle (en-tête de la page). */
export async function getUserRoleCounts(): Promise<Record<Role, number>> {
  const [superAdmin, admin, member] = await Promise.all([
    prisma.user.count({ where: { role: Role.SUPER_ADMIN } }),
    prisma.user.count({ where: { role: Role.ADMIN } }),
    prisma.user.count({ where: { role: Role.MEMBER } }),
  ]);
  return { SUPER_ADMIN: superAdmin, ADMIN: admin, MEMBER: member };
}

/** Boutiques non archivées (filtre de la liste des utilisateurs). */
export async function getTenantFilterOptions(): Promise<
  { id: string; name: string }[]
> {
  return prisma.tenant.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 100,
  });
}

export type UserTenantLink = {
  tenantId: string;
  role: Role;
  tenant: { id: string; name: string; slug: string; status: string };
};

export type UserAuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  entity: string | null;
  metadata: Prisma.JsonValue | null;
};

export type UserDetail = {
  id: string;
  email: string;
  clerkId: string;
  role: Role;
  disabled: boolean;
  pending: boolean;
  createdAt: string;
  tenants: UserTenantLink[];
  auditLogs: UserAuditEntry[];
  auditTotal: number;
};

/** Fiche `/admin/users/[id]` : compte + boutiques + journal (module 9). */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      clerkId: true,
      role: true,
      disabled: true,
      createdAt: true,
      tenantUsers: {
        orderBy: { createdAt: "asc" },
        select: {
          tenantId: true,
          role: true,
          tenant: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
      },
      _count: { select: { auditLogs: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          createdAt: true,
          entity: true,
          metadata: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    clerkId: user.clerkId,
    role: user.role,
    disabled: user.disabled,
    pending: user.clerkId.startsWith("pending_"),
    createdAt: user.createdAt.toISOString(),
    tenants: user.tenantUsers,
    auditLogs: user.auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      entity: log.entity,
      metadata: log.metadata,
    })),
    auditTotal: user._count.auditLogs,
  };
}
