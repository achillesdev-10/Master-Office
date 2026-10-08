"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createTheme, updateTheme, uploadThemePreview } from "@/lib/actions/themes";
import { slugify } from "@/lib/validators/tenant";
import {
  THEME_CATEGORIES,
  THEME_CATEGORY_LABELS,
} from "@/lib/validators/theme";
import type { ThemeListItem } from "@/lib/db/queries/themes";
import { Field } from "@/components/admin/tenant-form/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Formulaire de création / édition d’un thème (module 11).
 * Utilisé par `/admin/themes/new` et par l’édition en ligne de la grille.
 */
export function ThemeForm({
  initial,
  onCancel,
  redirectOnSuccess,
}: {
  initial?: ThemeListItem | null;
  onCancel?: () => void;
  /** Redirection après création (page `/admin/themes/new`) */
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [previewUrl, setPreviewUrl] = useState(initial?.previewUrl ?? "");
  const [isPremium, setIsPremium] = useState(initial?.isPremium ?? false);
  const [category, setCategory] = useState(initial?.category ?? "");

  const isEdit = Boolean(initial);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    const result = await uploadThemePreview(formData);
    setUploading(false);

    if (result.success && result.url) {
      setPreviewUrl(result.url);
      toast.success("Aperçu importé.");
    } else if (!result.success) {
      toast.error(result.error ?? "L'upload de l'aperçu a échoué.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const values = {
      name: name.trim(),
      slug: (slug || slugify(name)).trim(),
      description: description.trim(),
      previewUrl: previewUrl.trim(),
      isPremium,
      category,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateTheme({ id: initial?.id, ...values })
        : await createTheme(values);

      if (result.success) {
        toast.success(result.message ?? "Thème enregistré.");
        if (redirectOnSuccess) {
          router.push(redirectOnSuccess);
          return;
        }
        onCancel?.();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'enregistrement a échoué.");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border bg-card p-6"
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {isEdit ? "Modifier le thème" : "Nouveau thème"}
        </h2>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-4" aria-hidden />
            Annuler
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="theme-name" error={errors.name}>
          <Input
            id="theme-name"
            placeholder="Mode Élégant"
            value={name}
            onChange={(event) => {
              const value = event.target.value;
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
            required
          />
        </Field>

        <Field label="Slug" htmlFor="theme-slug" error={errors.slug}>
          <Input
            id="theme-slug"
            placeholder="mode-elegant"
            className="font-mono"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
          />
        </Field>

        <Field
          label="Catégorie sectorielle"
          htmlFor="theme-category"
          error={errors.category}
        >
          <Select
            id="theme-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Sans catégorie</option>
            {THEME_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {THEME_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Description"
          htmlFor="theme-description"
          error={errors.description}
          hint="240 caractères maximum."
        >
          <textarea
            id="theme-description"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            maxLength={240}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Field
          label="Image d’aperçu"
          htmlFor="theme-preview"
          error={errors.previewUrl}
          hint="Upload vers Vercel Blob ou URL HTTPS."
        >
          <div className="space-y-2">
            <Input
              id="theme-preview"
              type="url"
              placeholder="https://…"
              value={previewUrl}
              onChange={(event) => setPreviewUrl(event.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Importer une image d’aperçu"
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {uploading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Upload vers Vercel Blob…
              </p>
            )}
            {!previewUrl && !uploading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImagePlus className="size-3.5" aria-hidden />
                Sans image, un aperçu dégradé est généré automatiquement.
              </p>
            )}
          </div>
        </Field>

        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPremium}
              onChange={(event) => setIsPremium(event.target.checked)}
              className="size-4 accent-primary"
            />
            <span>
              <span className="block font-medium">Thème premium</span>
              <span className="block text-xs text-muted-foreground">
                Mise en avant dans le catalogue et le sélecteur.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {isEdit ? "Enregistrer" : "Créer le thème"}
        </Button>
      </div>
    </form>
  );
}
