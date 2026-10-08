import { type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes du module 12 (journal d’activité).
 */

export const AUDIT_PAGE_SIZE = 20;

/** Garde-fou de l’export CSV. */
export const AUDIT_EXPORT_LIMIT = 5000;

export type AuditFilters = {
  action?: string;
  email?: string;
  /** Entité touchée (Tenant, User, Plan…) */
  entity?: string;
  /** Boutique concernée */
  tenantId?: string;
  from?: string;
  to?: string;
  page?: number;
};

export type AuditLogListItem = {
  id: string;
  action: string;
  createdAt: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  metadata: Prisma.JsonValue | null;
  user: { id: string; email: string; role: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
};

export type PaginatedAuditLogs = {
  items: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Filtres date validés (borne haute inclusive sur la journée). */
function dateBound(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const date = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const gte = dateBound(filters.from, false);
  const lte = dateBound(filters.to, true);

  return {
    ...(filters.action
      ? { action: { contains: filters.action, mode: "insensitive" } }
      : {}),
    ...(filters.entity
      ? { entity: { equals: filters.entity, mode: "insensitive" } }
      : {}),
    ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    ...(filters.email
      ? { user: { email: { contains: filters.email, mode: "insensitive" } } }
      : {}),
    ...(gte || lte
      ? {
          createdAt: {
            ...(gte ? { gte } : {}),
            ...(lte ? { lte } : {}),
          },
        }
      : {}),
  };
}

const LOG_SELECT = {
  id: true,
  action: true,
  createdAt: true,
  entity: true,
  entityId: true,
  ip: true,
  metadata: true,
  user: { select: { id: true, email: true, role: true } },
  tenant: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.AuditLogSelect;

function toListItem(
  row: Prisma.AuditLogGetPayload<{ select: typeof LOG_SELECT }>,
): AuditLogListItem {
  // Compat : les entrées antérieures au module 12 stockaient l'IP dans metadata
  const metadataIp =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? ((row.metadata as Record<string, unknown>).ip as string | undefined)
      : undefined;

  return {
    id: row.id,
    action: row.action,
    createdAt: row.createdAt.toISOString(),
    entity: row.entity,
    entityId: row.entityId,
    ip: row.ip ?? metadataIp ?? null,
    metadata: row.metadata,
    user: row.user,
    tenant: row.tenant,
  };
}

/** Journal paginé. */
export async function getAuditLogs(
  filters: AuditFilters = {},
): Promise<PaginatedAuditLogs> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = AUDIT_PAGE_SIZE;
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: LOG_SELECT,
    }),
  ]);

  return {
    items: rows.map(toListItem),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Actions déjà journalisées (alimente le sélecteur de filtre). */
export async function getAuditActions(): Promise<string[]> {
  const grouped = await prisma.auditLog.groupBy({
    by: ["action"],
    _count: { _all: true },
    orderBy: { _count: { action: "desc" } },
    take: 60,
  });
  return grouped.map((row) => row.action);
}

/** Entités déjà journalisées (alimente le sélecteur de filtre). */
export async function getAuditEntities(): Promise<string[]> {
  const grouped = await prisma.auditLog.groupBy({
    by: ["entity"],
    _count: { _all: true },
    where: { entity: { not: null } },
    orderBy: { _count: { entity: "desc" } },
    take: 30,
  });
  return grouped
    .map((row) => row.entity)
    .filter((entity): entity is string => entity !== null);
}

/** Lignes pour l’export CSV (bornées par `AUDIT_EXPORT_LIMIT`). */
export async function getAuditLogRowsForExport(
  filters: AuditFilters = {},
): Promise<AuditLogListItem[]> {
  const rows = await prisma.auditLog.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: "desc" },
    take: AUDIT_EXPORT_LIMIT,
    select: LOG_SELECT,
  });
  return rows.map(toListItem);
}
