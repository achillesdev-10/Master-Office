"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { Role, TenantStatus, type Prisma, type User } from "@prisma/client";
import { put } from "@vercel/blob";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { findTenantBySlug, getRootDomain } from "@/lib/db/queries/tenants";
import {
  invalidateTenantCache,
  provisionTenant,
} from "@/lib/tenant/provision";
import { invalidateTenantResolveCache } from "@/lib/tenant/resolve";
import { encryptSecret, isEncryptionConfigured } from "@/lib/security/crypto";
import {
  changeRoleSchema,
  createTenantSchema,
  flattenErrors,
  inviteUserSchema,
  paymentSettingsSchema,
  shippingMethodSchema,
  slugOnlySchema,
  slugify,
  updateTenantInfoSchema,
  updateThemeSchema,
} from "@/lib/validators/tenant";
import { failure } from "@/lib/actions/types";
import type { ActionFailure, ActionResult } from "@/lib/actions/types";

/**
 * Server Actions des boutiques (modules 5, 6 & 7).
 *
 * Toutes les mutations passent par `requireSuperAdmin()` puis une
 * validation Zod, et sont journalisées via `logAction`.
 */

export type { FieldErrors, ActionFailure, ActionResult } from "@/lib/actions/types";

export type CreateTenantResult =
  | { success: true; tenantId: string; slug: string }
  | ActionFailure;

const tenantIdSchema = z.string().cuid("Identifiant invalide");

/** Invalide la liste des boutiques et les KPIs mis en cache du dashboard. */
function revalidateTenants(route?: string): void {
  revalidatePath("/admin/tenants");
  if (route) revalidatePath(route);
  revalidateTag("dashboard");
  revalidatePath("/admin/dashboard");
}

// ======================== SLUG (temps réel) =======================

/**
 * Vérifie le format puis l'unicité d'un slug (appelée par le wizard
 * avec un debounce — aucun rechargement de page).
 */
export async function checkSlugAvailability(slug: string): Promise<{
  valid: boolean;
  available: boolean;
  reason?: string;
}> {
  const parsed = slugOnlySchema.safeParse(slug);
  if (!parsed.success) {
    return {
      valid: false,
      available: false,
      reason: parsed.error.issues[0]?.message ?? "Slug invalide.",
    };
  }

  try {
    const existing = await findTenantBySlug(parsed.data);
    return { valid: true, available: existing === null };
  } catch (error) {
    console.error("[tenants] vérification slug impossible", error);
    return { valid: true, available: true, reason: "Vérification impossible" };
  }
}

// ======================== CRÉATION ===============================

/**
 * Crée une boutique : transaction Prisma (Tenant + TenantDomain +
 * TenantUser admin + TenantPayment + ShippingMethod), puis
 * organisation Clerk et provisioning Redis (tolérants à l'erreur).
 */
export async function createTenant(input: unknown): Promise<CreateTenantResult> {
  const admin = await requireSuperAdmin();

  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors, formError } = flattenErrors(parsed.error);
    return failure(formError, fieldErrors);
  }
  const data = parsed.data;

  try {
    const taken = await findTenantBySlug(data.slug);
    if (taken) {
      return failure("Ce slug est déjà utilisé.", {
        slug: "Ce slug est déjà utilisé.",
      });
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          status: TenantStatus.ACTIVE,
          description: data.description || null,
          currency: data.currency,
          language: data.language,
          timezone: data.timezone,
          primaryColor: data.primaryColor,
          logoUrl: data.logoUrl || null,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone || null,
          contactCountry: data.contactCountry,
          themeId: data.themeId,
        },
      });

      // Domaine auto : {slug}.{domaine racine}
      await tx.tenantDomain.create({
        data: {
          domain: `${created.slug}.${getRootDomain()}`,
          tenantId: created.id,
        },
      });

      await ensureTenantAdmin(tx, created.id, data.contactEmail, created.slug);

      await tx.tenantPayment.createMany({
        data: data.providers.map((provider) => ({
          tenantId: created.id,
          provider,
          enabled: true,
        })),
      });

      await tx.shippingMethod.createMany({
        data: data.methods.map((method) => ({
          tenantId: created.id,
          name: method.name,
          price: method.price,
          enabled: method.enabled,
        })),
      });

      return created;
    });

    // --- Services externes (hors transaction, jamais bloquants) ----
    const clerkOrgId = await createClerkOrganization(
      data.name,
      data.slug,
      admin.clerkId,
    );
    if (clerkOrgId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { clerkOrgId },
      });
    }

    await provisionTenant({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      currency: tenant.currency,
      language: tenant.language,
      timezone: tenant.timezone,
      primaryColor: tenant.primaryColor,
      logoUrl: tenant.logoUrl,
      description: tenant.description,
      themeId: tenant.themeId,
      domains: [`${tenant.slug}.${getRootDomain()}`],
      rootDomain: getRootDomain(),
    });
    invalidateTenantResolveCache(tenant.slug);

    await logAction({
      action: "tenant.create",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: {
        slug: tenant.slug,
        providers: data.providers,
        shippingMethods: data.methods.length,
        themeId: data.themeId,
        clerkOrgCreated: clerkOrgId !== null,
      },
    });

    revalidateTenants();
    return { success: true, tenantId: tenant.id, slug: tenant.slug };
  } catch (error) {
    console.error("[tenants] création impossible", error);
    return failure(
      "La boutique n'a pas pu être créée. Réessayez ou vérifiez le slug.",
    );
  }
}

