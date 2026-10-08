"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wrapper client requis par next-themes (attribute="class" → classe .dark
 * consommée par Tailwind via darkMode: ["class"]).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
