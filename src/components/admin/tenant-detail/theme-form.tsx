"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { updateTenantAppearance, uploadTenantLogo } from "@/lib/actions/tenants";
import type { TenantDetails } from "@/lib/db/queries/tenants";
import { cn } from "@/lib/utils";
import { Field } from "@/components/admin/tenant-form/field";
import { ThemePreview } from "@/components/admin/theme-preview";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ThemeOption = {
  id: string;
  name: string;
  slug: string;
  previewUrl: string | null;
  isPremium: boolean;
};

/**
 * Onglet « Thème » : sélection dans le catalogue + logo (Vercel Blob)
 * + couleur primaire, soumis en une seule action.
 */
export function ThemeForm({
  tenant,
  themes,
}: {
  tenant: TenantDetails;
  themes: ThemeOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [themeId, setThemeId] = useState(tenant.theme?.id ?? themes[0]?.id ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    tenant.primaryColor ?? "#4f46e5",
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    const result = await uploadTenantLogo(formData);
    setUploading(false);

    if (result.success && result.url) {
      setLogoUrl(result.url);
      toast.success("Logo importé.");
    } else if (!result.success) {
      toast.error(result.error ?? "L'upload du logo a échoué.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await updateTenantAppearance(tenant.id, {
        themeId,
        logoUrl,
        primaryColor,
      });
      if (result.success) {
        toast.success(result.message ?? "Apparence enregistrée.");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'enregistrement a échoué.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Thème de la boutique</legend>

        {themes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun thème disponible. Créez d’abord un thème dans{" "}
            <span className="font-medium text-foreground">Thèmes</span>.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => {
              const selected = themeId === theme.id;
              return (
                <label
                  key={theme.id}
                  htmlFor={`theme-${theme.id}`}
                  className={cn(
                    "cursor-pointer overflow-hidden rounded-lg border transition-colors hover:border-primary/50",
                    selected && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <input
                    id={`theme-${theme.id}`}
                    type="radio"
                    name="themeId"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setThemeId(theme.id)}
                  />

                  {/* Aperçu visuel du thème (module 11) */}
                  <span className="relative block">
                    <ThemePreview theme={theme} className="h-24" />
                    {theme.isPremium && (
                      <Badge
                        variant="warning"
                        className="absolute left-2 top-2 gap-1"
                      >
                        <Star className="size-3" aria-hidden />
                        Premium
                      </Badge>
                    )}
                  </span>

                  <span className="flex items-center justify-between gap-2 border-t px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {theme.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        /{theme.slug}
                      </span>
                    </span>
                    {selected && (
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {errors.themeId && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.themeId}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Logo"
          htmlFor="logoFile"
          error={errors.logoUrl}
          hint="PNG, JPG, SVG ou WebP — 2 Mo maximum."
        >
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Aperçu du logo"
                  className="size-full object-contain"
                />
              ) : (
                <ImagePlus aria-hidden className="size-5 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                id="logoFile"
                type="file"
                accept="image/*"
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              {uploading && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Upload vers Vercel Blob…
                </p>
              )}
            </div>
          </div>
        </Field>

        <div className="space-y-4">
          <Field
            label="URL du logo"
            htmlFor="logoUrl"
            error={errors.logoUrl}
            hint="Renseignée automatiquement après l'upload."
          >
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…/logo.png"
            />
          </Field>

          <Field
            label="Couleur primaire"
            htmlFor="primaryColor"
            error={errors.primaryColor}
          >
            <span className="flex items-center gap-2">
              <input
                id="primaryColor"
                type="color"
                aria-label="Sélecteur de couleur primaire"
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
              <Input
                aria-label="Valeur hexadécimale de la couleur primaire"
                className="w-32 font-mono"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
              <span
                aria-hidden
                className="size-9 rounded-md border"
                style={{ backgroundColor: primaryColor }}
              />
            </span>
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Enregistrement…" : "Enregistrer l'apparence"}
        </Button>
      </div>
    </form>
  );
}
