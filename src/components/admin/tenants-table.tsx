"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Eye, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { deleteTenant, suspendTenant } from "@/lib/actions/tenants";
import type { TenantListItem } from "@/lib/db/queries/tenants";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge";

/**
 * Conteneur client de la table des boutiques : définit les colonnes,
 * synchronise tri / pagination avec l'URL et déclenche les Server
 * Actions (suspendre, supprimer) sans rechargement de page.
 */

function TenantRowActions({ tenant }: { tenant: TenantListItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(result.message ?? successMessage);
        router.refresh();
      } else {
        toast.error(result.error ?? "Action impossible.");
      }
    });
  };

  const handleSuspend = () => {
    if (tenant.status === "SUSPENDED") return;
    run(() => suspendTenant(tenant.id), "Boutique suspendue.");
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Supprimer « ${tenant.name} » ?\n\nLa boutique sera archivée (suppression logique, réversible en base) et retirée de la liste.`,
    );
    if (!confirmed) return;
    run(() => deleteTenant(tenant.id), "Boutique supprimée.");
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={handleSuspend}
        title={
          tenant.status === "SUSPENDED"
            ? "Déjà suspendue"
            : "Suspendre la boutique"
        }
        className="hidden sm:inline-flex"
      >
        <Ban className="size-3.5" aria-hidden />
        Suspendre
      </Button>

      <Link
        href={`/admin/tenants/${tenant.id}`}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Eye className="size-3.5" aria-hidden />
        Voir
      </Link>
      <Link
        href={`/admin/tenants/${tenant.id}`}
        className="hidden h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
      >
        <Pencil className="size-3.5" aria-hidden />
        Éditer
      </Link>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Supprimer ${tenant.name}`}
        title="Supprimer"
        disabled={pending}
        onClick={handleDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

type TenantsTableProps = {
  items: TenantListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  emptyState: React.ReactNode;
};

export function TenantsTable({
  items,
  total,
  page,
  pageCount,
  pageSize,
  sort,
  dir,
  emptyState,
}: TenantsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns = useMemo<ColumnDef<TenantListItem, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Boutique",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/admin/tenants/${row.original.id}`}
              className="block truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              /{row.original.slug}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "primaryDomain",
        header: "Domaine principal",
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ getValue }) => <TenantStatusBadge status={getValue<string>()} />,
      },
      {
        id: "plan",
        accessorFn: (row) => row.plan?.name ?? "—",
        header: "Plan",
        enableSorting: false,
      },
      {
        accessorKey: "createdAt",
        header: "Créée le",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {format(new Date(getValue<string>()), "d MMM yyyy", { locale: fr })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => <TenantRowActions tenant={row.original} />,
      },
    ],
    [],
  );

  const sorting: SortingState = useMemo(
    () => [{ id: sort, desc: dir === "desc" }],
    [sort, dir],
  );

  const navigate = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSortingChange = (next: SortingState) => {
    const firstSort = next[0];
    navigate({
      sort: firstSort?.id,
      dir: firstSort ? (firstSort.desc ? "desc" : "asc") : undefined,
      page: undefined,
    });
  };

  const handlePageChange = (nextPage: number) => {
    navigate({ page: nextPage > 1 ? String(nextPage) : undefined });
  };

  return (
    <DataTable<TenantListItem>
      columns={columns}
      data={items}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      page={page}
      pageCount={pageCount}
      pageSize={pageSize}
      total={total}
      onPageChange={handlePageChange}
      emptyState={emptyState}
      noun="boutique"
    />
  );
}