/**
 * Lie le propriétaire (email) au tenant en tant qu'ADMIN.
 * Si aucun compte n'existe, un compte provisoire est créé avec un
 * `clerkId` « pending_ » : le webhook Clerk le réconcilie automatiquement
 * à la première connexion (voir app/api/webhooks/clerk/route.ts).
 */
async function ensureTenantAdmin(
  tx: Prisma.TransactionClient,
  tenantId: string,
  email: string,
  slug: string,
): Promise<void> {
  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const userId = existing
    ? existing.id
    : (
        await tx.user.create({
          data: { email, clerkId: `pending_${slug}` },
        })
      ).id;

  await tx.tenantUser.create({
    data: { tenantId, userId, role: Role.ADMIN },
  });
}

/** Crée l'organisation Clerk (null si Clerk non configuré / en erreur). */
async function createClerkOrganization(
  name: string,
  slug: string,
  createdBy: string,
): Promise<string | null> {
  try {
    const client = await clerkClient();
    const organization = await client.organizations.createOrganization({
      name,
      slug,
      createdBy,
    });
    return organization.id;
  } catch (error) {
    console.error("[tenants] organisation Clerk non créée", error);
    return null;
  }
}

// ======================== UPLOAD LOGO ============================

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Upload du logo vers Vercel Blob → retourne l'URL publique.
 * Utilisée par l'étape 7 du wizard (formulaire FormData, sans rechargement).
 */
export async function uploadTenantLogo(
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  await requireSuperAdmin();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return failure("Stockage Blob non configuré (BLOB_READ_WRITE_TOKEN).");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failure("Aucun fichier reçu.");
  }
  if (!file.type.startsWith("image/")) {
    return failure("Seules les images sont acceptées (PNG, JPG, SVG, WebP).");
  }
  if (file.size > LOGO_MAX_BYTES) {
    return failure("Image trop lourde (2 Mo maximum).");
  }

  try {
    const blob = await put(
      `tenants/logos/${Date.now()}-${slugify(file.name) || "logo"}`,
      file,
      { access: "public", allowOverwrite: false },
    );
    return { success: true, url: blob.url };
  } catch (error) {
    console.error("[tenants] upload logo impossible", error);
    return failure("L'upload du logo a échoué.");
  }
}

// ======================== MUTATIONS (module 5) ===================

/** Passe une boutique au statut SUSPENDED + AuditLog. */
export async function suspendTenant(id: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsedId = tenantIdSchema.safeParse(id);
  if (!parsedId.success) return failure("Identifiant invalide.");

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: parsedId.data, deletedAt: null },
      select: { id: true, name: true, slug: true, status: true, domains: { select: { domain: true } } },
    });
    if (!tenant) return failure("Boutique introuvable.");
    if (tenant.status === TenantStatus.SUSPENDED) {
      return failure("Cette boutique est déjà suspendue.");
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: TenantStatus.SUSPENDED },
    });
    const domains = tenant.domains.map((d) => d.domain);
    await invalidateTenantCache(tenant.slug, domains);
    invalidateTenantResolveCache(tenant.slug);
    await logAction({
      action: "tenant.suspend",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { from: tenant.status, to: TenantStatus.SUSPENDED },
    });

    revalidateTenants(`/admin/tenants/${tenant.id}`);
    return { success: true, message: `${tenant.name} suspendue.` };
  } catch (error) {
    console.error("[tenants] suspension impossible", error);
    return failure("La suspension a échoué.");
  }
}

/**
 * Suppression logique (soft delete) : `deletedAt` renseigné +
 * statut ARCHIVED. Les lignes restent en base (réversible, audité).
 */
