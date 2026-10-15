"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getOrCreateCart, getCartDetail, clearCart } from "@/lib/db/queries/storefront/cart";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";
import { logAction } from "@/lib/audit/log";
import { normalizePhoneNumber, formatXOF } from "@/lib/utils";

interface CartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface CartProductDetail {
  productId: string;
  variantId?: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    images: { url: string; altText: string | null }[];
    basePrice: number;
    compareAtPrice: number | null;
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    compareAtPrice: number | null;
    inStock: boolean;
    quantity: number;
  } | null;
  lineTotal: number;
  inStock: boolean;
}

export async function getCartItemsDetail(slug: string, items: CartItemInput[]): Promise<ActionResult & { items?: CartProductDetail[]; subtotal?: number }> {
  try {
    if (items.length === 0) {
      return { success: true, items: [], subtotal: 0 };
    }
    if (items.length > 30) {
      return failure("Maximum 30 lignes de commande");
    }

    const tenant = await resolveTenant(slug);
    if (!tenant) return failure("Boutique introuvable");

    const productIds = items.map((i) => i.productId);
    const variantIds = items.map((i) => i.variantId).filter((v): v is string => Boolean(v));

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: tenant.id, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        compareAtPrice: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where: { id: { in: variantIds }, isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            compareAtPrice: true,
            inventory: { select: { quantity: true, allowBackorder: true } },
          },
        },
      },
    });

    if (products.length !== productIds.length) {
      return failure("Un ou plusieurs produits sont introuvables ou indisponibles");
    }

    const detailItems: CartProductDetail[] = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      let variant = null;
      let price = product.basePrice;
      let compareAtPrice = product.compareAtPrice;
      let inStock = false;
      let availableQty = 0;

      if (item.variantId) {
        variant = product.variants.find((v) => v.id === item.variantId) || null;
        if (variant) {
          price = variant.price;
          compareAtPrice = variant.compareAtPrice;
          availableQty = variant.inventory?.quantity ?? 0;
          inStock = variant.inventory?.allowBackorder === true || availableQty > 0;
        }
      } else {
        // Pas de variante sélectionnée -> prendre la première variante active ou le produit de base
        const firstVariant = product.variants[0];
        if (firstVariant) {
          variant = firstVariant;
          price = firstVariant.price;
          compareAtPrice = firstVariant.compareAtPrice;
          availableQty = firstVariant.inventory?.quantity ?? 0;
          inStock = firstVariant.inventory?.allowBackorder === true || availableQty > 0;
        } else {
          // Produit sans variantes
          inStock = true;
          availableQty = 999;
        }
      }

      // Le prix payé est TOUJOURS price (variant.price ou product.basePrice)
      // compareAtPrice ne sert qu'à l'affichage barré
      const lineTotal = price * item.quantity;

      return {
        productId: product.id,
        variantId: item.variantId,
        quantity: item.quantity,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          images: product.images,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
        },
        variant: variant ? {
          id: variant.id,
          name: variant.name,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          inStock,
          quantity: availableQty,
        } : null,
        lineTotal,
        inStock,
      };
    });

    const subtotal = detailItems.reduce((sum, item) => sum + item.lineTotal, 0);

    return { success: true, items: detailItems, subtotal };
  } catch (error) {
    console.error("[storefront] getCartItemsDetail error:", error);
    return failure("Erreur lors de la récupération du panier");
  }
}

const checkoutSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères").max(120),
  customerPhone: z.string().trim().min(8, "Numéro de téléphone invalide").max(32),
  address: z.string().trim().min(5, "Adresse requise").max(200),
  notes: z.string().max(500).optional(),
});

type WhatsAppAddress = {
  name: string;
  address: string;
  city: string;
  phone: string;
};

type WhatsAppOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: WhatsAppAddress;
  subtotal: number;
  total: number;
  notes: string | null;
  items: {
    productName: string;
    variantName?: string | null;
    quantity: number;
    total: number;
  }[];
};

type WhatsAppTenant = { id: string; name: string; whatsappPhone: string | null };

