"use client";

import { UserButton } from "@clerk/nextjs";
import { ChevronRight, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

/** Libellés des segments de route pour le fil d'Ariane */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  stores: "Boutiques",
  domains: "Domaines",
  users: "Utilisateurs",
  subscriptions: "Abonnements",
  themes: "Thèmes",
  "audit-logs": "Journal d'activité",
  support: "Support",
  settings: "Paramètres",
  analytics: "Analytics",
};

function labelFor(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.charAt(0).toUpperCase() + segment.slice(1)
  );
}

type TopbarProps = {
  /** Ouvre le drawer mobile (menu hamburger) */
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const adminIndex = parts.indexOf("admin");
  const segments = adminIndex >= 0 ? parts.slice(adminIndex + 1) : parts;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:gap-4 md:px-6">
      {/* Menu mobile */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Ouvrir la navigation"
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {/* Fil d'Ariane dynamique */}
      <nav aria-label="Fil d'Ariane" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="text-muted-foreground">Admin</li>
          {segments.map((segment, index) => (              <li key={`${segment}-${index}`} className="flex items-center gap-1.5">
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
                <span
                className={
                  index === segments.length - 1
                    ? "truncate font-medium text-foreground"
                    : "truncate text-muted-foreground"
                }
              >
                {labelFor(segment)}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-1.5 md:gap-3">
        {/* Recherche globale — placeholder, branchée dans un module dédié */}
        <div className="relative hidden sm:block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Rechercher…"
            aria-label="Recherche globale (bientôt disponible)"
            className="h-9 w-44 rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-64"
          />
        </div>

        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