export async function deleteTenant(id: string): Promise<ActionResult> {
  const admin = await requireSuperAdmin();
  const parsedId = tenantIdSchema.safeParse(id);
  if (!parsedId.success) return failure("Identifiant invalide.");

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { id: parsedId.data, deletedAt: null },
      select: { id: true, name: true, slug: true, status: true, domains: { select: { domain: true } } },
    });
    if (!tenant) return failure("Boutique introuvable.");

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { deletedAt: new Date(), status: TenantStatus.ARCHIVED },
    });
    const domains = tenant.domains.map((d) => d.domain);
    await invalidateTenantCache(tenant.slug, domains);
    invalidateTenantResolveCache(tenant.slug);
    await logAction({
      action: "tenant.delete",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { slug: tenant.slug, mode: "soft-delete", from: tenant.status },
    });

    revalidateTenants(`/admin/tenants/${tenant.id}`);
    return { success: true, message: `${tenant.name} supprimée (archivée).` };
  } catch (error) {
    console.error("[tenants] suppression impossible", error);
    return failure("La suppression a échoué.");
  }
}

// ======================== MODULE 7 : FICHE BOUTIQUE ==============

/** Super Admin courant, ou null (aucune action n'est alors exécutée). */
async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[tenants] accès refusé", error);
    return null;
  }
}

/** Charge une boutique existante (hors suppression logique). */
async function findTenantRecord(id: string) {
  return prisma.tenant.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      clerkOrgId: true,
      domains: { select: { domain: true } },
    },
  });
}

/** Invalide tous les onglets de la fiche boutique + le dashboard. */
function revalidateTenantDetail(id: string): void {
  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/tenants/[id]", "layout");
  revalidateTenants();
}

/** Onglet « Infos » : nom, description, configuration, client. */
export async function updateTenantInfo(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(id);
    if (!tenant) return failure("Boutique introuvable.");

    const parsed = updateTenantInfoSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        currency: parsed.data.currency,
        language: parsed.data.language,
        timezone: parsed.data.timezone,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone || null,
        contactCountry: parsed.data.contactCountry,
      },
    });

    await logAction({
      action: "tenant.update.info",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { name: parsed.data.name, currency: parsed.data.currency },
    });

    revalidateTenantDetail(tenant.id);
    return { success: true, message: "Informations enregistrées." };
  } catch (error) {
    console.error("[tenants] mise à jour infos impossible", error);
    return failure("L'enregistrement a échoué.");
  }
}

/** Onglet « Thème » : thème + logo + couleur principale. */
export async function updateTenantAppearance(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(id);
    if (!tenant) return failure("Boutique introuvable.");

    const parsed = updateThemeSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const theme = await prisma.theme.findUnique({
      where: { id: parsed.data.themeId },
      select: { id: true, name: true },
    });
    if (!theme) {
      return failure("Thème introuvable.", { themeId: "Thème introuvable." });
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        themeId: theme.id,
        primaryColor: parsed.data.primaryColor,
        logoUrl: parsed.data.logoUrl || null,
      },
    });

    await logAction({
      action: "tenant.update.theme",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { themeId: theme.id, theme: theme.name },
    });

    revalidateTenantDetail(tenant.id);
    return { success: true, message: `Thème « ${theme.name} » appliqué.` };
  } catch (error) {
    console.error("[tenants] mise à jour thème impossible", error);
    return failure("L'enregistrement a échoué.");
  }
}

/** Onglet « Paiements » : activation d'un provider + clé API chiffrée. */
export async function savePaymentSettings(
  tenantId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(tenantId);
    if (!tenant) return failure("Boutique introuvable.");

    const parsed = paymentSettingsSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { provider, enabled, apiKey } = parsed.data;

    if (apiKey && !isEncryptionConfigured()) {
      return failure(
        "ENCRYPTION_KEY absente : impossible de stocker une clé API.",
      );
    }

    const existing = await prisma.tenantPayment.findUnique({
      where: { tenantId_provider: { tenantId: tenant.id, provider } },
      select: { apiKeyEncrypted: true },
    });

    await prisma.tenantPayment.upsert({
      where: { tenantId_provider: { tenantId: tenant.id, provider } },
      create: {
        tenantId: tenant.id,
        provider,
        enabled,
        apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : null,
      },
      update: {
        enabled,
        ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}),
      },
    });

    await logAction({
      action: "tenant.payment.update",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: {
        provider,
        enabled,
        // Jamais de clé en clair dans le journal d'audit.
        keyUpdated: Boolean(apiKey),
        keyStored: Boolean(apiKey ? true : existing?.apiKeyEncrypted),
      },
    });

    revalidateTenantDetail(tenant.id);
    return {
      success: true,
      message: apiKey
        ? `Clé API ${provider} chiffrée et enregistrée.`
        : `Moyen de paiement ${provider} mis à jour.`,
    };
  } catch (error) {
    console.error("[tenants] paiement impossible", error);
    return failure("L'enregistrement a échoué.");
  }
}