function buildWhatsAppMessage(order: WhatsAppOrder, tenant: WhatsAppTenant): string {
  const lines = [
    `🛍 *Nouvelle commande - ${tenant.name}*`,
    `📋 *Commande #${order.id.slice(-8).toUpperCase()}*`,
    "",
    `👤 *Client :* ${order.customerName}`,
    `📱 *Téléphone :* ${order.customerPhone}`,
    "",
    `📦 *Adresse :* ${order.shippingAddress.address}, ${order.shippingAddress.city}`,
    "",
    `🛒 *Articles :*`,
  ];

  let itemLinesCount = 0;
  const MAX_ITEMS = 15; // Limite pour éviter les messages trop longs

  for (const item of order.items) {
    if (itemLinesCount < MAX_ITEMS) {
      lines.push(
        `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity} — ${formatXOF(item.total)}`
      );
    }
    itemLinesCount++;
  }

  if (itemLinesCount > MAX_ITEMS) {
    lines.push(`• … et ${itemLinesCount - MAX_ITEMS} autre${itemLinesCount - MAX_ITEMS > 1 ? "s" : ""} article${itemLinesCount - MAX_ITEMS > 1 ? "s" : ""}`);
  }

  lines.push("");
  lines.push(`💰 *Sous-total :* ${formatXOF(order.subtotal)}`);
  lines.push(`💵 *Total :* ${formatXOF(order.total)}`);
  lines.push("");
  lines.push(`💳 *Paiement et livraison à convenir avec le vendeur sur WhatsApp*`);
  if (order.notes) lines.push(`📝 *Notes :* ${order.notes}`);

  let message = lines.join("\n");

  // Tronquer si trop long (~1500 caractères max pour WhatsApp)
  const MAX_LENGTH = 1500;
  if (message.length > MAX_LENGTH) {
    message = message.substring(0, MAX_LENGTH - 3) + "...";
  }

  return message;
}

import { checkRateLimit, getOrderRateLimitKey } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

/**
 * Soumettre une commande depuis le panier localStorage
 * Valide les items côté serveur, crée la commande, retourne l'URL WhatsApp
 */
