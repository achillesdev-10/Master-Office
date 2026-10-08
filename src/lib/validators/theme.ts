import { z } from "zod";
import { SLUG_REGEX } from "@/lib/validators/tenant";

/**
 * Validateurs du module 11 (catalogue des thèmes).
 */

/** Catégories sectorielles proposées à la création d’un thème. */
export const THEME_CATEGORIES = [
  "mode",
  "cosmetique",
  "electronique",
  "restaurant",
  "beaute",
  "maison",
  "sport",
  "alimentaire",
  "autre",
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

export const THEME_CATEGORY_LABELS: Record<ThemeCategory, string> = {
  mode: "Mode",
  cosmetique: "Cosmétique",
  electronique: "Électronique",
  restaurant: "Restaurant",
  beaute: "Beauté",
  maison: "Maison & décoration",
  sport: "Sport",
  alimentaire: "Alimentaire",
  autre: "Autre",
};

export const themeSchema = z.object({
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
    .regex(SLUG_REGEX, "Minuscules, chiffres et tirets (ex : mode-01)"),
  description: z
    .string()
    .trim()
    .max(240, "240 caractères maximum")
    .default(""),
  previewUrl: z
    .union([z.string().trim().url("URL invalide"), z.literal("")])
    .default(""),
  /** Module 11 : thème premium + catégorie sectorielle. */
  isPremium: z.boolean().default(false),
  category: z
    .union([z.enum(THEME_CATEGORIES), z.literal("")])
    .default(""),
});

/** Mise à jour d’un thème existant (id + champs du formulaire). */
export const updateThemeSchema = themeSchema.extend({
  id: z.string().cuid("Thème invalide"),
});

export type ThemeFormValues = z.infer<typeof themeSchema>;
