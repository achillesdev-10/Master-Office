import { z } from "zod";
import { SLUG_REGEX } from "@/lib/validators/tenant";

/**
 * Validateurs du module 10 (abonnements & plans).
 */

export const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const;
export type SubscriptionStatusKey = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatusKey, string> =
  {
    TRIAL: "Essai",
    ACTIVE: "Actif",
    PAST_DUE: "Impayé",
    CANCELLED: "Résilié",
  };

/** Création d’un plan. */
export const planSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "2 caractères minimum")
    .max(60, "60 caractères maximum"),
  slug: z
    .string()
    .trim()
    .min(2, "2 caractères minimum")
    .max(48, "48 caractères maximum")
    .regex(SLUG_REGEX, "Minuscules, chiffres et tirets (ex : starter)"),
  /** Prix mensuel en centimes (module 10). */
  price: z
    .number()
    .int("Prix entier (centimes)")
    .min(0, "Prix positif")
    .max(1_000_000_00, "Prix trop élevé"),
  currency: z
    .string()
    .trim()
    .length(3, "Code ISO à 3 lettres (ex : EUR)"),
  /** Liste de features (une par ligne côté UI). */
  features: z
    .array(z.string().trim().min(1).max(120))
    .max(10, "10 features maximum")
    .default([]),
});

/** Mise à jour d’un plan existant. */
export const updatePlanSchema = planSchema.extend({
  id: z.string().cuid("Plan invalide"),
});

/** Attribution / changement de plan d’une boutique. */
export const assignPlanSchema = z.object({
  tenantId: z.string().cuid("Boutique invalide"),
  planId: z.string().cuid("Plan invalide"),
});

/** Changement de statut d’un abonnement. */
export const subscriptionStatusSchema = z.object({
  subscriptionId: z.string().cuid("Abonnement invalide"),
  status: z.enum(SUBSCRIPTION_STATUSES, {
    errorMap: () => ({ message: "Statut invalide" }),
  }),
});

/** Durée d’une période de facturation (jours). */
export const BILLING_PERIOD_DAYS = 30;
