import { Field } from "../field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "../types";

/** Étape 4 — Domaine personnalisé (facultatif). */
export function StepCustomDomain({ values, onChange, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
        <p className="text-sm font-medium">Domaine personnalisé (facultatif)</p>
        <p className="text-xs text-muted-foreground">
          Si vous possédez déjà un nom de domaine (ex: <code className="font-mono">ma-boutique.com</code>),
          vous pouvez l&apos;ajouter ici. Il faudra ensuite configurer les DNS chez votre registrar.
          Sinon, la boutique sera accessible via le sous-domaine automatique&nbsp;:
          <code className="font-mono">{values.slug || "mon-slug"}&nbsp;.maboutique.com</code>.
        </p>
      </div>

      <Field
        label="Votre domaine"
        htmlFor="customDomain"
        error={errors.customDomain}
        hint="Ex: shop.maboutique.com, maboutique.ci"
      >
        <Input
          id="customDomain"
          placeholder="ma-boutique.com"
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
          value={values.customDomain}
          onChange={(event) => onChange({ customDomain: event.target.value.toLowerCase() })}
        />
      </Field>

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium mb-1">DNS à configurer chez votre registrar :</p>
        <ul className="space-y-1 pl-4 list-disc">
          <li>Type : <code className="font-mono">CNAME</code></li>
          <li>Hôte : <code className="font-mono">{values.customDomain || "votre-domaine.com"}</code></li>
          <li>Valeur : <code className="font-mono">cname.vercel-dns.com</code></li>
          <li>TTL : <code className="font-mono">3600</code></li>
        </ul>
      </div>
    </div>
  );
}