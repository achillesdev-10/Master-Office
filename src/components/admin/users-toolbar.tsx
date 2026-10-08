"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PLATFORM_ROLES, PLATFORM_ROLE_LABELS } from "@/lib/validators/user";

/**
 * Barre d’outils de la liste des utilisateurs (module 9) :
 * recherche (email, boutique) + filtre de rôle, pilotés par l’URL.
 */

type UsersToolbarProps = {
  search: string;
  role: string;
  tenant: string;
  tenants: { id: string; name: string }[];
};

export function UsersToolbar({
  search,
  role,
  tenant,
  tenants,
}: UsersToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(search);

  const apply = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== "ALL") params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => {
      apply({ search: query.trim() || undefined });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, search, searchParams]);

  const hasFilters = Boolean(search || role !== "ALL" || tenant !== "ALL");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <form
        role="search"
        className="relative w-full lg:max-w-sm"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Email ou boutique…"
          aria-label="Rechercher un utilisateur"
          className="pl-8"
          type="search"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={role}
          aria-label="Filtrer par rôle"
          className="w-full sm:w-48"
          onChange={(event) => apply({ role: event.target.value })}
        >
          <option value="ALL">Tous les rôles</option>
          {PLATFORM_ROLES.map((value) => (
            <option key={value} value={value}>
              {PLATFORM_ROLE_LABELS[value]}
            </option>
          ))}
        </Select>

        <Select
          value={tenant}
          aria-label="Filtrer par boutique"
          className="w-full sm:w-48"
          onChange={(event) => apply({ tenant: event.target.value })}
        >
          <option value="ALL">Toutes les boutiques</option>
          {tenants.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              apply({ search: undefined, role: undefined, tenant: undefined });
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
