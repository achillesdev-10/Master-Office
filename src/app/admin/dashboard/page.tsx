import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Globe,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getDashboardAlerts,
  getGlobalStats,
  getRecentTenants,
  getTenantsGrowth,
  getTotalTenants,
  getTenantStatusCounts,
} from "@/lib/db/queries/dashboard";
import { formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, KpiCardSkeleton } from "@/components/admin/kpi-card";
import { TenantsGrowthChart } from "@/components/admin/tenants-growth-chart";

/**
 * /admin/dashboard — KPIs réels (Prisma) + graphique de croissance.
 *
 * Les sections lentes sont isolées derrière <Suspense> : la page s'affiche
 * immédiatement avec des skeletons, chaque bloc se remplit dès que ses
 * requêtes (mises en cache 60 s via `unstable_cache`) résolvent.
 */

const KPI_SKELETON_KEYS = [0, 1, 2, 3];
const LIST_SKELETON_KEYS = [0, 1, 2, 3, 4];

type TenantStatusStyle = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

const STATUS_LABELS: Record<TenantStatusStyle, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  SUSPENDED: "Suspendue",
  ARCHIVED: "Archivée",
};

const STATUS_STYLES: Record<TenantStatusStyle, string> = {
  DRAFT:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400",
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
  SUSPENDED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400",
  ARCHIVED:
    "border-border bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: TenantStatusStyle }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Carte-conteneur commune à chaque section du dashboard. */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

// ======================== SECTIONS ===============================

async function KpiSection() {
  const [total, statusCounts] = await Promise.all([
    getTotalTenants(),
    getTenantStatusCounts(),
  ]);

  const activeShare =
    total.total > 0
      ? `${formatNumber(Math.round((statusCounts.active / total.total) * 100))} % du parc`
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Boutiques totales"
        value={formatNumber(total.total)}
        icon={Store}
        variation={{ delta: total.delta, percent: total.percent }}
      />
      <KpiCard
        title="Boutiques actives"
        value={formatNumber(statusCounts.active)}
        icon={CheckCircle2}
        hint={activeShare}
      />
      <KpiCard
        title="Boutiques en préparation"
        value={formatNumber(statusCounts.draft)}
        icon={ShoppingBag}
      />
      <KpiCard
        title="Boutiques avec problème"
        value={formatNumber(statusCounts.withIssues)}
        icon={AlertTriangle}
        hint={statusCounts.suspended > 0 ? `${statusCounts.suspended} suspendue(s)` : undefined}
      />
    </div>
  );
}

async function SecondaryKpiSection() {
  const globalStats = await getGlobalStats();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Domaines gérés"
        value={formatNumber(globalStats.totalDomains)}
        icon={Globe}
        hint={
          globalStats.domainsExpiring7Days > 0
            ? `${globalStats.domainsExpiring7Days} expirent sous 7j`
            : globalStats.domainsExpiring30Days > 0
            ? `${globalStats.domainsExpiring30Days} expirent sous 30j`
            : undefined
        }
      />
      <KpiCard
        title="Commandes du mois"
        value={formatNumber(0)}
        icon={ShoppingBag}
        hint="Module commandes non disponible"
      />
      <KpiCard
        title="Activité récente (30j)"
        value={formatNumber(globalStats.recentActivityCount)}
        icon={Users}
      />
      <KpiCard
        title="Santé globale"
        value={
          globalStats.tenantsWithIssues === 0
            ? "OK"
            : `${globalStats.tenantsWithIssues} à surveiller`
        }
        icon={globalStats.tenantsWithIssues === 0 ? CheckCircle2 : AlertTriangle}
        hint={
          globalStats.tenantsWithIssues > 0
            ? "Voir alertes ci-dessous"
            : "Tout est opérationnel"
        }
      />
    </div>
  );
}

async function GrowthSection() {
  const growth = await getTenantsGrowth(12);

  return (
    <Panel
      title="Croissance des boutiques"
      description="Nouvelles boutiques créées — 12 derniers mois"
    >
      <TenantsGrowthChart data={growth} />
    </Panel>
  );
}

