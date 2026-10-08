"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Boutiques", href: "/admin/tenants", icon: Store },
  { label: "Domaines", href: "/admin/domains", icon: Globe },
  { label: "Utilisateurs", href: "/admin/users", icon: Users },
  { label: "Abonnements", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Thèmes", href: "/admin/themes", icon: Palette },
  { label: "Journal d'activité", href: "/admin/audit-logs", icon: ScrollText },
  { label: "Support", href: "/admin/support", icon: LifeBuoy },
  { label: "Paramètres", href: "/admin/settings", icon: Settings },
];

/**
 * Vrai si `pathname` correspond à la route de l'item
 * (page exacte ou sous-route).
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarProps = {
  /** Mode replié (desktop) : icônes seules */
  collapsed?: boolean;
  /** Affiche le bouton de repli (desktop uniquement) */
  onToggleCollapse?: () => void;
  /** Fermé après navigation (drawer mobile) */
  onNavigate?: () => void;
  className?: string;
};

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  className,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Marque */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Store className="size-4" aria-hidden />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">
            MaBoutique
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Navigation principale" className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Repli desktop */}
      {onToggleCollapse && (
        <div className="hidden shrink-0 border-t p-2 md:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={
              collapsed
                ? "Déplier la barre latérale"
                : "Replier la barre latérale"
            }
            className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden />
                <span className="truncate">Replier</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