// ---------------------- MODES DE LIVRAISON ------------------------

/** Onglet « Livraison » : ajout d'une méthode. */
export async function createShippingMethod(
  tenantId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(tenantId);
    if (!tenant) return failure("Boutique introuvable.");

    const parsed = shippingMethodSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const method = await prisma.shippingMethod.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        price: parsed.data.price,
        enabled: parsed.data.enabled,
      },
    });

    await logAction({
      action: "tenant.shipping.create",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "ShippingMethod",
      entityId: method.id,
      metadata: { methodId: method.id, name: method.name, price: method.price },
    });

    revalidateTenantDetail(tenant.id);
    return { success: true, message: `Méthode « ${method.name} » ajoutée.` };
  } catch (error) {
    console.error("[tenants] création livraison impossible", error);
    return failure("L'ajout a échoué.");
  }
}

/** Onglet « Livraison » : modification (nom, prix, activation). */
export async function updateShippingMethod(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const existing = await prisma.shippingMethod.findUnique({
      where: { id },
      select: { id: true, tenantId: true, name: true },
    });
    if (!existing) return failure("Méthode de livraison introuvable.");

    const parsed = shippingMethodSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    await prisma.shippingMethod.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        price: parsed.data.price,
        enabled: parsed.data.enabled,
      },
    });

    await logAction({
      action: "tenant.shipping.update",
      userId: admin.id,
      tenantId: existing.tenantId,
      entity: "ShippingMethod",
      entityId: existing.id,
      metadata: { methodId: existing.id, name: parsed.data.name },
    });

    revalidateTenantDetail(existing.tenantId);
    return { success: true, message: "Méthode de livraison mise à jour." };
  } catch (error) {
    console.error("[tenants] mise à jour livraison impossible", error);
    return failure("L'enregistrement a échoué.");
  }
}

/** Onglet « Livraison » : suppression. */
export async function deleteShippingMethod(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const existing = await prisma.shippingMethod.findUnique({
      where: { id },
      select: { id: true, tenantId: true, name: true },
    });
    if (!existing) return failure("Méthode de livraison introuvable.");

    await prisma.shippingMethod.delete({ where: { id: existing.id } });

    await logAction({
      action: "tenant.shipping.delete",
      userId: admin.id,
      tenantId: existing.tenantId,
      entity: "ShippingMethod",
      entityId: existing.id,
      metadata: { methodId: existing.id, name: existing.name },
    });

    revalidateTenantDetail(existing.tenantId);
    return { success: true, message: `Méthode « ${existing.name} » supprimée.` };
  } catch (error) {
    console.error("[tenants] suppression livraison impossible", error);
    return failure("La suppression a échoué.");
  }
}

// ---------------------- UTILISATEURS -----------------------------

/** Envoie l'invitation Clerk (jamais bloquante : tolère l'absence d'orga). */
async function sendClerkInvitation(
  clerkOrgId: string | null,
  email: string,
  role: "ADMIN" | "MEMBER",
): Promise<boolean> {
  if (!clerkOrgId) return false;
  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      emailAddress: email,
      role: role === "ADMIN" ? "org:admin" : "org:member",
    });
    return true;
  } catch (error) {
    console.error("[tenants] invitation Clerk impossible", error);
    return false;
  }
}

/** Onglet « Utilisateurs » : invitation d'un membre par email. */
export async function inviteTenantUser(
  tenantId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(tenantId);
    if (!tenant) return failure("Boutique introuvable.");

    const parsed = inviteUserSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const email = parsed.data.email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const user =
      existingUser ??
      (await prisma.user.create({
        data: { email, clerkId: `pending_${tenant.slug}_${Date.now()}` },
        select: { id: true },
      }));

    const alreadyMember = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      select: { id: true },
    });
    if (alreadyMember) {
      return failure("Cette personne est déjà membre de la boutique.", {
        email: "Déjà membre.",
      });
    }

    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: parsed.data.role },
    });

    const invitationSent = await sendClerkInvitation(
      tenant.clerkOrgId,
      email,
      parsed.data.role,
    );

    await logAction({
      action: "tenant.user.invite",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "User",
      metadata: { email, role: parsed.data.role, invitationSent },
    });

    revalidateTenantDetail(tenant.id);
    return {
      success: true,
      message: invitationSent
        ? `Invitation envoyée à ${email}.`
        : `${email} ajouté(e) à la boutique${
            tenant.clerkOrgId ? " (invitation Clerk non envoyée)" : ""
          }.`,
    };
  } catch (error) {
    console.error("[tenants] invitation impossible", error);
    return failure("L'invitation a échoué.");
  }
}

