import { z } from "zod";

/**
 * Validateurs Zod du module 6 (wizard de création de boutique).
 *
 * Un schéma par étape + le schéma global combiné utilisé par la
 * Server Action `createTenant` — aucune donnée n'est écrite sans
 * validation.
 */

// ======================== CONSTANTES UI ==========================

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PAYMENT_PROVIDERS = [
  "orange_money",
  "mtn_money",
  "moov_money",
  "wave",
  "cod",
  "bank_transfer",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  moov_money: "Moov Money",
  wave: "Wave",
  cod: "Paiement à la livraison",
  bank_transfer: "Virement bancaire",
};

export const CURRENCIES = [
  "XOF",
  "EUR",
  "USD",
] as const;

export const CURRENCY_LABELS: Record<(typeof CURRENCIES)[number], string> = {
  XOF: "Franc CFA (XOF)",
  EUR: "Euro (EUR)",
  USD: "Dollar US (USD)",
};

export const LANGUAGES = ["fr", "en"] as const;

export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  fr: "Français",
  en: "English",
};

export const TIMEZONES = [
  "Africa/Abidjan",
  "Africa/Dakar",
  "Africa/Lome",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Europe/Paris",
] as const;

export const COUNTRIES = [
  "Côte d'Ivoire",
  "Sénégal",
  "Togo",
  "Bénin",
  "Cameroun",
  "Maroc",
  "Tunisie",
  "France",
] as const;

// ======================== ÉTAPES =================================

/** Étape 1 — Client */
export const clientStepSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Le nom du client doit faire au moins 2 caractères")
    .max(120, "120 caractères maximum"),
  contactEmail: z.string().trim().email("Adresse email invalide"),
  contactPhone: z
    .string()
    .trim()
    .max(32, "32 caractères maximum")
    .optional()
    .or(z.literal("")),
  contactCountry: z.string().min(2, "Sélectionnez un pays"),
});

/** Étape 2 — Boutique */
export const storeStepSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la boutique doit faire au moins 2 caractères")
    .max(80, "80 caractères maximum"),
  slug: z
    .string()
    .trim()
    .min(3, "Le slug doit faire au moins 3 caractères")
    .max(48, "48 caractères maximum")
    .regex(
      SLUG_REGEX,
      "Minuscules, chiffres et tirets uniquement (ex : ma-boutique)",
    ),
  description: z
    .string()
    .trim()
    .max(280, "280 caractères maximum")
    .optional()
    .or(z.literal("")),
});

/** Étape 3 — Configuration */
export const configurationStepSchema = z.object({
  currency: z.enum(CURRENCIES, {
    errorMap: () => ({ message: "Sélectionnez une devise" }),
  }),
  language: z.enum(LANGUAGES, {
    errorMap: () => ({ message: "Sélectionnez une langue" }),
  }),
  timezone: z.string().min(1, "Sélectionnez un fuseau horaire"),
});

/** Étape 4 — Thème */
export const themeStepSchema = z.object({
  themeId: z.string().min(1, "Sélectionnez un thème"),
});

/** Étape 5 — Paiements */
export const paymentsStepSchema = z.object({
  providers: z
    .array(z.enum(PAYMENT_PROVIDERS))
    .min(1, "Activez au moins un moyen de paiement"),
});

/** Étape 6 — Livraison (prix en centimes) */
export const shippingStepSchema = z.object({
  methods: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Nom de méthode requis").max(80),
        price: z
          .number({ invalid_type_error: "Prix invalide" })
          .int("Prix invalide")
          .min(0, "Prix négatif")
          .max(999999, "Prix trop élevé"),
        enabled: z.boolean(),
      }),
    )
    .min(1, "Ajoutez au moins une méthode de livraison"),
});

/** Étape 7 — Apparence */
export const appearanceStepSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .url("URL invalide (https://…)")
    .optional()
    .or(z.literal("")),
  primaryColor: z
    .string()
    .regex(
      /^#(?:[0-9a-fA-F]{3}){1,2}$/,
      "Couleur hexadécimale attendue (ex : #4f46e5)",
    ),
});

