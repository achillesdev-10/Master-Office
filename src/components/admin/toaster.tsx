"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Notifications toast (sonner) — thème synchronisé avec next-themes.
 * Montée dans le layout racine, disponible partout dans l'app.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      richColors
      closeButton
      duration={4000}
    />
  );
}
