"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { assertTenantAccess } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";
import { put, del } from "@vercel/blob";
import { isOwnedBlobUrl } from "@/lib/utils";

const createProductSchema = z.object({
  tenantId: z.string().cuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000).optional().nullable(),
  shortDescription: z.string().trim().max(280).optional().nullable(),
  basePrice: z.number().int().min(0),
  compareAtPrice: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(64).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  requiresShipping: z.boolean().default(true),
  trackInventory: z.boolean().default(true),
  images: z.array(z.string().url()).max(5).default([]),
  variants: z.array(z.object({
    id: z.string().cuid().optional(),
    name: z.string().trim().min(1).max(80),
    price: z.number().int().min(0),
    quantity: z.number().int().min(0),
    sku: z.string().trim().max(64).optional().nullable(),
    attributes: z.record(z.unknown()).optional().nullable(),
  })).min(1).max(50),
});

const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
});

const deleteProductSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
});

const toggleProductActiveSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  isActive: z.boolean(),
});

const toggleProductAvailableSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  trackInventory: z.boolean(),
});

const reorderProductImagesSchema = z.object({
  tenantId: z.string().cuid(),
  productId: z.string().cuid(),
  imageIds: z.array(z.string().cuid()),
});

export async function createProduct(input: unknown): Promise<ActionResult & { productId?: string }> {
  try {
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { tenantId, images, variants, ...productData } = data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    const existingSlug = await prisma.product.findFirst({
      where: { tenantId, slug: data.slug, deletedAt: null },
      select: { id: true },
    });
    if (existingSlug) {
      return failure("Ce slug est déjà utilisé.", { slug: "Ce slug est déjà utilisé." });
    }

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, tenantId },
        select: { id: true },
      });
      if (!category) {
        return failure("Catégorie introuvable.", { categoryId: "Catégorie introuvable." });
      }
    }

    // Validate images
    for (const url of images) {
      if (!isOwnedBlobUrl(url, tenantId)) {
        return failure(`URL d'image non autorisée: ${url}`);
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          tenantId,
          ...productData,
          categoryId: productData.categoryId ?? null,
        },
      });

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((url, index) => ({
            productId: createdProduct.id,
            tenantId,
            url,
            position: index,
            isPrimary: index === 0,
          })),
        });
      }

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i]!;
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: createdProduct.id,
            tenantId,
            name: variant.name,
            sku: variant.sku ?? null,
            price: variant.price,
            attributes: (variant.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            position: i,
          },
        });

        if (productData.trackInventory) {
          await tx.inventory.create({
            data: {
              variantId: createdVariant.id,
              tenantId,
              quantity: variant.quantity,
              trackQuantity: true,
            },
          });
        }
      }

      return createdProduct;
    });

    await logAction({
      action: "product.create",
      userId: access.user.id,
      tenantId,
      entity: "Product",
      entityId: product.id,
      metadata: { name: product.name, slug: product.slug },
    });

    revalidatePath(`/dashboard/${tenantId}/products`);
    revalidatePath(`/dashboard/${tenantId}`);
    return { success: true, productId: product.id, message: "Produit créé avec succès" };
  } catch (error) {
    console.error("[products] create error:", error);
    return failure("Erreur lors de la création du produit");
  }
}