/** Nombre d'administrateurs restants dans la boutique. */
async function countTenantAdmins(tenantId: string): Promise<number> {
  return prisma.tenantUser.count({ where: { tenantId, role: Role.ADMIN } });
}

/** Onglet « Utilisateurs » : changement de rôle (interdit sur le dernier admin). */
export async function changeTenantUserRole(
  tenantId: string,
  userId: string,
  role: string,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = changeRoleSchema.safeParse({ userId, role });
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const link = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: parsed.data.userId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!link) return failure("Membre introuvable dans cette boutique.");

    if (link.role === Role.ADMIN && parsed.data.role !== Role.ADMIN) {
      const admins = await countTenantAdmins(tenantId);
      if (admins <= 1) {
        return failure(
          "Impossible : cette personne est le dernier administrateur.",
        );
      }
    }

    await prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId: parsed.data.userId } },
      data: { role: parsed.data.role },
    });

    await logAction({
      action: "tenant.user.role",
      userId: admin.id,
      tenantId,
      entity: "User",
      entityId: parsed.data.userId,
      metadata: {
        email: link.user.email,
        from: link.role,
        to: parsed.data.role,
      },
    });

    revalidateTenantDetail(tenantId);
    return {
      success: true,
      message: `Rôle de ${link.user.email} modifié.`,
    };
  } catch (error) {
    console.error("[tenants] changement de rôle impossible", error);
    return failure("Le changement de rôle a échoué.");
  }
}

/** Onglet « Utilisateurs » : retrait d'un membre. */
export async function removeTenantUser(
  tenantId: string,
  userId: string,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsedId = z.string().cuid().safeParse(userId);
    const parsedTenantId = tenantIdSchema.safeParse(tenantId);
    if (!parsedId.success || !parsedTenantId.success) {
      return failure("Identifiant invalide.");
    }

    const link = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!link) return failure("Membre introuvable dans cette boutique.");

    if (link.role === Role.ADMIN) {
      const admins = await countTenantAdmins(tenantId);
      if (admins <= 1) {
        return failure(
          "Impossible : cette personne est le dernier administrateur.",
        );
      }
    }

    await prisma.tenantUser.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });

    await logAction({
      action: "tenant.user.remove",
      userId: admin.id,
      tenantId,
      entity: "User",
      entityId: userId,
      metadata: { email: link.user.email, role: link.role },
    });

    revalidateTenantDetail(tenantId);
    return { success: true, message: `${link.user.email} retiré(e).` };
  } catch (error) {
    console.error("[tenants] retrait impossible", error);
    return failure("Le retrait a échoué.");
  }
}

// ---------------------- ZONE DE DANGER ---------------------------

/** Archive une boutique (statut ARCHIVED, toujours visible en base). */
export async function archiveTenant(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(id);
    if (!tenant) return failure("Boutique introuvable.");
    if (tenant.status === TenantStatus.ARCHIVED) {
      return failure("Cette boutique est déjà archivée.");
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: TenantStatus.ARCHIVED },
    });
    const domains = tenant.domains.map((d) => d.domain);
    await invalidateTenantCache(tenant.slug, domains);
    invalidateTenantResolveCache(tenant.slug);

    await logAction({
      action: "tenant.archive",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { from: tenant.status, to: TenantStatus.ARCHIVED },
    });

    revalidateTenantDetail(tenant.id);
    return { success: true, message: `${tenant.name} archivée.` };
  } catch (error) {
    console.error("[tenants] archivage impossible", error);
    return failure("L'archivage a échoué.");
  }
}

/** Réactive une boutique archivée ou suspendue. */
export async function restoreTenant(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const tenant = await findTenantRecord(id);
    if (!tenant) return failure("Boutique introuvable.");
    if (tenant.status === TenantStatus.ACTIVE) {
      return failure("Cette boutique est déjà active.");
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: TenantStatus.ACTIVE },
    });
    const domains = tenant.domains.map((d) => d.domain);
    await invalidateTenantCache(tenant.slug, domains);
    invalidateTenantResolveCache(tenant.slug);

    await logAction({
      action: "tenant.restore",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { from: tenant.status, to: TenantStatus.ACTIVE },
    });

    revalidateTenantDetail(tenant.id);
    return { success: true, message: `${tenant.name} réactivée.` };
  } catch (error) {
    console.error("[tenants] réactivation impossible", error);
    return failure("La réactivation a échoué.");
  }
}

