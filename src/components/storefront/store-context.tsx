"use client";

import { createContext, useContext, ReactNode } from "react";

interface StoreContextType {
  slug: string;
  basePath: string;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children, slug, basePath }: { children: ReactNode; slug: string; basePath: string }) {
  return (
    <StoreContext.Provider value={{ slug, basePath }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

export function storeHref(basePath: string, path: string): string {
  return `${basePath}${path}`;
}