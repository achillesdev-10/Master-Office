import Link from "next/link";
import { Store, Plus } from "lucide-react";
import { TenantStatus } from "@prisma/client";
import {
  getPlanOptions,
  getTenants,
  TENANT_SORT_FIELDS,
  type SortDir,
  type TenantSortField,
} from "@/lib/db/queries/tenants";
import { buttonVariants } from "@/components/ui/button";
import { TenantsToolbar } from "@/components/admin/tenants-toolbar";
import { TenantsTable } from "@/components/admin/tenants-table";

/**
 * /admin/tenants — liste paginée des boutiques (module 5).
 *
 * Server Component : lecture de l'URL + requêtes Prisma ici ; seuls la
 * table (tri/pagination) et la barre d'outils (recherche/filtres) sont
 * des Client Components pilotés par l'URL.
 */

export const metadata = { title: "Boutiques" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | undefined): TenantStatus | "ALL" {
  if (value && Object.values(TenantStatus).includes(value as TenantStatus)) {
    return value as TenantStatus;
  }
  return "ALL";
}

function parseSort(value: string | undefined): TenantSortField {
  if (value && (TENANT_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as TenantSortField;
  }
  return "createdAt";
}

function EmptyState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-4">
        <Store aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">
          {hasFilters
            ? "Aucune boutique ne correspond aux filtres"
            : "Aucune boutique pour le moment"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "Essayez d’élargir la recherche ou de réinitialiser les filtres."
            : "Créez votre première boutique pour lancer une nouvelle enseigne sur la plateforme."}
        </p>
      </div>
      {hasFilters ? (
        <Link href="/admin/tenants" className={buttonVariants({ variant: "outline" })}>
          Réinitialiser les filtres
        </Link>
      ) : (
        <Link href="/admin/tenants/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          Nouvelle boutique
        </Link>
      )}
    </div>
  );
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = first(sp.search) ?? "";
  const status = parseStatus(first(sp.status));
  const plan = first(sp.plan) ?? "ALL";
  const page = parsePage(first(sp.page));
  const sort = parseSort(first(sp.sort));
  const dir: SortDir = first(sp.dir) === "asc" ? "asc" : "desc";

  const [result, plans] = await Promise.all([
    getTenants({ search, status, plan, page, sort, dir }),
    getPlanOptions(),
  ]);

  const hasFilters = Boolean(search || status !== "ALL" || plan !== "ALL");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boutiques</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} boutique{result.total > 1 ? "s" : ""} enregistrée
            {result.total > 1 ? "s" : ""} sur la plateforme.
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className={buttonVariants({ size: "default" })}
        >
          <Plus className="size-4" aria-hidden />
          Nouvelle boutique
        </Link>
      </header>

      <TenantsToolbar
        search={search}
        status={status}
        plan={plan}
        plans={plans}
      />

      <TenantsTable
        items={result.items}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        pageSize={result.pageSize}
        sort={sort}
        dir={dir}
        emptyState={<EmptyState hasFilters={hasFilters} />}
      />
    </div>
  );
}