// ======================== COMBINAISON ============================

/** Schéma global : les 7 étapes fusionnées. */
export const createTenantSchema = clientStepSchema
  .merge(storeStepSchema)
  .merge(configurationStepSchema)
  .merge(themeStepSchema)
  .merge(paymentsStepSchema)
  .merge(shippingStepSchema)
  .merge(appearanceStepSchema);

/** Schémas indexés par étape (0 → 6), utilisés par le wizard. */
export const tenantStepSchemas = [
  clientStepSchema,
  storeStepSchema,
  configurationStepSchema,
  themeStepSchema,
  paymentsStepSchema,
  shippingStepSchema,
  appearanceStepSchema,
] as const;

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ======================== MODULE 7 (DÉTAIL) ======================

/** Booléen issu d'un formulaire HTML (case cochée = "on"). */
const checkboxSchema = z.preprocess(
  (value) => value === true || value === "on",
  z.boolean(),
);

/**
 * Onglet « Infos » : mêmes règles que le wizard, sans le slug
 * (immuable après création).
 */
export const updateTenantInfoSchema = clientStepSchema
  .merge(storeStepSchema)
  .merge(configurationStepSchema)
  .omit({ slug: true });

/** Onglet « Thème » : thème + apparence (logo, couleur principale). */
export const updateThemeSchema = themeStepSchema.merge(appearanceStepSchema);

/** Onglet « Paiements » : activation d'un provider + clé API facultative. */
export const paymentSettingsSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS, {
    errorMap: () => ({ message: "Provider de paiement inconnu" }),
  }),
  enabled: checkboxSchema,
  /** Si vide, la clé existante est conservée. */
  apiKey: z
    .string()
    .trim()
    .max(255, "255 caractères maximum")
    .optional()
    .or(z.literal("")),
});

/** Onglet « Livraison » : création / mise à jour d'une méthode. */
export const shippingMethodSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum"),
  price: z.coerce
    .number({ invalid_type_error: "Prix invalide" })
    .int("Prix invalide")
    .min(0, "Prix négatif")
    .max(999999, "Prix trop élevé"),
  enabled: checkboxSchema,
});

/** Rôles attribuables aux membres d'une boutique. */
export const TENANT_ROLES = ["ADMIN", "MEMBER"] as const;
export const TENANT_ROLE_LABELS: Record<
  (typeof TENANT_ROLES)[number],
  string
> = {
  ADMIN: "Administrateur",
  MEMBER: "Membre",
};

/** Onglet « Utilisateurs » : invitation par email. */
export const inviteUserSchema = z.object({
  email: z.string().trim().email("Adresse email invalide"),
  role: z.enum(TENANT_ROLES, {
    errorMap: () => ({ message: "Sélectionnez un rôle" }),
  }),
});

/** Changement de rôle d'un membre déjà présent. */
export const changeRoleSchema = z.object({
  userId: z.string().cuid("Identifiant invalide"),
  role: z.enum(TENANT_ROLES, {
    errorMap: () => ({ message: "Rôle invalide" }),
  }),
});

/** Confirmation de la zone de danger (saisie du nom exact). */
export const confirmNameSchema = z.string().trim().min(1, "Nom requis");

// ======================== HELPERS ================================

/** Slug généré depuis le nom (éditable dans le wizard). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Validation d'un slug seul (vérification d'unicité en temps réel). */
export const slugOnlySchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum")
  .max(48, "48 caractères maximum")
  .regex(SLUG_REGEX, "Format invalide");

/**
 * Aplatissement des erreurs Zod v3 :
 *  - `fieldErrors` : clé = chemin pointé ("contactName", "methods.0.name"),
 *    valeur = premier message du champ ;
 *  - `formError` : message général (première erreur, ou message générique).
 */
export function flattenErrors(error: z.ZodError): {
  fieldErrors: Record<string, string>;
  formError: string;
} {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }

  return {
    fieldErrors,
    formError:
      fieldErrors["_form"] ??
      error.issues[0]?.message ??
      "Certains champs du formulaire sont invalides.",
  };
}