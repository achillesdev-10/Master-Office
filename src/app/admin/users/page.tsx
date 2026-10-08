import Link from "next/link";
import { Users } from "lucide-react";
import { Role } from "@prisma/client";
import {
  getUsers,
  getUserRoleCounts,
  getTenantFilterOptions,
  USER_SORT_FIELDS,
  type SortDir,
  type UserSortField,
} from "@/lib/db/queries/users";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UsersToolbar } from "@/components/admin/users-toolbar";
import { UsersTable } from "@/components/admin/users-table";
import { InviteUserForm } from "@/components/admin/invite-user-form";

/**
 * `/admin/users` — comptes de la plateforme (module 9).
 *
 * Server Component : lecture de l'URL + requêtes Prisma ici ; la
 * table (tri/pagination/rôles) et la barre d'outils sont des Client
 * Components pilotés par l'URL.
 */

export const metadata = { title: "Utilisateurs" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseRole(value: string | undefined): Role | "ALL" {
  if (value && Object.values(Role).includes(value as Role)) {
    return value as Role;
  }
  return "ALL";
}

function parseSort(value: string | undefined): UserSortField {
  if (value && (USER_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as UserSortField;
  }
  return "createdAt";
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-4">
        <Users aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">
          {hasFilters
            ? "Aucun utilisateur ne correspond aux filtres"
            : "Aucun utilisateur"}
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "Essayez d’élargir la recherche ou de réinitialiser les filtres."
            : "Invitez vos collaborateurs pour qu’ils accèdent à la console."}
        </p>
      </div>
      {hasFilters && (
        <Link
          href="/admin/users"
          className={buttonVariants({ variant: "outline" })}
        >
          Réinitialiser les filtres
        </Link>
      )}
    </div>
  );
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const search = first(sp.search) ?? "";
  const role = parseRole(first(sp.role));
  const tenant = first(sp.tenant) ?? "ALL";
  const page = parsePage(first(sp.page));
  const sort = parseSort(first(sp.sort));
  const dir: SortDir = first(sp.dir) === "asc" ? "asc" : "desc";

  const [result, counts, tenantOptions] = await Promise.all([
    getUsers({
      search,
      role,
      tenant: tenant === "ALL" ? undefined : tenant,
      page,
      sort,
      dir,
    }),
    getUserRoleCounts(),
    getTenantFilterOptions(),
  ]);

  const hasFilters = Boolean(search || role !== "ALL" || tenant !== "ALL");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} compte{result.total > 1 ? "s" : ""} sur la
            plateforme.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge>Super Admin · {counts.SUPER_ADMIN}</Badge>
          <Badge variant="info">Admin · {counts.ADMIN}</Badge>
          <Badge variant="secondary">Membre · {counts.MEMBER}</Badge>
        </div>
      </header>

      <InviteUserForm />

      <UsersToolbar
        search={search}
        role={role}
        tenant={tenant}
        tenants={tenantOptions}
      />

      <UsersTable
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
