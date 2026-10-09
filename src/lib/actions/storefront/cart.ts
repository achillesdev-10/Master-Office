"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveTenant } from "@/lib/tenant/resolve";
import {
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getOrCreateCart,
  getCartDetail,
  type CartDetail,
} from "@/lib/db/queries/storefront/cart";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";

const addToCartSchema = z.object({
  slug: z.string().min(1),
  productId: z.string().cuid(),
  variantId: z.string().cuid().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

const updateCartSchema = z.object({
  slug: z.string().min(1),
  itemId: z.string().cuid(),
  quantity: z.number().int().min(0).max(99),
});

const removeFromCartSchema = z.object({
  slug: z.string().min(1),
  itemId: z.string().cuid(),
});

const clearCartSchema = z.object({
  slug: z.string().min(1),
});

async function getTenantAndCart(slug: string, userId: string | null, sessionId: string | null) {
  const tenant = await resolveTenant(slug);
  if (!tenant) throw new Error("Boutique introuvable");

  const cart = await getOrCreateCart(tenant.id, userId, sessionId);
  if (!cart) throw new Error("Impossible de créer le panier");

  return { tenant, cart };
}

/**
 * Ajouter un produit au panier
 */
export async function addToCartAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = addToCartSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { slug, productId, variantId, quantity } = parsed.data;

    // Pour le storefront public, pas d'utilisateur connecté (userId = null)
    // On utilise un sessionId généré côté client (stocké dans localStorage/cookie)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const { tenant, cart } = await getTenantAndCart(slug, null, sessionId);

    await addToCart(cart.id, tenant.id, productId, variantId ?? null, quantity);

    revalidatePath(`/store/${slug}/cart`);
    return { success: true, message: "Produit ajouté au panier" };
  } catch (error) {
    console.error("[storefront] addToCart error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de l'ajout au panier");
  }
}

/**
 * Mettre à jour la quantité d'un article du panier
 */
export async function updateCartItemAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateCartSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { slug, itemId, quantity } = parsed.data;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { tenant, cart } = await getTenantAndCart(slug, null, sessionId);

    if (quantity <= 0) {
      await removeFromCart(cart.id, itemId);
    } else {
      await updateCartItem(cart.id, itemId, quantity);
    }

    revalidatePath(`/store/${slug}/cart`);
    return { success: true, message: "Panier mis à jour" };
  } catch (error) {
    console.error("[storefront] updateCartItem error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
  }
}

/**
 * Supprimer un article du panier
 */
export async function removeFromCartAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = removeFromCartSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { slug, itemId } = parsed.data;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { tenant, cart } = await getTenantAndCart(slug, null, sessionId);

    await removeFromCart(cart.id, itemId);

    revalidatePath(`/store/${slug}/cart`);
    return { success: true, message: "Article retiré du panier" };
  } catch (error) {
    console.error("[storefront] removeFromCart error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de la suppression");
  }
}

/**
 * Vider le panier
 */
export async function clearCartAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = clearCartSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { slug } = parsed.data;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const { tenant, cart } = await getTenantAndCart(slug, null, sessionId);

    await clearCart(cart.id);

    revalidatePath(`/store/${slug}/cart`);
    return { success: true, message: "Panier vidé" };
  } catch (error) {
    console.error("[storefront] clearCart error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors du vidage");
  }
}

/**
 * Récupérer le détail du panier
 */
export async function getCartDetailAction(slug: string): Promise<ActionResult & { cart?: CartDetail }> {
  try {
    const tenant = await resolveTenant(slug);
    if (!tenant) return failure("Boutique introuvable");

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cart = await getOrCreateCart(tenant.id, null, sessionId);
    if (!cart) return failure("Panier introuvable");

    const cartDetail = await getCartDetail(cart.id);
    if (!cartDetail) return failure("Panier introuvable");

    return { success: true, cart: cartDetail };
  } catch (error) {
    console.error("[storefront] getCartDetail error:", error);
    return failure("Erreur lors de la récupération du panier");
  }
}