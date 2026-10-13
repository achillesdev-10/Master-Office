import { Role, type User } from "@prisma/client";

/**
 * Vérifie qu'un utilisateur possède un rôle donné.
 */
export function hasRole(user: Pick<User, "role">, role: Role): boolean {
  return user.role === role;
}