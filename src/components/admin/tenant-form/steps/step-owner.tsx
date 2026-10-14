import { COUNTRIES } from "@/lib/validators/tenant";
import { Field } from "../field";
import { Input, Select } from "@/components/ui/input";
import type { StepProps } from "../types";

/** Étape 1 — Propriétaire : nom, email, téléphone WhatsApp, pays. */
export function StepOwner({ values, onChange, errors }: StepProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom du propriétaire" htmlFor="contactName" error={errors.contactName}>
        <Input
          id="contactName"
          autoComplete="name"
          placeholder="Marie Dupont"
          value={values.contactName}
          onChange={(event) => onChange({ contactName: event.target.value })}
        />
      </Field>

      <Field
        label="Email du propriétaire"
        htmlFor="contactEmail"
        error={errors.contactEmail}
        hint="Reçu pour l'invitation à la boutique"
      >
        <Input
          id="contactEmail"
          type="email"
          autoComplete="email"
          placeholder="marie@exemple.com"
          value={values.contactEmail}
          onChange={(event) => onChange({ contactEmail: event.target.value })}
        />
      </Field>

      <Field
        label="Numéro WhatsApp"
        htmlFor="contactPhone"
        error={errors.contactPhone}
        hint="Format: 07 01 02 03 04 ou +225 07 01 02 03 04"
      >
        <Input
          id="contactPhone"
          type="tel"
          autoComplete="tel"
          placeholder="07 01 02 03 04"
          value={values.contactPhone}
          onChange={(event) => onChange({ contactPhone: event.target.value })}
        />
      </Field>

      <Field label="Pays" htmlFor="contactCountry" error={errors.contactCountry}>
        <Select
          id="contactCountry"
          value={values.contactCountry}
          onChange={(event) => onChange({ contactCountry: event.target.value })}
        >
          <option value="">Sélectionnez un pays…</option>
          {COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}