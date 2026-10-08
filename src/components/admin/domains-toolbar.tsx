"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

/**
 * Barre d’outils de la liste des domaines (module 8) : recherche
 * (domaine ou boutique) + filtres SSL / vérification, pilotés par l’URL.
 */

const SSL_OPTIONS = [
  { value: "ALL", label: "Tous les SSL" },
  { value: "PENDING", label: "SSL en attente" },
  { value: "ACTIVE", label: "SSL actif" },
  { value: "FAILED", label: "SSL échoué" },
] as const;

const VERIFIED_OPTIONS = [
  { value: "ALL", label: "Vérifiés ou non" },
  { value: "yes", label: "Vérifié (oui)" },
  { value: "no", label: "Vérifié (non)" },
] as const;

type DomainsToolbarProps = {
  search: string;
  ssl: string;
  verified: string;
};

export function DomainsToolbar({
  search,
  ssl,
  verified,
}: DomainsToolbarProps) {
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

  const hasFilters = Boolean(search || ssl !== "ALL" || verified !== "ALL");

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
          placeholder="Domaine ou boutique…"
          aria-label="Rechercher un domaine"
          className="pl-8"
          type="search"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={ssl}
          aria-label="Filtrer par statut SSL"
          className="w-full sm:w-48"
          onChange={(event) => apply({ ssl: event.target.value })}
        >
          {SSL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          value={verified}
          aria-label="Filtrer par vérification DNS"
          className="w-full sm:w-48"
          onChange={(event) => apply({ verified: event.target.value })}
        >
          {VERIFIED_OPTIONS.map((option) => (
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
              apply({ search: undefined, ssl: undefined, verified: undefined });
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
