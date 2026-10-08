import { SubscriptionStatus, type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes de `/admin/subscriptions` (module 10).
 */

export const SUBSCRIPTIONS_PAGE_SIZE = 20;

export type SubscriptionStatusFilter = SubscriptionStatus | "ALL";

export type SubscriptionListFilters = {
  search?: string;
  status?: SubscriptionStatusFilter;
  plan?: string;
  page?: number;
};

export type SubscriptionListItem = {
  id: string;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  tenant: { id: string; name: string; slug: string; status: string };
  plan: { id: string; name: string; slug: string };
};

export type PaginatedSubscriptions = {
  items: SubscriptionListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type SubscriptionStats = {
  active: number;
  trial: number;
  pastDue: number;
  cancelled: number;
  /** Boutiques sans abonnement associé */
  withoutSubscription: number;
  total: number;
};

/** Liste paginée des abonnements. */
export async function getSubscriptions(
  filters: SubscriptionListFilters = {},
): Promise<PaginatedSubscriptions> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = SUBSCRIPTIONS_PAGE_SIZE;
  const search = filters.search?.trim();

  const where: Prisma.SubscriptionWhereInput = {
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status }
      : {}),
    ...(filters.plan && filters.plan !== "ALL"
      ? { planId: filters.plan }
      : {}),
    ...(search
      ? {
          OR: [
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { slug: { contains: search, mode: "insensitive" } } },
            { plan: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        startedAt: true,
        currentPeriodEnd: true,
        canceledAt: true,
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        plan: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const items: SubscriptionListItem[] = rows.map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    canceledAt: row.canceledAt?.toISOString() ?? null,
    tenant: row.tenant,
    plan: row.plan,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** KPIs de la page abonnements. */
export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  const [active, trial, pastDue, cancelled, total, subscribed, tenants] =
    await Promise.all([
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELLED },
      }),
      prisma.subscription.count(),
      prisma.tenant.count({ where: { planId: { not: null } } }),
      prisma.tenant.count({ where: { deletedAt: null } }),
    ]);

  return {
    active,
    trial,
    pastDue,
    cancelled,
    withoutSubscription: Math.max(0, tenants - subscribed),
    total,
  };
}

/** Boutiques actives sans abonnement (pour l’action « Attribuer »). */
export async function getTenantsWithoutSubscription(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const rows = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      subscription: null,
      status: { not: "ARCHIVED" },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
    take: 50,
  });
  return rows;
}

/** Plans avec nombre de boutiques rattachées (page `/admin/plans`). */
export type PlanWithUsage = {
  id: string;
  name: string;
  slug: string;
  /** Prix mensuel en centimes */
  price: number;
  currency: string;
  /** Features JSON (tableau de chaînes) */
  features: string[];
  tenantCount: number;
};

function parseFeatures(value: Prisma.JsonValue | null): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export async function getPlansWithUsage(): Promise<PlanWithUsage[]> {
  const rows = await prisma.plan.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      currency: true,
      features: true,
      _count: { select: { tenants: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    currency: row.currency,
    features: parseFeatures(row.features),
    tenantCount: row._count.tenants,
  }));
}
