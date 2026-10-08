import { z } from "zod";

/**
 * Paramètres de la plateforme (module 13) — 5 sections :
 * Général, Emails, Paiements, Intégrations, Sécurité.
 *
 * Chaque section possède son propre schéma Zod ; les champs secrets
 * (`SETTINGS_SECRET_KEYS`) sont chiffrés en base et jamais renvoyés au client.
 */

export const SETTINGS_SECTIONS = [
  "general",
  "emails",
  "payments",
  "integrations",
  "security",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: "Général",
  emails: "Emails",
  payments: "Paiements",
  integrations: "Intégrations",
  security: "Sécurité",
};

/** Préfixe des clés `PlatformSetting` : `settings.<section>`. */
export const SETTINGS_KEY_PREFIX = "settings.";

const emailField = z
  .string()
  .trim()
  .min(3, "Adresse trop courte.")
  .max(160, "Adresse trop longue.")
  .email("Adresse email invalide.");

const domainField = z
  .string()
  .trim()
  .min(3, "Domaine trop court.")
  .max(255, "Domaine trop long.")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    "Domaine invalide (ex. maboutique.com).",
  );

const currencyField = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Code ISO 3 lettres (ex. EUR).")
  .transform((value) => value.toUpperCase());

const urlField = z.string().trim().max(500, "Valeur trop longue.");

export const generalSettingsSchema = z.object({
  platformName: z
    .string()
    .trim()
    .min(2, "Nom trop court.")
    .max(80, "Nom trop long."),
  rootDomain: domainField,
  supportEmail: emailField,
  defaultCurrency: currencyField,
  maintenanceMode: z.boolean(),
});

export const emailsSettingsSchema = z.object({
  fromName: z.string().trim().min(1, "Nom requis.").max(80, "Nom trop long."),
  fromEmail: emailField,
  smtpHost: z.string().trim().max(255, "Hôte trop long."),
  smtpPort: z.coerce
    .number({ invalid_type_error: "Port invalide." })
    .int("Port invalide.")
    .min(1, "Port invalide.")
    .max(65535, "Port invalide."),
  smtpUser: z.string().trim().max(160, "Utilisateur trop long."),
  smtpPassword: z.string().max(300, "Mot de passe trop long."),
});

export const paymentsSettingsSchema = z.object({
  stripePublicKey: urlField,
  stripeSecretKey: z.string().max(300, "Clé trop longue."),
  stripeWebhookSecret: z.string().max(300, "Secret trop long."),
  testMode: z.boolean(),
});

export const integrationsSettingsSchema = z.object({
  redisUrl: urlField,
  sentryDsn: urlField,
  analyticsId: z.string().trim().max(120, "Identifiant trop long."),
});

export const securitySettingsSchema = z.object({
  require2fa: z.boolean(),
  sessionTimeoutHours: z.coerce
    .number({ invalid_type_error: "Valeur invalide." })
    .int("Valeur invalide.")
    .min(1, "Minimum 1 heure.")
    .max(720, "Maximum 720 heures."),
  auditRetentionDays: z.coerce
    .number({ invalid_type_error: "Valeur invalide." })
    .int("Valeur invalide.")
    .min(7, "Minimum 7 jours.")
    .max(3650, "Maximum 3650 jours."),
  ipAllowlist: z.string().trim().max(4000, "Liste trop longue."),
});

export const settingsSchemas = {
  general: generalSettingsSchema,
  emails: emailsSettingsSchema,
  payments: paymentsSettingsSchema,
  integrations: integrationsSettingsSchema,
  security: securitySettingsSchema,
} as const;

/** Champs secrets : chiffrés AES-256-GCM côté serveur, masqués côté client. */
export const SETTINGS_SECRET_KEYS: Record<SettingsSection, readonly string[]> = {
  general: [],
  emails: ["smtpPassword"],
  payments: ["stripeSecretKey", "stripeWebhookSecret"],
  integrations: ["redisUrl"],
  security: [],
};

/** Valeurs par défaut affichées avant le premier enregistrement. */
export const SETTINGS_DEFAULTS = {
  general: {
    platformName: "Master Admin",
    rootDomain: "maboutique.com",
    supportEmail: "support@maboutique.com",
    defaultCurrency: "EUR",
    maintenanceMode: false,
  },
  emails: {
    fromName: "Master Admin",
    fromEmail: "no-reply@maboutique.com",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
  },
  payments: {
    stripePublicKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    testMode: true,
  },
  integrations: {
    redisUrl: "",
    sentryDsn: "",
    analyticsId: "",
  },
  security: {
    require2fa: false,
    sessionTimeoutHours: 24,
    auditRetentionDays: 90,
    ipAllowlist: "",
  },
} as const;

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type EmailSettings = z.infer<typeof emailsSettingsSchema>;
export type PaymentSettings = z.infer<typeof paymentsSettingsSchema>;
export type IntegrationSettings = z.infer<typeof integrationsSettingsSchema>;
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    typeof value === "string" &&
    (SETTINGS_SECTIONS as readonly string[]).includes(value)
  );
}
