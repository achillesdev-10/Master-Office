"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTheme } from "@/lib/actions/themes";
import type { ThemeListItem } from "@/lib/db/queries/themes";
import { THEME_CATEGORY_LABELS } from "@/lib/validators/theme";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeForm } from "@/components/admin/theme-form";
import { ThemePreview } from "@/components/admin/theme-preview";

/**
 * Catalogue des thèmes (module 11) : grille de cartes avec aperçu,
 * badges premium/catégorie, édition en ligne et suppression protégée.
 * La création se fait sur la page dédiée `/admin/themes/new`.
 */
export function ThemesManager({ themes }: { themes: ThemeListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = editingId
    ? (themes.find((theme) => theme.id === editingId) ?? null)
    : null;

  if (editing) {
    return (
      <ThemeForm initial={editing} onCancel={() => setEditingId(null)} />
    );
  }

  const handleDelete = (theme: ThemeListItem) => {
    const confirmed = window.confirm(
      `Supprimer le thème « ${theme.name} » ?\n\nImpossible si des boutiques l’utilisent.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteTheme(theme.id);
      if (result.success) {
        toast.success(result.message ?? "Thème supprimé.");
        router.refresh();
      } else {
        toast.error(result.error ?? "La suppression a échoué.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/admin/themes/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          Nouveau thème
        </Link>
      </div>

      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
          <div className="rounded-full bg-muted p-4">
            <ImageOff aria-hidden className="size-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Aucun thème</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez le premier thème du catalogue.
            </p>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => (
            <li
              key={theme.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="relative">
                <ThemePreview theme={theme} />
                {theme.isPremium && (
                  <Badge
                    variant="warning"
                    className="absolute left-3 top-3 gap-1"
                  >
                    <Star className="size-3" aria-hidden />
                    Premium
                  </Badge>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{theme.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /{theme.slug}
                    </p>
                  </div>
                  <Badge
                    variant={theme.shopCount > 0 ? "success" : "secondary"}
                  >
                    {theme.shopCount} boutique{theme.shopCount > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {theme.category && (
                    <Badge variant="info">
                      {THEME_CATEGORY_LABELS[
                        theme.category as keyof typeof THEME_CATEGORY_LABELS
                      ] ?? theme.category}
                    </Badge>
                  )}
                </div>

                <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                  {theme.description ?? "Aucune description."}
                </p>

                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Modifier le thème ${theme.name}`}
                    disabled={pending}
                    onClick={() => setEditingId(theme.id)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer le thème ${theme.name}`}
                    disabled={pending}
                    onClick={() => handleDelete(theme)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
