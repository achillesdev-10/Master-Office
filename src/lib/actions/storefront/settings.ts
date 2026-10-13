"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireTenantAccess } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";
import { put } from "@vercel/blob";

const updateTenantInfoSchema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().max(32).optional().nullable(),
  contactCountry: z.string().min(2),
  currency: z.string().length(3),
  language: z.string().length(2),
  timezone: z.string().min(1),
});

const updateTenantAppearanceSchema = z.object({
  tenantId: z.string().cuid(),
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  themeId: z.string().cuid().optional().nullable(),
});

const updateTenantWhatsAppSchema = z.object({
  tenantId: z.string().cuid(),
  whatsappPhone: z.string().trim().min(8).max(32),
});

const updateTenantAddressSchema = z.object({
  tenantId: z.string().cuid(),
  address: z.string().trim().max(200).optional().nullable(),
  hours: z.string().trim().max(500).optional().nullable(),
});

const updateTenantStatusSchema = z.object({
  tenantId: z.string().cuid(),
  isActive: z.boolean(),
});

const uploadLogoSchema = z.object({
  tenantId: z.string().cuid(),
  file: z.instanceof(File),
});

export async function updateTenantInfo(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateTenantInfoSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, ...updateData } = data;

    await requireTenantAccess(tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await logAction({
      action: "tenant.update.info",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { name: tenant.name },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Informations générales mises à jour" };
  } catch (error) {
    console.error("[settings] update info error:", error);
    return failure("Erreur lors de la mise à jour des informations");
  }
}

export async function updateTenantAppearance(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateTenantAppearanceSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, ...updateData } = data;

    await requireTenantAccess(tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await logAction({
      action: "tenant.update.appearance",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { primaryColor: tenant.primaryColor, themeId: tenant.themeId },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Apparence mise à jour" };
  } catch (error) {
    console.error("[settings] update appearance error:", error);
    return failure("Erreur lors de la mise à jour de l'apparence");
  }
}

export async function updateTenantWhatsApp(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateTenantWhatsAppSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, whatsappPhone } = data;

    await requireTenantAccess(tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { contactPhone: whatsappPhone },
    });

    await logAction({
      action: "tenant.update.whatsapp",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { whatsappPhone },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Numéro WhatsApp mis à jour" };
  } catch (error) {
    console.error("[settings] update whatsapp error:", error);
    return failure("Erreur lors de la mise à jour du numéro WhatsApp");
  }
}

export async function updateTenantAddress(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateTenantAddressSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, ...updateData } = data;

    await requireTenantAccess(tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await logAction({
      action: "tenant.update.address",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { address: tenant.address, hours: tenant.hours },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Adresse et horaires mis à jour" };
  } catch (error) {
    console.error("[settings] update address error:", error);
    return failure("Erreur lors de la mise à jour de l'adresse");
  }
}

export async function updateTenantStatus(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateTenantStatusSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { tenantId, isActive } = parsed.data;

    await requireTenantAccess(tenantId);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: isActive ? "ACTIVE" : "SUSPENDED" },
    });

    await logAction({
      action: isActive ? "tenant.activate" : "tenant.suspend",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { status: tenant.status },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: isActive ? "Boutique activée" : "Boutique suspendue" };
  } catch (error) {
    console.error("[settings] update status error:", error);
    return failure("Erreur lors du changement de statut");
  }
}

export async function uploadTenantLogo(input: unknown): Promise<ActionResult & { url?: string }> {
  try {
    await requireTenantAccess("");
    const parsed = uploadLogoSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { tenantId, file } = parsed.data;

    await requireTenantAccess(tenantId);

    if (!file.type.startsWith("image/")) {
      return failure("Seules les images sont acceptées");
    }
    if (file.size > 2 * 1024 * 1024) {
      return failure("Image trop lourde (2 Mo maximum)");
    }

    const blob = await put(`tenants/${tenantId}/logo/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: blob.url },
    });

    await logAction({
      action: "tenant.update.logo",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { logoUrl: blob.url },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { success: true, message: "Logo mis à jour", url: blob.url };
  } catch (error) {
    console.error("[settings] upload logo error:", error);
    return failure("Erreur lors de l'upload du logo");
  }
}

export async function getTenantSettings(tenantId: string) {
  await requireTenantAccess(tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      contactCountry: true,
      currency: true,
      language: true,
      timezone: true,
      primaryColor: true,
      logoUrl: true,
      themeId: true,
      theme: { select: { id: true, name: true } },
      address: true,
      hours: true,
      status: true,
    },
  });

  if (!tenant) return null;

  return tenant;
}

// Helper
async function getCurrentUser() {
  const { getCurrentUser } = await import("@/lib/auth/permissions");
  return getCurrentUser();
}