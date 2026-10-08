import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Field } from "../field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "../types";

const MAX_DESCRIPTION = 280;

function SlugFeedback({ status }: { status: StepProps["slugStatus"] }) {
  if (!status || status === "idle") return null;

  if (status === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Vérification de la disponibilité…
      </p>
    );
  }
  if (status === "available") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-500">
        <CheckCircle2 className="size-3.5" aria-hidden />
        Slug disponible
      </p>
    );
  }
  if (status === "taken") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-500">
        <XCircle className="size-3.5" aria-hidden />
        Ce slug est déjà utilisé
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500">
      <XCircle className="size-3.5" aria-hidden />
      Format de slug invalide
    </p>
  );
}

/** Étape 2 — Boutique : nom (→ slug auto), slug, description. */
export function StepStore({ values, onChange, errors, slugStatus }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom de la boutique"
          htmlFor="storeName"
          error={errors.name}
          hint="Le slug est généré automatiquement (modifiable)."
        >
          <Input
            id="storeName"
            placeholder="Boutique Marie"
            value={values.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </Field>

        <Field label="Slug (URL)" htmlFor="storeSlug" error={errors.slug}>
          <Input
            id="storeSlug"
            placeholder="boutique-marie"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
            value={values.slug}
            onChange={(event) =>
              onChange({ slug: event.target.value.toLowerCase() })
            }
          />
          <SlugFeedback status={slugStatus} />
        </Field>
      </div>

      <Field
        label="Description courte"
        htmlFor="storeDescription"
        error={errors.description}
        hint={`${values.description.length} / ${MAX_DESCRIPTION} caractères`}
      >
        <textarea
          id="storeDescription"
          rows={3}
          maxLength={MAX_DESCRIPTION}
          placeholder="Vêtements et accessoires tendance, livrés partout en Europe."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>
          Adresse prévue :{" "}
          <span className="font-mono text-foreground">
            {values.slug || "votre-slug"}.maboutique.com
          </span>
        </p>
      </div>
    </div>
  );
}
