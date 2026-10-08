"use client";

import { useRouter } from "next/navigation";

import { ThemeForm } from "@/components/admin/theme-form";

/**
 * Formulaire de création d’un thème (`/admin/themes/new`) —
 * renvoie vers la grille après enregistrement.
 */
export function ThemeNewForm() {
  const router = useRouter();

  return (
    <ThemeForm
      onCancel={() => router.push("/admin/themes")}
      redirectOnSuccess="/admin/themes"
    />
  );
}
