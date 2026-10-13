import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { Role } from "@prisma/client";

/**
 * Page de redirection post-connexion (Server Component).
 *
 * - SUPER_ADMIN → /admin/dashboard
 * - Propriétaire avec au moins un membership → /dashboard
 * - Sinon → /unauthorized
 */
export default async function AuthRedirectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  // Récupère l'utilisateur Clerk complet (email, etc.)
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/unauthorized");
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) {
    redirect("/unauthorized");
  }

  // SUPER_ADMIN bootstrap : emails listés dans SUPER_ADMIN_EMAILS
  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS
    ?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const isSuperAdminEmail = superAdminEmails.includes(primaryEmail.toLowerCase());

  // Cherche ou crée l'utilisateur en base (upsert)
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { tenantUsers: true },
  });

  if (!user) {
    // Crée l'utilisateur s'il n'existe pas
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: primaryEmail,
        role: isSuperAdminEmail ? Role.SUPER_ADMIN : Role.MEMBER,
      },
      include: { tenantUsers: true },
    });
  } else if (isSuperAdminEmail && user.role !== Role.SUPER_ADMIN) {
    // Met à jour le rôle si l'email est dans SUPER_ADMIN_EMAILS
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.SUPER_ADMIN },
      include: { tenantUsers: true },
    });
  }

  // Réconcilie les comptes pending_* par email
  const pendingUsers = await prisma.user.findMany({
    where: {
      email: primaryEmail,
      clerkId: { startsWith: "pending_" },
    },
  });

  for (const pending of pendingUsers) {
    // Transfère les memberships vers le vrai compte
    await prisma.tenantUser.updateMany({
      where: { userId: pending.id },
      data: { userId: user.id },
    });
    // Supprime le compte pending
    await prisma.user.delete({ where: { id: pending.id } });
  }

  // Recharge avec les memberships mis à jour
  user = await prisma.user.findUnique({
    where: { id: user.id },
    include: { tenantUsers: true },
  });

  if (!user) {
    redirect("/unauthorized");
  }

  // Compte désactivé
  if (user.disabled) {
    redirect("/unauthorized");
  }

  // SUPER_ADMIN → admin dashboard
  if (user.role === Role.SUPER_ADMIN) {
    redirect("/admin/dashboard");
  }

  // Propriétaire avec au moins une boutique → dashboard propriétaire
  if (user.tenantUsers.length > 0) {
    redirect("/dashboard");
  }

  // Sinon non autorisé
  redirect("/unauthorized");
}