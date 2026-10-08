"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Globe,
  Palette,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Onglets de la fiche boutique (module 7) : navigation pilote par
 * l'URL (`/admin/tenants/{id}/{section}`), le composant de layout
 * assure l'en-tête et le 404.
 */

const TABS: { label: string; segment: string; icon: LucideIcon }[] = [
  { label: "Infos", segment: "info", icon: Settings },
  { label: "Domaines", segment: "domains", icon: Globe },
  { label: "Thème", segment: "theme", icon: Palette },
  { label: "Paiements", segment: "payments", icon: CreditCard },
  { label: "Livraison", segment: "shipping", icon: Truck },
  { label: "Utilisateurs", segment: "users", icon: Users },
  { label: "Statistiques", segment: "stats", icon: BarChart3 },
  { label: "Zone de danger", segment: "danger", icon: AlertTriangle },
];

export function TenantTabs({ id }: { id: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections de la boutique"
      className="-mb-px flex gap-1 overflow-x-auto border-b"
    >
      {TABS.map((tab) => {
        const href = `/admin/tenants/${id}/${tab.segment}`;
        const active =
          pathname === href ||
          pathname === `${href}/` ||
          (pathname === `/admin/tenants/${id}` && tab.segment === "info");
        const Icon = tab.icon;
        const danger = tab.segment === "danger";

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? danger
                  ? "border-destructive font-medium text-destructive"
                  : "border-primary font-medium text-foreground"
                : danger
                  ? "border-transparent text-muted-foreground hover:text-destructive"
                  : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
