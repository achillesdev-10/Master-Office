import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "../field";
import type { StepProps } from "../types";

/** Étape 4 — Thème : sélection dans le catalogue (aperçus = module 11). */
export function StepTheme({ values, onChange, errors, themes = [] }: StepProps) {
  if (themes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aucun thème disponible. Créez d’abord un thème dans{" "}
        <span className="font-medium text-foreground">Thèmes</span>.
      </div>
    );
  }

  return (
    <Field label="Thème de la boutique" htmlFor="themeId" error={errors.themeId}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const selected = values.themeId === theme.id;
          return (
            <label
              key={theme.id}
              htmlFor={`theme-${theme.id}`}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-colors hover:border-primary/50",
                selected &&
                  "border-primary bg-primary/5 ring-2 ring-primary/30",
              )}
            >
              <input
                id={`theme-${theme.id}`}
                type="radio"
                name="themeId"
                className="sr-only"
                checked={selected}
                onChange={() => onChange({ themeId: theme.id })}
              />
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-secondary">
                  <Palette
                    aria-hidden
                    className="size-4 text-secondary-foreground"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {theme.name}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {theme.slug}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}