async function RecentTenantsSection() {
  const tenants = await getRecentTenants(5);

  if (tenants.length === 0) {
    return (
      <Panel title="Dernières boutiques créées">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune boutique pour le moment.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Dernières boutiques créées"
      description="Les 5 dernières boutiques enregistrées"
    >
      <ul className="divide-y">
        {tenants.map((tenant) => (
          <li key={tenant.id}>
            <Link
              href={`/admin/tenants/${tenant.id}`}
              className="flex items-center gap-3 rounded-md px-1 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tenant.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  /{tenant.slug}
                </p>
              </div>
              <StatusBadge status={tenant.status} />
              <time
                dateTime={tenant.createdAt}
                className="hidden shrink-0 text-xs text-muted-foreground sm:block"
              >
                {format(new Date(tenant.createdAt), "d MMM yyyy", {
                  locale: fr,
                })}
              </time>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type AlertItem = {
  id: string;
  icon: LucideIcon;
  message: string;
  href: string;
  linkLabel: string;
};

async function AlertsSection() {
  const alerts = await getDashboardAlerts();

  const items: AlertItem[] = [];
  if (alerts.suspendedTenants > 0) {
    items.push({
      id: "suspended",
      icon: AlertTriangle,
      message: `${formatNumber(alerts.suspendedTenants)} boutique(s) suspendue(s) — accès et paiements bloqués.`,
      href: "/admin/tenants?status=SUSPENDED",
      linkLabel: "Voir les boutiques",
    });
  }
  if (alerts.unverifiedDomains > 0) {
    items.push({
      id: "domains",
      icon: Globe,
      message: `${formatNumber(alerts.unverifiedDomains)} domaine(s) sans certificat SSL actif.`,
      href: "/admin/domains?ssl=PENDING",
      linkLabel: "Vérifier les domaines",
    });
  }
  if (alerts.domainsExpiringSoon > 0) {
    items.push({
      id: "domains-expiring",
      icon: AlertTriangle,
      message: `${formatNumber(alerts.domainsExpiringSoon)} domaine(s) expirant dans les 30 prochains jours.`,
      href: "/admin/domains?expiring=30",
      linkLabel: "Voir les expirations",
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">Aucune alerte</p>
          <p className="text-xs opacity-80">
            Aucune boutique suspendue, tous les domaines sont vérifiés et aucune expiration proche.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <div className="flex items-start gap-3">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm">{item.message}</p>
            </div>
            <Link
              href={item.href}
              className="shrink-0 text-sm font-medium underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.linkLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

// ======================== SKELETONS ==============================

function KpiGridFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_SKELETON_KEYS.map((key) => (
        <KpiCardSkeleton key={key} />
      ))}
    </div>
  );
}

function PanelFallback({ title }: { title: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-semibold tracking-tight">{title}</h2>
      <Skeleton className="h-72 w-full rounded-lg sm:h-80" />
    </div>
  );
}

function ListFallback() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="space-y-3">
        {LIST_SKELETON_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsFallback() {
  return <Skeleton className="h-[72px] w-full rounded-xl" />;
}

// ======================== PAGE ===================================

export default function DashboardPage() {
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm capitalize text-muted-foreground">
          Centre de contrôle du réseau de boutiques · {today}
        </p>
      </header>

      <Suspense fallback={<KpiGridFallback />}>
        <KpiSection />
      </Suspense>

      <Suspense fallback={<KpiGridFallback />}>
        <SecondaryKpiSection />
      </Suspense>

      <Suspense fallback={<PanelFallback title="Croissance des boutiques" />}>
        <GrowthSection />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ListFallback />}>
            <RecentTenantsSection />
          </Suspense>
        </div>
        <Panel
          title="Alertes"
          description="Boutiques suspendues, domaines non vérifiés, expirations proches"
        >
          <Suspense fallback={<AlertsFallback />}>
            <AlertsSection />
          </Suspense>
        </Panel>
      </div>
    </div>
  );
}