export async function submitOrderAction(input: unknown): Promise<ActionResult & { orderId?: string; whatsappUrl?: string }> {
  try {
    const schema = z.object({
      slug: z.string().min(1),
      items: z.array(z.object({
        productId: z.string().cuid(),
        variantId: z.string().cuid().optional(),
        quantity: z.number().int().min(1).max(99),
      })).min(1, "Au moins un article requis").max(30, "Maximum 30 lignes"),
      customerName: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères").max(120),
      customerPhone: z.string().trim().min(8, "Numéro de téléphone invalide").max(32),
      address: z.string().trim().min(5, "Adresse requise").max(200),
      notes: z.string().max(500).optional(),
      // Honeypot field (doit rester vide)
      website: z.string().optional(),
    });

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;

    // Honeypot check: si rempli, faux succès sans créer de commande
    if (data.website && data.website.trim() !== "") {
      return { success: true, message: "Commande créée avec succès", orderId: "honeypot", whatsappUrl: "" };
    }

    const tenant = await resolveTenant(data.slug);
    if (!tenant) return failure("Boutique introuvable");

    // Rate limiting: 5 commandes max par 10 min par IP + tenant
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    const rateLimitKey = getOrderRateLimitKey(tenant.id, forwardedFor);
    const rateLimit = await checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return failure("Trop de commandes depuis cette adresse. Veuillez patienter quelques minutes.");
    }

    // Protection anti-spam : limiter les commandes du même téléphone
    const recentOrders = await prisma.order.count({
      where: {
        tenantId: tenant.id,
        customerPhone: data.customerPhone,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }, // 10 minutes
      },
    });
    if (recentOrders >= 3) {
      return failure("Trop de commandes récentes depuis ce numéro. Veuillez patienter.");
    }

    // Vérifier le numéro WhatsApp de la boutique
    const merchant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { contactPhone: true, status: true },
    });
    if (!merchant || merchant.status !== "ACTIVE") {
      return failure("La boutique n'est pas active");
    }
    const whatsappPhone = normalizePhoneNumber(merchant?.contactPhone);
    if (!whatsappPhone) {
      return failure("La boutique n'a pas de numéro WhatsApp configuré");
    }

    // Relire les produits en base (jamais faire confiance aux prix client)
    const productIds = data.items.map((i) => i.productId);
    const variantIds = data.items.map((i) => i.variantId).filter(Boolean) as string[];

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: tenant.id, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        basePrice: true,
        trackInventory: true,
        variants: {
          where: { id: { in: variantIds }, isActive: true },
          select: { id: true, name: true, price: true, inventory: { select: { quantity: true, allowBackorder: true, trackQuantity: true } } },
        },
      },
    });

    if (products.length !== productIds.length) {
      return failure("Un ou plusieurs produits sont introuvables ou indisponibles");
    }

    // Dédupliquer les items (même produit + même variante) et vérifier la dispo
    const itemMap = new Map<string, { productId: string; variantId?: string; quantity: number }>();
    for (const item of data.items) {
      const key = `${item.productId}:${item.variantId || "default"}`;
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!;
        existing.quantity = Math.min(existing.quantity + item.quantity, 99);
      } else {
        itemMap.set(key, { ...item });
      }
    }

    // Construire les lignes de commande avec prix serveur et vérifier stock
    let subtotal = 0;
    const orderItems: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      variantName: string | null;
      price: number;
      quantity: number;
      total: number;
    }> = [];

    for (const [, item] of itemMap) {
      const product = products.find((p) => p.id === item.productId)!;
      let price = product.basePrice;
      let variantName: string | null = null;
      let availableQty = 999;
      let inStock = true;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return failure(`Variante ${item.variantId} introuvable pour ${product.name}`);
        }
        price = variant.price;
        variantName = variant.name;
        availableQty = variant.inventory?.quantity ?? 0;
        inStock = variant.inventory?.allowBackorder === true || availableQty > 0;
        if (product.trackInventory && variant.inventory?.trackQuantity && !inStock) {
          return failure(`${product.name} (${variantName}) est en rupture de stock`);
        }
        if (product.trackInventory && variant.inventory?.trackQuantity && item.quantity > availableQty) {
          return failure(`Stock insuffisant pour ${product.name} (${variantName}): ${availableQty} disponible(s)`);
        }
      } else {
        // Pas de variante -> prendre la première active
        const firstVariant = product.variants[0];
        if (firstVariant) {
          price = firstVariant.price;
          variantName = firstVariant.name;
          availableQty = firstVariant.inventory?.quantity ?? 0;
          inStock = firstVariant.inventory?.allowBackorder === true || availableQty > 0;
          if (product.trackInventory && firstVariant.inventory?.trackQuantity && !inStock) {
            return failure(`${product.name} est en rupture de stock`);
          }
          if (product.trackInventory && firstVariant.inventory?.trackQuantity && item.quantity > availableQty) {
            return failure(`Stock insuffisant pour ${product.name}: ${availableQty} disponible(s)`);
          }
        } else if (product.trackInventory) {
          // Produit sans variantes mais trackInventory activé - ne devrait pas arriver
          return failure(`${product.name} n'a pas de variante disponible`);
        }
      }

      const total = price * item.quantity;
      subtotal += total;

      orderItems.push({
        productId: product.id,
        variantId: item.variantId ?? null,
        productName: product.name,
        variantName,
        price,
        quantity: item.quantity,
        total,
      });
    }

    const total = subtotal; // Pas de frais de livraison en V1

    // Créer la commande en base
    const order = await prisma.$transaction(async (tx) => {
      const shippingAddr = {
        name: data.customerName,
        phone: data.customerPhone,
        address: data.address,
        city: "Côte d'Ivoire",
        country: "Côte d'Ivoire",
      };
      const newOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerEmail: undefined,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          status: "PENDING",
          paymentStatus: "PENDING",
          shippingAddress: shippingAddr,
          billingAddress: shippingAddr,
          subtotal,
          shippingPrice: 0,
          discountAmount: 0,
          taxAmount: 0,
          total,
          currency: tenant.currency,
          notes: data.notes ?? null,
          items: {
            create: orderItems.map((item) => ({
              tenantId: tenant.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              price: item.price,
              quantity: item.quantity,
              total: item.total,
            })),
          },
        },
      });

      return newOrder;
    });

    // Logger l'action (sans le téléphone du client dans les métadonnées)
    await logAction({
      action: "order.create",
      userId: null,
      tenantId: tenant.id,
      entity: "Order",
      entityId: order.id,
      metadata: {
        total,
        itemCount: orderItems.length,
      },
    });

    // Générer le lien WhatsApp
    const message = buildWhatsAppMessage(
      {
        ...order,
        customerPhone: data.customerPhone,
        shippingAddress: {
          name: data.customerName,
          phone: data.customerPhone,
          address: data.address,
          city: "Côte d'Ivoire",
        },
        items: orderItems,
        subtotal,
        total,
        notes: data.notes ?? null,
      },
      { id: tenant.id, name: tenant.name, whatsappPhone: whatsappPhone! }
    );
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodedMessage}`;

    revalidatePath(`/store/${data.slug}`);

    return {
      success: true,
      message: "Commande créée avec succès",
      orderId: order.id,
      whatsappUrl,
    };
  } catch (error) {
    console.error("[storefront] submitOrder error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de la création de la commande");
  }
}