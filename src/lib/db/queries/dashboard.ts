import { unstable_cache } from "next/cache";
import { SslStatus, TenantStatus } from "@prisma/client";
import { format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes Prisma du dashboard (/admin/dashboard).
 *
 * Toutes les fonctions passent par `unstable_cache` avec une révalidation
 * de 60 s : les rendus successifs ne rejouent pas les requêtes SQL.
 * Les résultats ne contiennent que des types JSON-sérialisables
 * (les dates sont retournées en ISO 8601) car le cache sérialise en JSON.
 */

/** Durée de révalidation (secondes) de toutes les requêtes du dashboard. */
export const DASHBOARD_REVALIDATE = 60;

const CACHE_OPTIONS: { revalidate: number; tags: string[] } = {
  revalidate: DASHBOARD_REVALIDATE,
  tags: ["dashboard"],
};

// ======================== TYPES ==================================

export type TotalTenants = {
  /** Total toutes périodes confondues */
  total: number;
  /** Boutiques créées depuis le 1er du mois courant */
  createdThisMonth: number;
  /** Boutiques créées pendant le mois précédent */
  createdLastMonth: number;
  /** Différence (mois courant − mois précédent) */
  delta: number;
  /** Écart en % ; null si le mois précédent était à 0 */
  percent: number | null;
};

export type TenantStatusCounts = {
  active: number;
  draft: number;
  suspended: number;
  archived: number;
  /** Boutiques avec un problème (suspendues ou domaine SSL failed) */
  withIssues: number;
};

export type RecentTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  /** Date de création au format ISO 8601 */
  createdAt: string;
};

export type GrowthPoint = {
  /** Clé du mois : "2025-01" */
  month: string;
  /** Libellé court de l'axe X : "janv. 25" */
  label: string;
  /** Boutiques créées pendant le mois */
  created: number;
  /** Total cumulé en fin de mois */
  total: number;
};

export type DashboardAlerts = {
  /** Boutiques au statut SUSPENDED */
  suspendedTenants: number;
  /** Domaines dont le SSL n'est pas ACTIVE (PENDING ou FAILED) */
  unverifiedDomains: number;
  /** Domaines expirant dans les 30 jours */
  domainsExpiringSoon: number;
};

export type GlobalStats = {
  totalTenants: number;
  activeTenants: number;
  tenantsWithIssues: number;
  totalDomains: number;
  domainsExpiring30Days: number;
  domainsExpiring7Days: number;
  recentActivityCount: number;
};

// ======================== KPIs ===================================

/**
 * Nombre total de boutiques + variation créations vs mois précédent.
 */
export const getTotalTenants = unstable_cache(
  async (): Promise<TotalTenants> => {
    const now = new Date();
    const startThisMonth = startOfMonth(now);
    const startLastMonth = startOfMonth(subMonths(now, 1));

    const [total, createdThisMonth, createdLastMonth] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({
        where: { deletedAt: null, createdAt: { gte: startThisMonth } },
      }),
      prisma.tenant.count({
        where: {
          deletedAt: null,
          createdAt: { gte: startLastMonth, lt: startThisMonth },
        },
      }),
    ]);

    const delta = createdThisMonth - createdLastMonth;
    const percent =
      createdLastMonth === 0 ? null : (delta / createdLastMonth) * 100;

    return { total, createdThisMonth, createdLastMonth, delta, percent };
  },
  ["dashboard-total-tenants"],
  CACHE_OPTIONS,
);

/**
 * Répartition des boutiques par statut.
 */
export const getTenantStatusCounts = unstable_cache(
  async (): Promise<TenantStatusCounts> => {
    const [active, draft, suspended, archived] = await Promise.all([
      prisma.tenant.count({
        where: { status: TenantStatus.ACTIVE, deletedAt: null },
      }),
      prisma.tenant.count({
        where: { status: TenantStatus.DRAFT, deletedAt: null },
      }),
      prisma.tenant.count({
        where: { status: TenantStatus.SUSPENDED, deletedAt: null },
      }),
      prisma.tenant.count({
        where: { status: TenantStatus.ARCHIVED, deletedAt: null },
      }),
    ]);

    // Boutiques avec problème : suspendues + domaines SSL failed
    const sslFailedTenantIds = await prisma.tenantDomain.findMany({
      where: { sslStatus: SslStatus.FAILED },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });
    const sslFailedCount = sslFailedTenantIds.length;

    const withIssues = suspended + sslFailedCount;

    return { active, draft, suspended, archived, withIssues };
  },
  ["dashboard-tenant-status-counts"],
  CACHE_OPTIONS,
);

