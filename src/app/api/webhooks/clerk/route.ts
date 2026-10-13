import { Webhook } from "svix";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { Role } from "@prisma/client";

/**
 * Webhook Clerk → synchronisation de la table User.
 *
 * Événements traités : user.created, user.updated, user.deleted.
 * Idempotent : upsert sur `clerkId` unique + deleteMany (rejeu sans effet).
 * Jamais de mot de passe stocké (Clerk reste le seul détenteur).
 * Gestion des conflits d'email : met à jour le clerkId existant sans 500.
 */

type ClerkEmail = { id: string; email_address: string };

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: ClerkEmail[];
    primary_email_address_id?: string | null;
    password?: string;
  };
};

function pickEmail(data: ClerkUserEvent["data"]): string | null {
  const emails = data.email_addresses ?? [];
  const primary = emails.find((e) => e.id === data.primary_email_address_id);
  return (primary ?? emails[0])?.email_address ?? null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook-clerk] CLERK_WEBHOOK_SECRET manquant");
    return NextResponse.json(
      { error: "Configuration manquante" },
      { status: 500 },
    );
  }

  // --- Vérification de la signature svix ---------------------------
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "En-têtes svix manquants" },
      { status: 400 },
    );
  }

  const payload = await req.text();

  let event: ClerkUserEvent;
  try {
    new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });

    event = JSON.parse(payload) as ClerkUserEvent;
  } catch {
    return NextResponse.json(
      { error: "Signature ou payload invalide" },
      { status: 400 },
    );
  }

  // --- Traitement ---------------------------------------------------
  const { type, data } = event;

  try {
    switch (type) {
      case "user.created":
      case "user.updated": {
        const email = pickEmail(data);
        if (!email) {
          return NextResponse.json({
            received: true,
            skipped: "aucune adresse email",
          });
        }

        // SUPER_ADMIN bootstrap : emails listés dans SUPER_ADMIN_EMAILS
        const superAdminEmails = process.env.SUPER_ADMIN_EMAILS
          ?.split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean) ?? [];

        const isSuperAdminEmail = superAdminEmails.includes(email.toLowerCase());

        // Cherche un user existant par email
        const existingByEmail = await prisma.user.findUnique({
          where: { email },
          select: { id: true, clerkId: true, role: true },
        });

        if (existingByEmail) {
          if (existingByEmail.clerkId !== data.id) {
            if (existingByEmail.clerkId.startsWith("pending_")) {
              // Réconciliation compte pending → vrai clerkId
              await prisma.user.update({
                where: { id: existingByEmail.id },
                data: {
                  clerkId: data.id,
                  role: isSuperAdminEmail ? Role.SUPER_ADMIN : existingByEmail.role,
                },
              });
              console.log(`[webhook-clerk] Réconcilié pending_* → ${data.id} pour ${email}`);
            } else {
              // Conflit email : un user existe avec cet email et un clerkId non-pending différent
              // NE PAS mettre à jour le clerkId (risque de prise de contrôle de compte)
              // On loggue seulement l'anomalie pour investigation
              console.warn(
                `[webhook-clerk] Conflit email NON RÉSOLU : user ${existingByEmail.id} ` +
                  `a clerkId=${existingByEmail.clerkId} mais Clerk envoie clerkId=${data.id} pour ${email}. ` +
                  `Aucune mise à jour effectuée - investigation manuelle requise.`
              );
            }
          } else if (isSuperAdminEmail && existingByEmail.role !== Role.SUPER_ADMIN) {
            // Met à jour le rôle si l'email est dans SUPER_ADMIN_EMAILS
            await prisma.user.update({
              where: { id: existingByEmail.id },
              data: { role: Role.SUPER_ADMIN },
            });
            console.log(`[webhook-clerk] Rôle SUPER_ADMIN attribué à ${email}`);
          }
        } else {
          // Crée le nouvel utilisateur
          await prisma.user.create({
            data: {
              clerkId: data.id,
              email,
              role: isSuperAdminEmail ? Role.SUPER_ADMIN : Role.MEMBER,
            },
          });
        }
        break;
      }

      case "user.deleted": {
        await prisma.user.deleteMany({ where: { clerkId: data.id } });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[webhook-clerk] erreur sur ${type}`, error);
    // On répond 200 pour éviter les boucles de retry svix
    // L'erreur est journalisée pour investigation.
    return NextResponse.json({ received: true, error: "Logged" });
  }

  return NextResponse.json({ received: true });
}
