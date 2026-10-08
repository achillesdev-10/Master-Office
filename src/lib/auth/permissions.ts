import { auth } from "@clerk/nextjs/server";
import { Role, type User } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Retourne l'utilisateur Prisma lié au compte Clerk courant,
 * ou `null` si non connecté / pas encore synchronisé par le webhook.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  return prisma.user.findUnique({ where: { clerkId: userId } });
}

/**
 * Exige un Super Admin : throw si non connecté, profil absent,
 * ou rôle différent de SUPER_ADMIN.
 * (Appelé en début de rendu du layout /admin.)
 */
export async function requireSuperAdmin(): Promise<User> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Non authentifié.");
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    throw new Error(
      "Profil introuvable : le webhook Clerk n'a pas encore créé l'utilisateur.",
    );
  }

  if (user.role !== Role.SUPER_ADMIN) {
    throw new Error("Accès refusé : rôle Super Admin requis.");
  }

  if (user.disabled) {
    throw new Error("Accès refusé : ce compte est désactivé.");
  }

  return user;
}

/**
 * Vérifie qu'un utilisateur possède un rôle donné.
 */
export function hasRole(user: Pick<User, "role">, role: Role): boolean {
  return user.role === role;
}
