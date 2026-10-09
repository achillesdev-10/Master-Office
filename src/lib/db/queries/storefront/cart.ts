import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Requêtes pour le panier (storefront)
 */

export type CartItemDetail = {
  id: string;
  quantity: number;
  price: number; // Prix unitaire au moment de l'ajout
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    images: { url: string; altText: string | null }[];
    variants: { id: string; name: string; price: number; attributes: Prisma.JsonValue | null }[];
  };    variant: {
      id: string;
      name: string;
      price: number;
      attributes: Prisma.JsonValue | null;
    inStock: boolean;
    quantity: number;
  } | null;
  lineTotal: number;
};

export type CartDetail = {
  id: string;
  items: CartItemDetail[];
  subtotal: number;
  itemCount: number;
  currency: string;
};

export async function getOrCreateCart(
  tenantId: string,
  userId: string | null,
  sessionId: string | null
) {
  if (userId) {
    let cart = await prisma.cart.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { tenantId, userId },
      });
    }
    return cart;
  }

  if (sessionId) {
    let cart = await prisma.cart.findUnique({
      where: { tenantId_sessionId: { tenantId, sessionId } },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { tenantId, sessionId },
      });
    }
    return cart;
  }

  return null;
}

export async function getCartDetail(cartId: string): Promise<CartDetail | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true, altText: true },
              },
              variants: {
                where: { isActive: true },
                select: { id: true, name: true, price: true, attributes: true },
              },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              price: true,
              attributes: true,
              inventory: { select: { quantity: true, allowBackorder: true } },
            },
          },
        },
      },
    },
  });

  if (!cart) return null;

  const items: CartItemDetail[] = cart.items.map((item) => {
    const variant = item.variant;
    const inStock =
      variant?.inventory?.allowBackorder === true ||
      (variant?.inventory?.quantity ?? 0) > 0;
    const quantity = variant?.inventory?.quantity ?? 0;

    return {
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.product.sku,
        images: item.product.images,
        variants: item.product.variants,
      },
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            price: variant.price,
            attributes: variant.attributes,
            inStock,
            quantity,
          }
        : null,
      lineTotal: item.price * item.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    items,
    subtotal,
    itemCount,
    currency: "XOF", // TODO: récupérer depuis tenant
  };
}

export async function addToCart(
  cartId: string,
  tenantId: string,
  productId: string,
  variantId: string | null,
  quantity: number
) {
  // Vérifier le stock
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });
    if (variant?.inventory?.trackQuantity && !variant.inventory?.allowBackorder) {
      const available = (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQty ?? 0);
      if (available < quantity) {
        throw new Error("Stock insuffisant");
      }
    }
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { where: { isActive: true }, include: { inventory: true } } },
    });
    const defaultVariant = product?.variants[0];
    if (defaultVariant?.inventory?.trackQuantity && !defaultVariant.inventory?.allowBackorder) {
      const available = (defaultVariant.inventory?.quantity ?? 0) - (defaultVariant.inventory?.reservedQty ?? 0);
      if (available < quantity) {
        throw new Error("Stock insuffisant");
      }
    }
  }

  // Récupérer le prix actuel
  let price: number;
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { price: true, compareAtPrice: true },
    });
    price = variant?.compareAtPrice ?? variant?.price ?? 0;
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { basePrice: true, compareAtPrice: true, variants: { where: { isActive: true }, take: 1, select: { price: true, compareAtPrice: true } } },
    });
    price = product?.variants[0]?.compareAtPrice ?? product?.variants[0]?.price ?? product?.compareAtPrice ?? product?.basePrice ?? 0;
  }

  // Upsert cart item
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId_variantId: { cartId, productId, variantId: variantId ?? "" } },
  });

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: existingItem.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId, tenantId, productId, variantId, quantity, price },
    });
  }

  // Réserver le stock
  if (variantId) {
    await prisma.inventory.update({
      where: { variantId },
      data: { reservedQty: { increment: quantity } },
    });
  }

  return getCartDetail(cartId);
}

export async function updateCartItem(
  cartId: string,
  itemId: string,
  quantity: number
) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { variant: { include: { inventory: true } } },
  });

  if (!item || item.cartId !== cartId) {
    throw new Error("Article introuvable");
  }

  const oldQuantity = item.quantity;
  const diff = quantity - oldQuantity;

  // Vérifier le stock
  if (diff > 0 && item.variant?.inventory?.trackQuantity && !item.variant.inventory?.allowBackorder) {
    const available = (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reservedQty ?? 0);
    if (available < diff) {
      throw new Error("Stock insuffisant");
    }
  }

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  // Ajuster le stock réservé
  if (item.variantId && diff !== 0) {
    await prisma.inventory.update({
      where: { variantId: item.variantId },
      data: { reservedQty: { increment: diff } },
    });
  }

  return getCartDetail(cartId);
}

export async function removeFromCart(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { variant: true },
  });

  if (!item || item.cartId !== cartId) {
    throw new Error("Article introuvable");
  }

  if (item.variantId) {
    await prisma.inventory.update({
      where: { variantId: item.variantId },
      data: { reservedQty: { decrement: item.quantity } },
    });
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  return getCartDetail(cartId);
}

export async function clearCart(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { variant: true },
  });

  for (const item of items) {
    if (item.variantId) {
      await prisma.inventory.update({
        where: { variantId: item.variantId },
        data: { reservedQty: { decrement: item.quantity } },
      });
    }
  }

  await prisma.cartItem.deleteMany({ where: { cartId } });

  return getCartDetail(cartId);
}