import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import {
  getPlansWithUsage,
  getSubscriptionStats,
  getSubscriptions,
  getTenantsWithoutSubscription,
  type SubscriptionStatusFilter,
} from "@/lib/db/queries/subscriptions";
import { getPlanOptions } from "@/lib/db/queries/tenants";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubscriptionsToolbar } from "@/components/admin/subscriptions-toolbar";
import { AssignPlanForm } from "@/components/admin/assign-plan-form";
import { PlansCard } from "@/components/admin/plans-card";
import {
  SubscriptionRowActions,
  SubscriptionStatusBadge,
} from "@/components/admin/subscription-row-actions";

/**
 * `/admin/subscriptions` — abonnements & plans (module 10).
 *
 * Server Component : KPIs, filtres, table et pagination côté serveur ;
 * les actions de ligne et les formulaires sont des Client Components.
 */

export const metadata = { title: "Abonnements" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | undefined): SubscriptionStatusFilter {
  const allowed = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"];
  if (value && allowed.includes(value)) {
    return value as NonNullable<SubscriptionStatusFilter>;
  }
  return "ALL";
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "destructive" | "secondary";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {formatNumber(value)}
      </p>
      {tone && (
        <span className="mt-2 inline-block">
          <Badge variant={tone}>{tone === "success" ? "OK" : "À suivre"}</Badge>
        </span>
      )}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;
  const href = (target: number) => `/admin/subscriptions?page=${target}`;

  return (
    <nav
      aria-label="Pagination des abonnements"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pageCount} · {total} abonnement
        {total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(Math.max(1, page - 1))}
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ${
            page <= 1 ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <ChevronLeft className="size-4" aria-hidden />
          Précédent
        </Link>
        <Link
          href={href(Math.min(pageCount, page + 1))}
          className={`${buttonVariants({ variant: "outline", size: "sm" })} ${
            page >= pageCount ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Suivant
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-4">
        <CreditCard aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Aucun abonnement</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Attribuez un plan à une boutique pour créer son abonnement.
        </p>
      </div>
    </div>
  );
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = first(sp.search) ?? "";
  const status = parseStatus(first(sp.status));
  const plan = first(sp.plan) ?? "ALL";
  const page = parsePage(first(sp.page));

  const [result, stats, plans, assignable, planUsage] = await Promise.all([
    getSubscriptions({ search, status, plan, page }),
    getSubscriptionStats(),
    getPlanOptions(),
    getTenantsWithoutSubscription(),
    getPlansWithUsage(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Abonnements
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} abonnement{stats.total > 1 ? "s" : ""} enregistré
            {stats.total > 1 ? "s" : ""}.
          </p>
        </div>

        <Link
          href="/admin/plans"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Gérer les plans
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Actifs" value={stats.active} tone="success" />
        <Kpi label="En essai" value={stats.trial} tone="warning" />
        <Kpi label="Impayés" value={stats.pastDue} tone="destructive" />
        <Kpi
          label="Sans abonnement"
          value={stats.withoutSubscription}
          tone="secondary"
        />
      </section>

      <SubscriptionsToolbar
        search={search}
        status={status}
        plan={plan}
        plans={plans}
      />

      <AssignPlanForm tenants={assignable} plans={plans} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Boutique</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Statut</th>
              <th className="px-4 py-2.5 font-medium">Période de fin</th>
              <th className="px-4 py-2.5 font-medium">Début</th>
              <th className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState />
                </td>
              </tr>
            ) : (
              result.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${item.tenant.id}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {item.tenant.name}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      /{item.tenant.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.plan.name}</td>
                  <td className="px-4 py-3">
                    <SubscriptionStatusBadge status={item.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {item.currentPeriodEnd
                      ? new Date(item.currentPeriodEnd).toLocaleDateString(
                          "fr-FR",
                        )
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(item.startedAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionRowActions
                      subscription={item}
                      plans={plans}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />

      <PlansCard plans={planUsage} />
    </div>
  );
}
