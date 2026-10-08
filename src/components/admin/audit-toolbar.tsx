"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { AuditFilters } from "@/lib/db/queries/audit";

/**
 * Barre d’outiles du journal d’activité (module 12) :
 * filtres action / utilisateur / période, pilotés par l’URL.
 */
export function AuditToolbar({
  actions,
  entities,
  tenants,
  filters,
}: {
  actions: string[];
  entities: string[];
  tenants: { id: string; name: string }[];
  filters: AuditFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(filters.email ?? "");

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
    if (email === (filters.email ?? "")) return;
    const timer = setTimeout(() => {
      apply({ email: email.trim() || undefined });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, filters.email, searchParams]);

  const hasFilters = Boolean(
    filters.action ||
      filters.email ||
      filters.entity ||
      filters.tenantId ||
      filters.from ||
      filters.to,
  );

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Action</span>
          <Select
            value={filters.action ?? "ALL"}
            onChange={(event) => apply({ action: event.target.value })}
          >
            <option value="ALL">Toutes les actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Entité</span>
          <Select
            value={filters.entity ?? "ALL"}
            onChange={(event) => apply({ entity: event.target.value })}
          >
            <option value="ALL">Toutes les entités</option>
            {entities.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Boutique</span>
          <Select
            value={filters.tenantId ?? "ALL"}
            onChange={(event) => apply({ tenantId: event.target.value })}
          >
            <option value="ALL">Toutes les boutiques</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Utilisateur</span>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email…"
              aria-label="Filtrer par utilisateur"
              className="pl-8"
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Du</span>
          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => apply({ from: event.target.value || undefined })}
            aria-label="Date de début"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Au</span>
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => apply({ to: event.target.value || undefined })}
            aria-label="Date de fin"
          />
        </label>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start xl:self-auto"
          onClick={() => {
            setEmail("");
            apply({
              action: undefined,
              email: undefined,
              entity: undefined,
              tenantId: undefined,
              from: undefined,
              to: undefined,
            });
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
