"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { Role, type User } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { flattenErrors } from "@/lib/validators/tenant";
import { failure } from "@/lib/actions/types";
import type { ActionResult } from "@/lib/actions/types";
import {
  changePlatformRoleSchema,
  invitePlatformUserSchema,
  setUserDisabledSchema,
} from "@/lib/validators/user";

/**
 * Server Actions du module 9 (utilisateurs de la plateforme).
 *
 * Règles de protection :
 *  - jamais de suppression ni de rétrogradation du dernier SUPER_ADMIN ;
 *  - un Super Admin ne peut pas supprimer son propre compte ;
 *  - toute mutation est auditée (`logAction`).
 */

const idSchema = z.string().cuid("Identifiant invalide");

async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[users] accès refusé", error);
    return null;
  }
}

async function countSuperAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
}

/** Invitation Clerk (instance) — jamais bloquante. */
async function sendInstanceInvitation(email: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    return true;
  } catch (error) {
    console.error("[users] invitation Clerk impossible", error);
    return false;
  }
}

/** Synchronise le rôle dans les metadata privées Clerk (best effort). */
async function syncClerkRoleMetadata(
  clerkId: string,
  role: string,
): Promise<void> {
  if (clerkId.startsWith("pending_")) return;
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      privateMetadata: { role },
    });
  } catch (error) {
    console.error("[users] sync metadata Clerk impossible", error);
  }
}

/** Invalide la liste des utilisateurs + le dashboard. */
function revalidateUsers(): void {
  revalidatePath("/admin/users");
  revalidateTag("dashboard");
  revalidatePath("/admin/dashboard");
}

/** Invite un compte : création du profil provisoire + email Clerk. */
export async function invitePlatformUser(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = invitePlatformUserSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const email = parsed.data.email;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return failure("Un compte existe déjà avec cet email.", {
        email: "Compte déjà existant.",
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        role: parsed.data.role,
        clerkId: `pending_${Date.now()}`,
      },
      select: { id: true },
    });

    const invited = await sendInstanceInvitation(email);

    await logAction({
      action: "user.invite",
      userId: admin.id,
      entity: "User",
      entityId: user.id,
      metadata: { email, role: parsed.data.role, invited },
    });

    revalidateUsers();
    return {
      success: true,
      message: invited
        ? `Invitation envoyée à ${email}.`
        : `Compte ${email} créé (invitation Clerk non envoyée).`,
    };
  } catch (error) {
    console.error("[users] invitation impossible", error);
    return failure("L'invitation a échoué.");
  }
}

/** Change le rôle d'un compte (protège le dernier Super Admin). */
export async function changePlatformUserRole(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = changePlatformRoleSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, role: true, clerkId: true },
    });
    if (!user) return failure("Utilisateur introuvable.");
    if (user.role === parsed.data.role) {
      return { success: true, message: "Rôle inchangé." };
    }

    if (user.role === Role.SUPER_ADMIN && parsed.data.role !== Role.SUPER_ADMIN) {
      const supers = await countSuperAdmins();
      if (supers <= 1) {
        return failure(
          "Impossible : ce compte est le dernier Super Admin de la plateforme.",
        );
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: parsed.data.role },
    });

    // Sync Clerk (metadata privée) — jamais bloquante
    await syncClerkRoleMetadata(user.clerkId, parsed.data.role);

    await logAction({
      action: "user.role",
      userId: admin.id,
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email, from: user.role, to: parsed.data.role },
    });

    revalidateUsers();
    return { success: true, message: `Rôle de ${user.email} modifié.` };
  } catch (error) {
    console.error("[users] changement de rôle impossible", error);
    return failure("Le changement de rôle a échoué.");
  }
}

/**
 * Active / désactive un compte (module 9).
 * Un compte désactivé est refusé par `requireSuperAdmin()`.
 */
export async function setUserDisabled(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = setUserDisabledSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, role: true, disabled: true },
    });
    if (!user) return failure("Utilisateur introuvable.");
    if (user.disabled === parsed.data.disabled) {
      return { success: true, message: "État inchangé." };
    }

    if (user.id === admin.id) {
      return failure("Impossible de désactiver votre propre compte.");
    }
    if (parsed.data.disabled && user.role === Role.SUPER_ADMIN) {
      const supers = await countSuperAdmins();
      if (supers <= 1) {
        return failure(
          "Impossible : ce compte est le dernier Super Admin de la plateforme.",
        );
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { disabled: parsed.data.disabled },
    });

    await logAction({
      action: parsed.data.disabled ? "user.disable" : "user.enable",
      userId: admin.id,
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email },
    });

    revalidateUsers();
    return {
      success: true,
      message: parsed.data.disabled
        ? `Compte ${user.email} désactivé.`
        : `Compte ${user.email} réactivé.`,
    };
  } catch (error) {
    console.error("[users] désactivation impossible", error);
    return failure("Le changement d'état a échoué.");
  }
}

/** Supprime un compte (cascade sur ses rattachements boutique). */
export async function deletePlatformUser(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return failure("Identifiant invalide.");

    const user = await prisma.user.findUnique({
      where: { id: parsedId.data },
      select: { id: true, email: true, role: true },
    });
    if (!user) return failure("Utilisateur introuvable.");

    if (user.id === admin.id) {
      return failure("Impossible de supprimer votre propre compte.");
    }
    if (user.role === Role.SUPER_ADMIN) {
      const supers = await countSuperAdmins();
      if (supers <= 1) {
        return failure(
          "Impossible : ce compte est le dernier Super Admin de la plateforme.",
        );
      }
    }

    await prisma.user.delete({ where: { id: user.id } });

    await logAction({
      action: "user.delete",
      userId: admin.id,
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    revalidateUsers();
    return { success: true, message: `Compte ${user.email} supprimé.` };
  } catch (error) {
    console.error("[users] suppression impossible", error);
    return failure("La suppression a échoué.");
  }
}
