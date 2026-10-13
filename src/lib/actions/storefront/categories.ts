"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireTenantAccess } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";

const createCategorySchema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(500).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.string().cuid(),
});

const deleteCategorySchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
});

const reorderCategoriesSchema = z.object({
  tenantId: z.string().cuid(),
  categories: z.array(z.object({
    id: z.string().cuid(),
    sortOrder: z.number().int().min(0),
  })),
});

export async function createCategory(input: unknown): Promise<ActionResult & { categoryId?: string }> {
  try {
    await requireTenantAccess("");
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, ...categoryData } = data;

    await requireTenantAccess(tenantId);

    // Check slug uniqueness within tenant
    const existingSlug = await prisma.category.findFirst({
      where: { tenantId, slug: data.slug, deletedAt: null },
      select: { id: true },
    });
    if (existingSlug) {
      return failure("Ce slug est déjà utilisé.", { slug: "Ce slug est déjà utilisé." });
    }

    // If parentId provided, verify it belongs to the same tenant
    if (categoryData.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: categoryData.parentId, tenantId },
        select: { id: true },
      });
      if (!parent) {
        return failure("Catégorie parente introuvable.", { parentId: "Catégorie parente introuvable." });
      }
    }

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description ?? null,
        parentId: categoryData.parentId ?? null,
        isActive: categoryData.isActive,
        imageUrl: categoryData.imageUrl ?? null,
        sortOrder: categoryData.sortOrder,
      },
    });

    await logAction({
      action: "category.create",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Category",
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });

    revalidatePath("/dashboard/categories");
    return { success: true, categoryId: category.id };
  } catch (error) {
    console.error("[categories] create error:", error);
    return failure("Erreur lors de la création de la catégorie");
  }
}

export async function updateCategory(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { id, tenantId, ...updateData } = data;

    await requireTenantAccess(tenantId);

    // Check slug uniqueness if changing
    if (updateData.slug) {
      const existingSlug = await prisma.category.findFirst({
        where: { tenantId, slug: updateData.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (existingSlug) {
        return failure("Ce slug est déjà utilisé.", { slug: "Ce slug est déjà utilisé." });
      }
    }

    // If parentId provided, verify it belongs to the same tenant and is not self
    if (updateData.parentId) {
      if (updateData.parentId === id) {
        return failure("Une catégorie ne peut pas être sa propre parente.", { parentId: "Invalide" });
      }
      const parent = await prisma.category.findFirst({
        where: { id: updateData.parentId, tenantId },
        select: { id: true },
      });
      if (!parent) {
        return failure("Catégorie parente introuvable.", { parentId: "Catégorie parente introuvable." });
      }
      // Check for circular reference
      let currentParentId = updateData.parentId;
      while (currentParentId) {
        const parent = await prisma.category.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        if (!parent || !parent.parentId) break;
        if (parent.parentId === id) {
          return failure("Cette modification créerait une référence circulaire.", { parentId: "Référence circulaire" });
        }
        currentParentId = parent.parentId;
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: updateData.name,
        slug: updateData.slug,
        description: updateData.description ?? null,
        parentId: updateData.parentId ?? null,
        isActive: updateData.isActive,
        imageUrl: updateData.imageUrl ?? null,
        sortOrder: updateData.sortOrder,
      },
    });

    await logAction({
      action: "category.update",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Category",
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });

    revalidatePath("/dashboard/categories");
    return { success: true };
  } catch (error) {
    console.error("[categories] update error:", error);
    return failure("Erreur lors de la mise à jour de la catégorie");
  }
}

export async function deleteCategory(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = deleteCategorySchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, tenantId } = parsed.data;

    await requireTenantAccess(tenantId);

    // Check if category has children
    const childrenCount = await prisma.category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return failure("Impossible de supprimer une catégorie qui a des sous-catégories. Supprimez d'abord les sous-catégories.");
    }

    // Check if category has products
    const productsCount = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (productsCount > 0) {
      return failure("Impossible de supprimer une catégorie qui contient des produits. Déplacez ou supprimez d'abord les produits.");
    }

    await prisma.category.delete({ where: { id } });

    await logAction({
      action: "category.delete",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Category",
      entityId: id,
    });

    revalidatePath("/dashboard/categories");
    return { success: true, message: "Catégorie supprimée" };
  } catch (error) {
    console.error("[categories] delete error:", error);
    return failure("Erreur lors de la suppression de la catégorie");
  }
}

export async function reorderCategories(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = reorderCategoriesSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { tenantId, categories } = parsed.data;

    await requireTenantAccess(tenantId);

    await prisma.$transaction(
      categories.map(({ id, sortOrder }) =>
        prisma.category.update({
          where: { id, tenantId },
          data: { sortOrder },
        })
      )
    );

    revalidatePath("/dashboard/categories");
    return { success: true, message: "Ordre mis à jour" };
  } catch (error) {
    console.error("[categories] reorder error:", error);
    return failure("Erreur lors de la réorganisation");
  }
}

// Helper
async function getCurrentUser() {
  const { getCurrentUser } = await import("@/lib/auth/permissions");
  return getCurrentUser();
}