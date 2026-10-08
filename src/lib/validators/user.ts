import { z } from "zod";

/**
 * Validateurs du module 9 (utilisateurs de la plateforme).
 */

export const PLATFORM_ROLES = ["SUPER_ADMIN", "ADMIN", "MEMBER"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Membre",
};

/** Invitation d'un compte (email + rôle initial). */
export const invitePlatformUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Adresse email invalide"),
  role: z.enum(PLATFORM_ROLES, {
    errorMap: () => ({ message: "Sélectionnez un rôle" }),
  }),
});

/** Changement de rôle. */
export const changePlatformRoleSchema = z.object({
  userId: z.string().cuid("Identifiant invalide"),
  role: z.enum(PLATFORM_ROLES, {
    errorMap: () => ({ message: "Rôle invalide" }),
  }),
});

/** Activation / désactivation d'un compte (module 9). */
export const setUserDisabledSchema = z.object({
  userId: z.string().cuid("Identifiant invalide"),
  disabled: z.boolean(),
});