/**
 * Commandes du mois courant.
 * Non disponible tant que le modèle Order n'existe pas.
 */
export const getOrdersThisMonth = unstable_cache(
  async (): Promise<{ count: number; available: boolean }> => {
    // TODO(module commandes) : brancher sur le modèle Order quand il existera.
    return { count: 0, available: false };
  },
  ["dashboard-orders-this-month"],
  CACHE_OPTIONS,
);

/**
 * Statistiques globales pour le dashboard.
 */
export const getGlobalStats = unstable_cache(
  async (): Promise<GlobalStats> => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalDomains,
      domainsExpiring30Days,
      domainsExpiring7Days,
      recentActivityCount,
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({
        where: { status: TenantStatus.ACTIVE, deletedAt: null },
      }),
      prisma.tenant.count({
        where: { status: TenantStatus.SUSPENDED, deletedAt: null },
      }),
      prisma.tenantDomain.count(),
      prisma.tenantDomain.count({
        where: {
          expiresAt: { not: null, lte: in30Days, gte: now },
        },
      }),
      prisma.tenantDomain.count({
        where: {
          expiresAt: { not: null, lte: in7Days, gte: now },
        },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: startOfMonth(now) },
        },
      }),
    ]);

    const sslFailedTenantIds = await prisma.tenantDomain.findMany({
      where: { sslStatus: SslStatus.FAILED },
      select: { tenantId: true },
      distinct: ["tenantId"],
    });
    const sslFailedCount = sslFailedTenantIds.length;

    return {
      totalTenants,
      activeTenants,
      tenantsWithIssues: suspendedTenants + sslFailedCount,
      totalDomains,
      domainsExpiring30Days,
      domainsExpiring7Days,
      recentActivityCount,
    };
  },
  ["dashboard-global-stats"],
  CACHE_OPTIONS,
);

// ======================== LISTES =================================

/**
 * `limit` dernières boutiques créées, de la plus récente à la plus ancienne.
 */
export const getRecentTenants = unstable_cache(
  async (limit: number): Promise<RecentTenant[]> => {
    const rows = await prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, limit),
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  },
  ["dashboard-recent-tenants"],
  CACHE_OPTIONS,
);

// ======================== GRAPHIQUE ==============================

/**
 * Série des `months` derniers mois (12 par défaut) pour le graphique
 * de croissance : créations mensuelles + total cumulé.
 */
export const getTenantsGrowth = unstable_cache(
  async (months: number): Promise<GrowthPoint[]> => {
    const size = Math.max(1, months);
    const now = new Date();
    const windowStart = startOfMonth(subMonths(now, size - 1));

    const buckets: { month: string; label: string }[] = [];
    for (let i = size - 1; i >= 0; i--) {
      const start = startOfMonth(subMonths(now, i));
      buckets.push({
        month: format(start, "yyyy-MM"),
        label: format(start, "MMM yy", { locale: fr }),
      });
    }

    const [rows, createdBeforeWindow] = await Promise.all([
      prisma.tenant.findMany({
        where: { deletedAt: null, createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.tenant.count({
        where: { deletedAt: null, createdAt: { lt: windowStart } },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = format(row.createdAt, "yyyy-MM");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let cumulative = createdBeforeWindow;
    return buckets.map((bucket) => {
      const created = counts.get(bucket.month) ?? 0;
      cumulative += created;
      return {
        month: bucket.month,
        label: bucket.label,
        created,
        total: cumulative,
      };
    });
  },
  ["dashboard-tenants-growth"],
  CACHE_OPTIONS,
);

// ======================== ALERTES ================================

/**
 * Compteurs du bandeau d'alertes : boutiques suspendues
 * et domaines dont le certificat SSL n'est pas actif.
 */
export const getDashboardAlerts = unstable_cache(
  async (): Promise<DashboardAlerts> => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [suspendedTenants, unverifiedDomains, domainsExpiringSoon] =
      await Promise.all([
        prisma.tenant.count({
          where: { status: TenantStatus.SUSPENDED, deletedAt: null },
        }),
        prisma.tenantDomain.count({
          where: { sslStatus: { not: SslStatus.ACTIVE } },
        }),
        prisma.tenantDomain.count({
          where: {
            expiresAt: { not: null, lte: in30Days, gte: now },
          },
        }),
      ]);

    return { suspendedTenants, unverifiedDomains, domainsExpiringSoon };
  },
  ["dashboard-alerts"],
  CACHE_OPTIONS,
);