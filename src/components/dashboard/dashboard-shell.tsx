"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Menu, X, Store, Package, ShoppingBag, Settings, ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardShellProps {
  children: React.ReactNode;
  tenantId: string;
  userMemberships: {
    id: string;
    tenantId: string;
    role: string;
    tenant?: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: Store },
  { href: "/dashboard/products", label: "Produits", icon: Package },
  { href: "/dashboard/categories", label: "Catégories", icon: ShoppingBag },
  { href: "/dashboard/orders", label: "Commandes", icon: Package },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
] as const;

export function DashboardShell({ children, tenantId, userMemberships }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentTenant = userMemberships.find((m) => m.tenantId === tenantId);
  const otherMemberships = userMemberships.filter((m) => m.tenantId !== tenantId);

  const handleTenantChange = (newTenantId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tenant", newTenantId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header sidebar */}
          <div className="flex h-16 items-center gap-3 border-b px-4">
            <Link href={`/dashboard?tenant=${tenantId}`} className="flex items-center gap-2">
              <Store className="size-6 text-primary" aria-hidden />
              <span className="font-semibold truncate">Mon Dashboard</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}?tenant=${tenantId}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sélecteur de boutique */}
          {userMemberships.length > 1 && (
            <div className="border-t p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Mes boutiques</p>
              <select
                value={tenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {userMemberships.map((m) => (
                  <option key={m.tenantId} value={m.tenantId}>
                    {m.tenant?.name ?? "Boutique"} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Footer sidebar */}
          <div className="border-t p-3">
            {currentTenant?.tenant?.slug && (
              <Link
                href={`/store/${currentTenant.tenant.slug}`}
                target="_blank"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Package className="size-4" aria-hidden />
                Voir la boutique
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="size-6" aria-hidden />
          </button>

          <div className="flex-1" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt="" />
                  <AvatarFallback>
                    <User className="size-4" aria-hidden />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1">
                <p className="text-sm font-medium truncate">{currentTenant?.tenant?.name ?? "Boutique"}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTenant?.role}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/settings?tenant=${tenantId}`} className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                  <Settings className="size-4" aria-hidden />
                  Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/tenants/[id]" className="flex w-full items-center gap-2 px-2 py-1.5 text-sm">
                  <Store className="size-4" aria-hidden />
                  Administration (Super Admin)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}