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
};

/**
 * Prix mensuel (EUR) par plan — TODO : lire `Plan.price` dès que le champ
 * existe dans le schéma. Un plan inconnu compte pour 0.
 */
const PLAN_MONTHLY_PRICE_EUR: Record<string, number> = {
  starter: 29,
  pro: 79,
  business: 199,
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
 * Nombre de boutiques au statut ACTIVE.
 */
export const getActiveTenants = unstable_cache(
  async (): Promise<number> =>
    prisma.tenant.count({
      where: { status: TenantStatus.ACTIVE, deletedAt: null },
    }),
  ["dashboard-active-tenants"],
  CACHE_OPTIONS,
);

/**
 * Commandes du mois courant.
 * TODO(module commandes) : brancher sur le modèle Order quand il existera.
 */
export const getOrdersThisMonth = unstable_cache(
  async (): Promise<number> => 0,
  ["dashboard-orders-this-month"],
  CACHE_OPTIONS,
);

/**
 * Revenu mensuel récurrent : somme (prix du plan × boutiques actives).
 * TODO : remplacer la table de prix locale par le champ `Plan.price`.
 */
export const getMonthlyRecurringRevenue = unstable_cache(
  async (): Promise<number> => {
    const plans = await prisma.plan.findMany({
      select: {
        slug: true,
        _count: {
          select: {
            tenants: { where: { status: TenantStatus.ACTIVE } },
          },
        },
      },
    });

    return plans.reduce(
      (sum, plan) =>
        sum + (PLAN_MONTHLY_PRICE_EUR[plan.slug] ?? 0) * plan._count.tenants,
      0,
    );
  },
  ["dashboard-mrr"],
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
    const [suspendedTenants, unverifiedDomains] = await Promise.all([
      prisma.tenant.count({
        where: { status: TenantStatus.SUSPENDED, deletedAt: null },
      }),
      prisma.tenantDomain.count({
        where: { sslStatus: { not: SslStatus.ACTIVE } },
      }),
    ]);

    return { suspendedTenants, unverifiedDomains };
  },
  ["dashboard-alerts"],
  CACHE_OPTIONS,
);