export async function updateProduct(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;
    const { id, tenantId, images, variants, ...updateData } = data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    if (updateData.slug) {
      const existingSlug = await prisma.product.findFirst({
        where: { tenantId, slug: updateData.slug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (existingSlug) {
        return failure("Ce slug est déjà utilisé.", { slug: "Ce slug est déjà utilisé." });
      }
    }

    if (updateData.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: updateData.categoryId, tenantId },
        select: { id: true },
      });
      if (!category) {
        return failure("Catégorie introuvable.", { categoryId: "Catégorie introuvable." });
      }
    }

    // Validate images if provided
    if (images !== undefined) {
      for (const url of images) {
        if (!isOwnedBlobUrl(url, tenantId)) {
          return failure(`URL d'image non autorisée: ${url}`);
        }
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      // Only update categoryId if explicitly provided
      const productUpdateData = { ...updateData };
      if (data.categoryId === undefined) {
        delete productUpdateData.categoryId;
      }
      
      const updatedProduct = await tx.product.update({
        where: { id, tenantId },
        data: productUpdateData,
      });

      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id, tenantId } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((url, index) => ({
              productId: id,
              tenantId,
              url,
              position: index,
              isPrimary: index === 0,
            })),
          });
        }
      }

      if (variants !== undefined) {
        const existingVariants = await tx.productVariant.findMany({
          where: { productId: id, tenantId },
          select: { id: true },
        });
        const existingVariantIds = new Set(existingVariants.map(v => v.id));

        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i]!;
          if (variant.id && existingVariantIds.has(variant.id)) {
            await tx.productVariant.update({
              where: { id: variant.id, tenantId },
              data: {
                name: variant.name,
                price: variant.price,
                sku: variant.sku ?? null,
                attributes: (variant.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                position: i,
                isActive: true,
              },
            });
            existingVariantIds.delete(variant.id);
          } else {
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: id,
                tenantId,
                name: variant.name,
                sku: variant.sku ?? null,
                price: variant.price,
                attributes: (variant.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                position: i,
              },
            });

            if (updateData.trackInventory !== false) {
              await tx.inventory.create({
                data: {
                  variantId: createdVariant.id,
                  tenantId,
                  quantity: variant.quantity,
                  trackQuantity: true,
                },
              });
            }
          }
        }

        for (const variantId of existingVariantIds) {
          await tx.productVariant.delete({ where: { id: variantId, tenantId } });
        }
      }

      return updatedProduct;
    });

    await logAction({
      action: "product.update",
      userId: access.user.id,
      tenantId,
      entity: "Product",
      entityId: product.id,
      metadata: { name: product.name, slug: product.slug },
    });

    revalidatePath(`/dashboard/${tenantId}/products`);
    revalidatePath(`/dashboard/${tenantId}/products/${id}`);
    revalidatePath(`/dashboard/${tenantId}`);
    return { success: true, message: "Produit mis à jour" };
  } catch (error) {
    console.error("[products] update error:", error);
    return failure("Erreur lors de la mise à jour du produit");
  }
}

export async function deleteProduct(input: unknown): Promise<ActionResult> {
  try {
    const parsed = deleteProductSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, tenantId } = parsed.data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    const product = await prisma.product.findUnique({
      where: { id, tenantId },
      select: { id: true, name: true, images: { select: { url: true } } },
    });

    if (!product) {
      return failure("Produit introuvable");
    }

    for (const image of product.images) {
      try {
        await del(image.url);
      } catch {
      }
    }

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAction({
      action: "product.delete",
      userId: access.user.id,
      tenantId,
      entity: "Product",
      entityId: id,
      metadata: { name: product.name },
    });

    revalidatePath(`/dashboard/${tenantId}/products`);
    revalidatePath(`/dashboard/${tenantId}`);
    return { success: true, message: "Produit supprimé" };
  } catch (error) {
    console.error("[products] delete error:", error);
    return failure("Erreur lors de la suppression du produit");
  }
}

export async function toggleProductActive(input: unknown): Promise<ActionResult> {
  try {
    const parsed = toggleProductActiveSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, tenantId, isActive } = parsed.data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    const product = await prisma.product.update({
      where: { id, tenantId },
      data: { isActive },
    });

    await logAction({
      action: isActive ? "product.activate" : "product.deactivate",
      userId: access.user.id,
      tenantId,
      entity: "Product",
      entityId: product.id,
      metadata: { name: product.name, isActive },
    });

    revalidatePath(`/dashboard/${tenantId}/products`);
    revalidatePath(`/dashboard/${tenantId}/products/${id}`);
    revalidatePath(`/dashboard/${tenantId}`);
    return { success: true, message: isActive ? "Produit activé" : "Produit désactivé" };
  } catch (error) {
    console.error("[products] toggle active error:", error);
    return failure("Erreur lors du changement de statut");
  }
}

