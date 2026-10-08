"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { updateSettings } from "@/lib/actions/settings";
import type { ActionFailure, FieldErrors } from "@/lib/actions/types";
import type { SettingsSnapshot } from "@/lib/db/queries/settings";
import {
  SETTINGS_SECTION_LABELS,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/lib/validators/settings";
import { cn } from "@/lib/utils";
import { Field } from "@/components/admin/tenant-form/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Onglets des paramètres (module 13) : un formulaire par section,
 * brouillons conservés lors des changements d’onglet, enregistrement
 * via `updateSettings` + toast + `router.refresh()`.
 */

type Drafts = Partial<Record<SettingsSection, Record<string, unknown>>>;

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown): boolean {
  return value === true;
}

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function SettingsTabs({ settings }: { settings: SettingsSnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<SettingsSection>("general");
  const [drafts, setDrafts] = useState<Drafts>({});
  const [errors, setErrors] = useState<FieldErrors>({});

  const draft = drafts[active];
  const values: Record<string, unknown> = {
    ...(settings[active] as Record<string, unknown>),
    ...(draft ?? {}),
  };
  const isDirty = draft !== undefined;
  const secrets = settings.secretsSet[active];

  const setValue = (key: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDrafts((prev) => ({
      ...prev,
      [active]: { ...values, [key]: value },
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const section = active;
    startTransition(async () => {
      const result = await updateSettings({ section, values });
      if (result.success) {
        setErrors({});
        setDrafts((prev) => ({ ...prev, [section]: undefined }));
        toast.success(result.message ?? "Paramètres enregistrés.");
        router.refresh();
      } else {
        setErrors((result as ActionFailure).fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  };

  const secretInput = (key: string, placeholder: string) => (
    <Input
      id={`${active}-${key}`}
      type="password"
      autoComplete="new-password"
      value={str(values[key])}
      onChange={(event) => setValue(key, event.target.value)}
      placeholder={
        secrets[key] ? `${placeholder} (configuré — vide = conserver)` : placeholder
      }
      aria-invalid={Boolean(errors[key])}
    />
  );

  const secretHint = (key: string) =>
    secrets[key]
      ? "Secret actuellement stocké (chiffré). Laissez vide pour le conserver."
      : "Aucun secret enregistré pour l’instant.";

  const renderFields = () => {
    switch (active) {
      case "general":
        return (
          <>
            <Field
              label="Nom de la plateforme"
              htmlFor="general-platformName"
              error={errors.platformName}
            >
              <Input
                id="general-platformName"
                value={str(values.platformName)}
                onChange={(event) => setValue("platformName", event.target.value)}
                aria-invalid={Boolean(errors.platformName)}
              />
            </Field>
            <Field
              label="Domaine racine"
              htmlFor="general-rootDomain"
              error={errors.rootDomain}
              hint="Utilisé pour les sous-domaines des boutiques (module 14)."
            >
              <Input
                id="general-rootDomain"
                value={str(values.rootDomain)}
                onChange={(event) => setValue("rootDomain", event.target.value)}
                aria-invalid={Boolean(errors.rootDomain)}
              />
            </Field>
            <Field
              label="Email de support"
              htmlFor="general-supportEmail"
              error={errors.supportEmail}
            >
              <Input
                id="general-supportEmail"
                type="email"
                value={str(values.supportEmail)}
                onChange={(event) => setValue("supportEmail", event.target.value)}
                aria-invalid={Boolean(errors.supportEmail)}
              />
            </Field>
            <Field
              label="Devise par défaut"
              htmlFor="general-defaultCurrency"
              error={errors.defaultCurrency}
              hint="Code ISO 3 lettres : EUR, USD…"
            >
              <Input
                id="general-defaultCurrency"
                value={str(values.defaultCurrency)}
                onChange={(event) => setValue("defaultCurrency", event.target.value)}
                aria-invalid={Boolean(errors.defaultCurrency)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={bool(values.maintenanceMode)}
                onChange={(event) => setValue("maintenanceMode", event.target.checked)}
              />
              Mode maintenance (boutiques en construction)
            </label>
          </>
        );

      case "emails":
        return (
          <>
            <Field
              label="Nom expéditeur"
              htmlFor="emails-fromName"
              error={errors.fromName}
            >
              <Input
                id="emails-fromName"
                value={str(values.fromName)}
                onChange={(event) => setValue("fromName", event.target.value)}
                aria-invalid={Boolean(errors.fromName)}
              />
            </Field>
            <Field
              label="Email expéditeur"
              htmlFor="emails-fromEmail"
              error={errors.fromEmail}
            >
              <Input
                id="emails-fromEmail"
                type="email"
                value={str(values.fromEmail)}
                onChange={(event) => setValue("fromEmail", event.target.value)}
                aria-invalid={Boolean(errors.fromEmail)}
              />
            </Field>
            <Field
              label="Hôte SMTP"
              htmlFor="emails-smtpHost"
              error={errors.smtpHost}
            >
              <Input
                id="emails-smtpHost"
                placeholder="smtp.example.com"
                value={str(values.smtpHost)}
                onChange={(event) => setValue("smtpHost", event.target.value)}
                aria-invalid={Boolean(errors.smtpHost)}
              />
            </Field>
            <Field
              label="Port SMTP"
              htmlFor="emails-smtpPort"
              error={errors.smtpPort}
            >
              <Input
                id="emails-smtpPort"
                type="number"
                min={1}
                max={65535}
                value={num(values.smtpPort)}
                onChange={(event) => setValue("smtpPort", event.target.value)}
                aria-invalid={Boolean(errors.smtpPort)}
              />
            </Field>
            <Field
              label="Utilisateur SMTP"
              htmlFor="emails-smtpUser"
              error={errors.smtpUser}
            >
              <Input
                id="emails-smtpUser"
                value={str(values.smtpUser)}
                onChange={(event) => setValue("smtpUser", event.target.value)}
                aria-invalid={Boolean(errors.smtpUser)}
              />
            </Field>
            <Field
              label="Mot de passe SMTP"
              htmlFor="emails-smtpPassword"
              error={errors.smtpPassword}
              hint={secretHint("smtpPassword")}
            >
              {secretInput("smtpPassword", "Laisser vide pour conserver")}
            </Field>
          </>
        );

      case "payments":
        return (
          <>
            <Field
              label="Clé publiable Stripe"
              htmlFor="payments-stripePublicKey"
              error={errors.stripePublicKey}
              hint="pk_live_… / pk_test_…"
            >
              <Input
                id="payments-stripePublicKey"
                value={str(values.stripePublicKey)}
                onChange={(event) => setValue("stripePublicKey", event.target.value)}
                aria-invalid={Boolean(errors.stripePublicKey)}
              />
            </Field>
            <Field
              label="Clé secrète Stripe"
              htmlFor="payments-stripeSecretKey"
              error={errors.stripeSecretKey}
              hint={secretHint("stripeSecretKey")}
            >
              {secretInput("stripeSecretKey", "sk_… (jamais affichée)")}
            </Field>
            <Field
              label="Secret webhook Stripe"
              htmlFor="payments-stripeWebhookSecret"
              error={errors.stripeWebhookSecret}
              hint={secretHint("stripeWebhookSecret")}
            >
              {secretInput("stripeWebhookSecret", "whsec_…")}
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={bool(values.testMode)}
                onChange={(event) => setValue("testMode", event.target.checked)}
              />
              Mode test Stripe (aucun paiement réel)
            </label>
          </>
        );

      case "integrations":
        return (
          <>
            <Field
              label="URL Redis"
              htmlFor="integrations-redisUrl"
              error={errors.redisUrl}
              hint={`${secretHint("redisUrl")} Utilisé par le cache (module 14).`}
            >
              {secretInput("redisUrl", "redis://…")}
            </Field>
            <Field
              label="DSN Sentry"
              htmlFor="integrations-sentryDsn"
              error={errors.sentryDsn}
            >
              <Input
                id="integrations-sentryDsn"
                placeholder="https://…@o0.ingest.sentry.io/0"
                value={str(values.sentryDsn)}
                onChange={(event) => setValue("sentryDsn", event.target.value)}
                aria-invalid={Boolean(errors.sentryDsn)}
              />
            </Field>
            <Field
              label="ID de suivi analytics"
              htmlFor="integrations-analyticsId"
              error={errors.analyticsId}
            >
              <Input
                id="integrations-analyticsId"
                value={str(values.analyticsId)}
                onChange={(event) => setValue("analyticsId", event.target.value)}
                aria-invalid={Boolean(errors.analyticsId)}
              />
            </Field>
          </>
        );

      case "security":
        return (
          <>
            <Field
              label="Durée de session (heures)"
              htmlFor="security-sessionTimeoutHours"
              error={errors.sessionTimeoutHours}
            >
              <Input
                id="security-sessionTimeoutHours"
                type="number"
                min={1}
                max={720}
                value={num(values.sessionTimeoutHours)}
                onChange={(event) =>
                  setValue("sessionTimeoutHours", event.target.value)
                }
                aria-invalid={Boolean(errors.sessionTimeoutHours)}
              />
            </Field>
            <Field
              label="Rétention du journal (jours)"
              htmlFor="security-auditRetentionDays"
              error={errors.auditRetentionDays}
              hint="Au-delà, les entrées du journal sont purgées."
            >
              <Input
                id="security-auditRetentionDays"
                type="number"
                min={7}
                max={3650}
                value={num(values.auditRetentionDays)}
                onChange={(event) =>
                  setValue("auditRetentionDays", event.target.value)
                }
                aria-invalid={Boolean(errors.auditRetentionDays)}
              />
            </Field>
            <Field
              label="Liste blanche IP"
              htmlFor="security-ipAllowlist"
              error={errors.ipAllowlist}
              hint="Une IP ou CIDR par ligne. Vide = toutes les IP."
            >
              <textarea
                id="security-ipAllowlist"
                className={TEXTAREA_CLASS}
                value={str(values.ipAllowlist)}
                onChange={(event) => setValue("ipAllowlist", event.target.value)}
                placeholder={"192.0.2.10\n10.0.0.0/8"}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={bool(values.require2fa)}
                onChange={(event) => setValue("require2fa", event.target.checked)}
              />
              2FA obligatoire pour les Super Admins
            </label>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Sections des paramètres"
        className="flex gap-1 overflow-x-auto border-b"
      >
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section}
            role="tab"
            type="button"
            aria-selected={active === section}
            onClick={() => {
              setActive(section);
              setErrors({});
            }}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active === section
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {SETTINGS_SECTION_LABELS[section]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            {SETTINGS_SECTION_LABELS[active]}
          </h2>
          {isDirty && <Badge variant="warning">Modifications non enregistrées</Badge>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">{renderFields()}</div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Secrets chiffrés AES-256-GCM — jamais affichés.
          </p>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
