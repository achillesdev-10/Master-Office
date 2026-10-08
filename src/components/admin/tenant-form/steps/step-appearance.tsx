import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadTenantLogo } from "@/lib/actions/tenants";
import { Field } from "../field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "../types";

/** Étape 7 — Apparence : logo (Vercel Blob) + couleur primaire. */
export function StepAppearance({ values, onChange, errors }: StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    const result = await uploadTenantLogo(formData);
    setUploading(false);

    if (result.success) {
      if (result.url) {
        onChange({ logoUrl: result.url });
        toast.success("Logo importé.");
      } else {
        toast.error("L'upload n'a pas renvoyé d'URL.");
      }
    } else {
      toast.error(result.error ?? "L'upload du logo a échoué.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Logo"
        htmlFor="logoFile"
        error={errors.logoUrl}
        hint="PNG, JPG, SVG ou WebP — 2 Mo maximum."
      >
        <div className="flex items-center gap-3">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {values.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={values.logoUrl}
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
            placeholder="https://…/logo.png"
            value={values.logoUrl}
            onChange={(event) => onChange({ logoUrl: event.target.value })}
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
              value={values.primaryColor}
              onChange={(event) =>
                onChange({ primaryColor: event.target.value })
              }
            />
            <Input
              aria-label="Valeur hexadécimale de la couleur primaire"
              className="w-32 font-mono"
              value={values.primaryColor}
              onChange={(event) =>
                onChange({ primaryColor: event.target.value })
              }
            />
            <span
              aria-hidden
              className="size-9 rounded-md border"
              style={{ backgroundColor: values.primaryColor }}
            />
          </span>
        </Field>
      </div>
    </div>
  );
}
