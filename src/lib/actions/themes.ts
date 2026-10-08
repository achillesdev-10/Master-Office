"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@prisma/client";
import { put } from "@vercel/blob";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { flattenErrors, slugify } from "@/lib/validators/tenant";
import { themeSchema, updateThemeSchema } from "@/lib/validators/theme";
import { failure } from "@/lib/actions/types";
import type { ActionResult } from "@/lib/actions/types";

/** Taille max d’une image d’aperçu de thème (2 Mo). */
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Server Actions du module 11 (catalogue des thèmes).
 */

async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[themes] accès refusé", error);
    return null;
  }
}

function revalidateThemes(): void {
  revalidatePath("/admin/themes");
  revalidatePath("/admin/tenants");
}

/** Crée un thème du catalogue. */
export async function createTheme(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = themeSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;

    const existing = await prisma.theme.findFirst({
      where: { OR: [{ slug: data.slug }, { name: data.name }] },
      select: { slug: true },
    });
    if (existing) {
      return failure("Ce thème existe déjà (nom ou slug).", {
        slug: "Slug déjà utilisé.",
      });
    }

    const theme = await prisma.theme.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        previewUrl: data.previewUrl || null,
        isPremium: data.isPremium,
        category: data.category || null,
      },
    });

    await logAction({
      action: "theme.create",
      userId: admin.id,
      entity: "Theme",
      entityId: theme.id,
      metadata: { name: theme.name, slug: theme.slug },
    });

    revalidateThemes();
    return { success: true, message: `Thème « ${theme.name} » créé.` };
  } catch (error) {
    console.error("[themes] création impossible", error);
    return failure("La création du thème a échoué.");
  }
}

/** Met à jour un thème du catalogue. */
export async function updateTheme(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = updateThemeSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, ...data } = parsed.data;

    const theme = await prisma.theme.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!theme) return failure("Thème introuvable.");

    const conflict = await prisma.theme.findFirst({
      where: {
        id: { not: id },
        OR: [{ slug: data.slug }, { name: data.name }],
      },
      select: { slug: true },
    });
    if (conflict) {
      return failure("Ce nom ou slug est déjà pris par un autre thème.", {
        slug: "Slug déjà utilisé.",
      });
    }

    await prisma.theme.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        previewUrl: data.previewUrl || null,
        isPremium: data.isPremium,
        category: data.category || null,
      },
    });

    await logAction({
      action: "theme.update",
      userId: admin.id,
      entity: "Theme",
      entityId: id,
      metadata: {
        from: { name: theme.name, slug: theme.slug },
        to: { name: data.name, slug: data.slug, isPremium: data.isPremium },
      },
    });

    revalidateThemes();
    return { success: true, message: `Thème « ${data.name} » mis à jour.` };
  } catch (error) {
    console.error("[themes] mise à jour impossible", error);
    return failure("La mise à jour du thème a échoué.");
  }
}

/** Supprime un thème non utilisé. */
export async function deleteTheme(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const theme = await prisma.theme.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { tenants: true } },
      },
    });
    if (!theme) return failure("Thème introuvable.");

    if (theme._count.tenants > 0) {
      return failure(
        `Impossible : « ${theme.name} » est utilisé par ${theme._count.tenants} boutique(s).`,
      );
    }

    await prisma.theme.delete({ where: { id: theme.id } });

    await logAction({
      action: "theme.delete",
      userId: admin.id,
      entity: "Theme",
      entityId: theme.id,
      metadata: { name: theme.name },
    });

    revalidateThemes();
    return { success: true, message: `Thème « ${theme.name} » supprimé.` };
  } catch (error) {
    console.error("[themes] suppression impossible", error);
    return failure("La suppression du thème a échoué.");
  }
}

/**
 * Upload d’une image d’aperçu vers Vercel Blob (module 11).
 * Retourne l’URL publique à renseigner dans `previewUrl`.
 */
export async function uploadThemePreview(
  formData: FormData,
): Promise<ActionResult & { url?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    console.error("[themes] accès refusé", error);
    return failure("Accès refusé : rôle Super Admin requis.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return failure("Stockage Blob non configuré (BLOB_READ_WRITE_TOKEN).");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failure("Aucun fichier reçu.");
  }
  if (!file.type.startsWith("image/")) {
    return failure("Seules les images sont acceptées (PNG, JPG, WebP).");
  }
  if (file.size > PREVIEW_MAX_BYTES) {
    return failure("Image trop lourde (2 Mo maximum).");
  }

  try {
    const blob = await put(
      `themes/previews/${Date.now()}-${slugify(file.name) || "preview"}`,
      file,
      { access: "public", allowOverwrite: false },
    );
    return { success: true, url: blob.url };
  } catch (error) {
    console.error("[themes] upload aperçu impossible", error);
    return failure("L'upload de l'aperçu a échoué.");
  }
}
