"use client";

import { useMemo, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Eye, Trash2, UserCheck, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  changePlatformUserRole,
  deletePlatformUser,
  setUserDisabled,
} from "@/lib/actions/users";
import type { UserListItem } from "@/lib/db/queries/users";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
} from "@/lib/validators/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { DataTable } from "@/components/admin/data-table";

function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "SUPER_ADMIN" ? "default" : role === "ADMIN" ? "info" : "secondary";
  return (
    <Badge variant={variant}>
      {PLATFORM_ROLE_LABELS[role as keyof typeof PLATFORM_ROLE_LABELS] ?? role}
    </Badge>
  );
}

function UserRowActions({ user }: { user: UserListItem }) {
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

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Supprimer le compte ${user.email} ?\n\nSes rattachements aux boutiques seront retirés.`,
    );
    if (!confirmed) return;
    run(() => deletePlatformUser(user.id), "Compte supprimé.");
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Voir ${user.email}`}
        title="Voir la fiche"
        disabled={pending}
        onClick={() => router.push(`/admin/users/${user.id}`)}
        className="text-muted-foreground"
      >
        <Eye className="size-4" />
      </Button>

      <Select
        aria-label={`Rôle de ${user.email}`}
        className="w-36"
        value={user.role}
        disabled={pending}
        onChange={(event) => {
          const role = event.target.value;
          if (role === user.role) return;
          run(
            () => changePlatformUserRole({ userId: user.id, role }),
            "Rôle modifié.",
          );
        }}
      >
        {PLATFORM_ROLES.map((value) => (
          <option key={value} value={value}>
            {PLATFORM_ROLE_LABELS[value]}
          </option>
        ))}
      </Select>

      <Button
        variant="ghost"
        size="icon"
        aria-label={
          user.disabled ? `Réactiver ${user.email}` : `Désactiver ${user.email}`
        }
        title={user.disabled ? "Réactiver le compte" : "Désactiver le compte"}
        disabled={pending}
        onClick={() =>
          run(
            () => setUserDisabled({ userId: user.id, disabled: !user.disabled }),
            user.disabled ? "Compte réactivé." : "Compte désactivé.",
          )
        }
        className={
          user.disabled
            ? "text-emerald-600 hover:bg-emerald-500/10"
            : "text-amber-600 hover:bg-amber-500/10"
        }
      >
        {user.disabled ? (
          <UserCheck className="size-4" />
        ) : (
          <UserX className="size-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={`Supprimer ${user.email}`}
        title="Supprimer le compte"
        disabled={pending}
        onClick={handleDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

type UsersTableProps = {
  items: UserListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  emptyState: React.ReactNode;
};

export function UsersTable({
  items,
  total,
  page,
  pageCount,
  pageSize,
  sort,
  dir,
  emptyState,
}: UsersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns = useMemo<ColumnDef<UserListItem, unknown>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Utilisateur",
        cell: ({ row }) => (
          <div className={`min-w-0 ${row.original.disabled ? "opacity-60" : ""}`}>
            <span className="flex flex-wrap items-center gap-2 font-medium">
              <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{row.original.email}</span>
              {row.original.disabled && (
                <Badge variant="destructive">Désactivé</Badge>
              )}
              {row.original.pending && (
                <Badge variant="warning">En attente</Badge>
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {!row.original.pending && row.original.tenants.length > 0
                ? row.original.tenants.join(", ")
                : "Aucune boutique"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Rôle",
        cell: ({ getValue }) => <RoleBadge role={getValue<string>()} />,
      },
      {
        accessorKey: "tenantCount",
        header: "Boutiques",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Inscrit le",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {format(new Date(getValue<string>()), "d MMM yyyy", { locale: fr })}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <UserRowActions user={row.original} />,
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
    <DataTable<UserListItem>
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
      noun="utilisateur"
    />
  );
}
