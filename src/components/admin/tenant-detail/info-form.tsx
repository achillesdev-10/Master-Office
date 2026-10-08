"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateTenantInfo } from "@/lib/actions/tenants";
import type { TenantDetails } from "@/lib/db/queries/tenants";
import {
  COUNTRIES,
  CURRENCIES,
  CURRENCY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  TIMEZONES,
} from "@/lib/validators/tenant";
import { Field } from "@/components/admin/tenant-form/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Values = {
  name: string;
  description: string;
  currency: string;
  language: string;
  timezone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCountry: string;
};

/** Onglet « Infos » : formulaire piloté par état local + Server Action. */
export function InfoForm({ tenant }: { tenant: TenantDetails }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Values>({
    name: tenant.name,
    description: tenant.description ?? "",
    currency: tenant.currency,
    language: tenant.language,
    timezone: tenant.timezone,
    contactName: tenant.contactName ?? "",
    contactEmail: tenant.contactEmail ?? "",
    contactPhone: tenant.contactPhone ?? "",
    contactCountry: tenant.contactCountry ?? "France",
  });

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await updateTenantInfo(tenant.id, values);
      if (result.success) {
        toast.success(result.message ?? "Informations enregistrées.");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error ?? "L'enregistrement a échoué.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la boutique" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          error={errors.description}
          hint="280 caractères maximum."
        >
          <Input
            id="description"
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={280}
            placeholder="Boutique de prêt-à-porter…"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Devise" htmlFor="currency" error={errors.currency}>
          <Select
            id="currency"
            value={values.currency}
            onChange={(event) => set("currency", event.target.value)}
          >
            {CURRENCIES.map((value) => (
              <option key={value} value={value}>
                {CURRENCY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Langue" htmlFor="language" error={errors.language}>
          <Select
            id="language"
            value={values.language}
            onChange={(event) => set("language", event.target.value)}
          >
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Fuseau horaire" htmlFor="timezone" error={errors.timezone}>
          <Select
            id="timezone"
            value={values.timezone}
            onChange={(event) => set("timezone", event.target.value)}
          >
            {TIMEZONES.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom du client"
          htmlFor="contactName"
          error={errors.contactName}
        >
          <Input
            id="contactName"
            value={values.contactName}
            onChange={(event) => set("contactName", event.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </Field>

        <Field
          label="Email du client"
          htmlFor="contactEmail"
          error={errors.contactEmail}
        >
          <Input
            id="contactEmail"
            type="email"
            value={values.contactEmail}
            onChange={(event) => set("contactEmail", event.target.value)}
            required
          />
        </Field>

        <Field
          label="Téléphone"
          htmlFor="contactPhone"
          error={errors.contactPhone}
        >
          <Input
            id="contactPhone"
            value={values.contactPhone}
            onChange={(event) => set("contactPhone", event.target.value)}
            maxLength={32}
            placeholder="+33 6 12 34 56 78"
          />
        </Field>

        <Field label="Pays" htmlFor="contactCountry" error={errors.contactCountry}>
          <Select
            id="contactCountry"
            value={values.contactCountry}
            onChange={(event) => set("contactCountry", event.target.value)}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Dernière modification le{" "}
          {new Date(tenant.updatedAt).toLocaleDateString("fr-FR")}.
        </p>
      </div>
    </form>
  );
}
