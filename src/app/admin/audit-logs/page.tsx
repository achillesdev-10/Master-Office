import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, ScrollText } from "lucide-react";
import {
  getAuditActions,
  getAuditEntities,
  getAuditLogs,
  type AuditFilters,
} from "@/lib/db/queries/audit";
import { getTenantFilterOptions } from "@/lib/db/queries/users";
import { formatNumber } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AuditToolbar } from "@/components/admin/audit-toolbar";
import { AuditTable } from "@/components/admin/audit-table";

/**
 * `/admin/audit-logs` — journal d’activité (module 12).
 *
 * Server Component : filtres, pagination et export CSV côté serveur ;
 * le dépliage des métadonnées est géré par `AuditTable` (Client).
 */

export const metadata = { title: "Journal d'activité" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const action = first(sp.action) ?? "";
  const email = first(sp.email) ?? "";
  const entity = first(sp.entity) ?? "";
  const tenantId = first(sp.tenantId) ?? "";
  const from = first(sp.from) ?? "";
  const to = first(sp.to) ?? "";
  const page = parsePage(first(sp.page));

  const filters: AuditFilters = {
    action: action || undefined,
    email: email || undefined,
    entity: entity || undefined,
    tenantId: tenantId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  };

  const [result, actions, entities, tenants] = await Promise.all([
    getAuditLogs(filters),
    getAuditActions(),
    getAuditEntities(),
    getTenantFilterOptions(),
  ]);

  const qs = new URLSearchParams();
  if (action) qs.set("action", action);
  if (email) qs.set("email", email);
  if (entity) qs.set("entity", entity);
  if (tenantId) qs.set("tenantId", tenantId);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const pageHref = (target: number) => {
    const params = new URLSearchParams(qs.toString());
    params.set("page", String(target));
    return `/admin/audit-logs?${params.toString()}`;
  };
  const exportHref = `/api/audit-logs/export${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Journal d’activité
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(result.total)} événement
            {result.total > 1 ? "s" : ""} enregistré
            {result.total > 1 ? "s" : ""} (consultation des Super Admins).
          </p>
        </div>

        <a
          href={exportHref}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download className="size-4" aria-hidden />
          Exporter en CSV
        </a>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <AuditToolbar
          actions={actions}
          entities={entities}
          tenants={tenants}
          filters={filters}
        />
      </section>

      <div className="overflow-x-auto rounded-lg border">
        <AuditTable items={result.items} />
      </div>

      {result.total > 0 && (
        <nav
          aria-label="Pagination du journal"
          className="flex flex-col items-center justify-between gap-3 sm:flex-row"
        >
          <p className="text-sm text-muted-foreground">
            Page {result.page} sur {result.pageCount} · {result.total} entrée
            {result.total > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={pageHref(Math.max(1, result.page - 1))}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} ${
                result.page <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Précédent
            </Link>
            <Link
              href={pageHref(Math.min(result.pageCount, result.page + 1))}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} ${
                result.page >= result.pageCount
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              Suivant
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </nav>
      )}

      {result.total === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-sm text-muted-foreground">
          <ScrollText className="size-4" aria-hidden />
          Aucun événement à afficher.
        </div>
      )}
    </div>
  );
}
