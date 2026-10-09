"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

/**
 * Barre d'outils de la liste des boutiques : recherche (nom, slug,
 * email du propriétaire) + filtre statut, tous pilotés par l'URL
 * (navigation douce, aucune seizure de page).
 */

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspendue" },
  { value: "ARCHIVED", label: "Archivée" },
] as const;

type TenantsToolbarProps = {
  search: string;
  status: string;
};

export function TenantsToolbar({
  search,
  status,
}: TenantsToolbarProps) {
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
    params.delete("page"); // les filtres remettent la pagination à 1
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Recherche : debounce 350 ms puis mise à jour de l'URL.
  useEffect(() => {
    if (query === search) return;
    const timer = setTimeout(() => {
      apply({ search: query.trim() || undefined });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, search, searchParams]);

  const hasFilters = Boolean(search || status !== "ALL");

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
          placeholder="Nom, slug ou email du propriétaire…"
          aria-label="Rechercher une boutique"
          className="pl-8"
          type="search"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          aria-label="Filtrer par statut"
          className="w-full sm:w-44"
          onChange={(event) => apply({ status: event.target.value })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              apply({ search: undefined, status: undefined });
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