"use client";

import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * Shell interactif du dashboard :
 *  - desktop : grille [sidebar auto | 1fr], sidebar fixe (repliable)
 *  - mobile  : sidebar masquée, drawer en overlay
 *  - la zone de contenu scrolle, topbar collée en haut
 * (Nécessite un composant client pour l'état repli/drawer ; l'auth est
 *  vérifiée côté serveur dans app/(admin)/layout.tsx avant ce rendu.)
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="grid h-dvh grid-cols-1 overflow-hidden md:grid-cols-[auto_1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden h-full md:block">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          className="h-full"
        />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
              className="h-full shadow-2xl"
            />
            <button
              type="button"
              aria-label="Fermer la navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3.5 inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Colonne principale */}
      <div className="flex h-full min-w-0 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