export async function toggleProductAvailable(input: unknown): Promise<ActionResult> {
  try {
    const parsed = toggleProductAvailableSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, tenantId, trackInventory } = parsed.data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    const product = await prisma.product.update({
      where: { id, tenantId },
      data: { trackInventory },
    });

    await logAction({
      action: trackInventory ? "product.enable_inventory" : "product.disable_inventory",
      userId: access.user.id,
      tenantId,
      entity: "Product",
      entityId: product.id,
      metadata: { name: product.name, trackInventory },
    });

    revalidatePath(`/dashboard/${tenantId}/products`);
    revalidatePath(`/dashboard/${tenantId}/products/${id}`);
    revalidatePath(`/dashboard/${tenantId}`);
    return { success: true, message: trackInventory ? "Suivi du stock activé" : "Suivi du stock désactivé" };
  } catch (error) {
    console.error("[products] toggle available error:", error);
    return failure("Erreur lors du changement de disponibilité");
  }
}

export async function uploadProductImage(input: unknown): Promise<ActionResult & { url?: string }> {
  try {
    const formData = input as FormData;
    const tenantId = formData.get("tenantId") as string;
    const productId = formData.get("productId") as string;
    const file = formData.get("file") as File;

    if (!tenantId || !productId || !file) {
      return failure("Paramètres manquants");
    }

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    if (!file.type.startsWith("image/")) {
      return failure("Seules les images sont acceptées");
    }
    if (file.size > 2 * 1024 * 1024) {
      return failure("Image trop lourde (2 Mo maximum)");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, tenantId },
      select: { id: true, images: { select: { id: true } } },
    });

    if (!product) {
      return failure("Produit introuvable");
    }

    if (product.images.length >= 5) {
      return failure("Maximum 5 images par produit");
    }

    const blob = await put(`tenants/${tenantId}/products/${productId}/${Date.now()}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const imageCount = await prisma.productImage.count({ where: { productId, tenantId } });

    await prisma.productImage.create({
      data: {
        productId,
        tenantId,
        url: blob.url,
        position: imageCount,
        isPrimary: imageCount === 0,
      },
    });

    await logAction({
      action: "product.image.upload",
      userId: access.user.id,
      tenantId,
      entity: "ProductImage",
      entityId: blob.url,
      metadata: { productId, url: blob.url },
    });

    revalidatePath(`/dashboard/${tenantId}/products/${productId}`);
    return { success: true, message: "Image ajoutée", url: blob.url };
  } catch (error) {
    console.error("[products] upload image error:", error);
    return failure("Erreur lors de l'upload de l'image");
  }
}

export async function deleteProductImage(input: unknown): Promise<ActionResult> {
  try {
    const formData = input as FormData;
    const tenantId = formData.get("tenantId") as string;
    const productId = formData.get("productId") as string;
    const imageId = formData.get("imageId") as string;

    if (!tenantId || !productId || !imageId) {
      return failure("Paramètres manquants");
    }

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    const image = await prisma.productImage.findUnique({
      where: { id: imageId, tenantId, productId },
      select: { id: true, url: true, isPrimary: true, position: true },
    });

    if (!image) {
      return failure("Image introuvable");
    }

    try {
      await del(image.url);
    } catch {
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    const remainingImages = await prisma.productImage.findMany({
      where: { productId, tenantId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    for (let i = 0; i < remainingImages.length; i++) {
      const image = remainingImages[i]!;
      await prisma.productImage.update({
        where: { id: image.id },
        data: { position: i, isPrimary: i === 0 },
      });
    }

    await logAction({
      action: "product.image.delete",
      userId: access.user.id,
      tenantId,
      entity: "ProductImage",
      entityId: imageId,
      metadata: { productId },
    });

    revalidatePath(`/dashboard/${tenantId}/products/${productId}`);
    return { success: true, message: "Image supprimée" };
  } catch (error) {
    console.error("[products] delete image error:", error);
    return failure("Erreur lors de la suppression de l'image");
  }
}

export async function reorderProductImages(input: unknown): Promise<ActionResult> {
  try {
    const parsed = reorderProductImagesSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { tenantId, productId, imageIds } = parsed.data;

    const access = await assertTenantAccess(tenantId);
    if (!access.ok) return failure(access.error);

    await prisma.$transaction(
      imageIds.map((imageId, index) =>
        prisma.productImage.update({
          where: { id: imageId, tenantId, productId },
          data: { position: index, isPrimary: index === 0 },
        })
      )
    );

    revalidatePath(`/dashboard/${tenantId}/products/${productId}`);
    return { success: true, message: "Ordre des images mis à jour" };
  } catch (error) {
    console.error("[products] reorder images error:", error);
    return failure("Erreur lors de la réorganisation");
  }
}