import { auth, currentUser } from "@clerk/nextjs/server";
import { Role, type User } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Retourne l'utilisateur Prisma lié au compte Clerk courant.
 * Si l'utilisateur n'existe pas en base, le crée (upsert) via Clerk API.
 * Réconcilie aussi les comptes `pending_*` par email.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) return null;

    // SUPER_ADMIN bootstrap
    const superAdminEmails = process.env.SUPER_ADMIN_EMAILS
      ?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) ?? [];

    const isSuperAdminEmail = superAdminEmails.includes(primaryEmail.toLowerCase());

    // Cherche un utilisateur existant avec cet email (réconciliation pending_*)
    const existingByEmail = await prisma.user.findUnique({
      where: { email: primaryEmail },
    });

    if (existingByEmail && existingByEmail.clerkId.startsWith("pending_")) {
      // Met à jour le clerkId du compte pending
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId: userId, role: isSuperAdminEmail ? Role.SUPER_ADMIN : existingByEmail.role },
      });
    } else if (existingByEmail) {
      // Conflit : un user existe avec cet email et un clerkId non-pending
      // Met à jour le clerkId existant (cas rare : changement d'email Clerk)
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId: userId },
      });
    } else {
      // Crée le nouvel utilisateur
      user = await prisma.user.create({
        data: {
          clerkId: userId,
          email: primaryEmail,
          role: isSuperAdminEmail ? Role.SUPER_ADMIN : Role.MEMBER,
        },
      });
    }
  }

  return user;
}

import { redirect } from "next/navigation";

/**
 * Exige un Super Admin : redirect si non connecté, profil absent,
 * ou rôle différent de SUPER_ADMIN.
 * (Appelé en début de rendu du layout /admin.)
 */
export async function requireSuperAdmin(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN) {
    redirect("/unauthorized");
  }

  if (user.disabled) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Exige un accès au tenant (SUPER_ADMIN ou membre du tenant).
 * Redirect si non connecté ou sans droit.
 */
export async function requireTenantAccess(tenantId: string): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.disabled) {
    redirect("/unauthorized");
  }

  // SUPER_ADMIN a accès à tout
  if (user.role === Role.SUPER_ADMIN) {
    return user;
  }

  // Vérifie l'appartenance au tenant
  const membership = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.id } },
  });

  if (!membership) {
    redirect("/unauthorized");
  }

  return user;
}

/**
 * Vérifie qu'un utilisateur possède un rôle donné.
 */
export function hasRole(user: Pick<User, "role">, role: Role): boolean {
  return user.role === role;
}
