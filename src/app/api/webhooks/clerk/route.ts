import { Webhook } from "svix";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

/**
 * Webhook Clerk → synchronisation de la table User.
 *
 * Événements traités : user.created, user.updated, user.deleted.
 * Idempotent : upsert sur `clerkId` unique + deleteMany (rejeu sans effet).
 * Jamais de mot de passe stocké (Clerk reste le seul détenteur).
 */

type ClerkEmail = { id: string; email_address: string };

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: ClerkEmail[];
    primary_email_address_id?: string | null;
    // Champ présent dans le payload Clerk : volontairement ignoré.
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
    // svix v2 : verify() valide la signature et throw si elle est invalide
    // (il ne renvoie plus le payload décodé → on le parse nous-mêmes).
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

        // Idempotent : l'upsert sur clerkId unique rend le rejeu inoffensif.
        // Seuls clerkId/email/role (défaut MEMBER) sont persistés.
        //
        // Réconciliation des comptes provisoires : quand le super admin
        // crée une boutique pour un client (module 6), un User est créé avec
        // un clerkId « pending_* ». À la première connexion réelle du client,
        // on remplace ce clerkId provisoire par le vrai plutôt que de créer
        // un doublon (contrainte unique sur l'email).
        const existingByEmail = await prisma.user.findUnique({
          where: { email },
          select: { id: true, clerkId: true },
        });

        if (
          existingByEmail &&
          existingByEmail.clerkId !== data.id &&
          existingByEmail.clerkId.startsWith("pending_")
        ) {
          await prisma.user.update({
            where: { id: existingByEmail.id },
            data: { clerkId: data.id, email },
          });
        } else {
          await prisma.user.upsert({
            where: { clerkId: data.id },
            update: { email },
            create: { clerkId: data.id, email },
          });
        }
        break;
      }

      case "user.deleted": {
        // Idempotent : deleteMany ne remonte pas d'erreur si déjà supprimé
        // (Cascade : memberships retirés, AuditLog.userId mis à null).
        await prisma.user.deleteMany({ where: { clerkId: data.id } });
        break;
      }

      default:
        // Événements non gérés : accusé réception pour stopper les retries.
        break;
    }
  } catch (error) {
    console.error(`[webhook-clerk] erreur sur ${type}`, error);
    // 500 → svix rejouera l'événement (idempotent, donc sûr).
    return NextResponse.json(
      { error: "Erreur de traitement" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
