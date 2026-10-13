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
    `📦 *Adresse de livraison :*`,
    `${order.shippingAddress.name}`,
    `${order.shippingAddress.address}`,
    `${order.shippingAddress.city}`,
    `${order.shippingAddress.phone}`,
    "",
    `🛒 *Articles :*`,
  ];

  for (const item of order.items) {
    lines.push(
      `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity} — ${formatXOF(item.total)}`
    );
  }

  lines.push("");
  lines.push(`💰 *Sous-total :* ${formatXOF(order.subtotal)}`);
  lines.push(`💵 *Total :* ${formatXOF(order.total)}`);
  lines.push("");
  lines.push(`💳 *Paiement et livraison à convenir avec le vendeur sur WhatsApp*`);
  if (order.notes) lines.push(`📝 *Notes :* ${order.notes}`);

  return lines.join("\n");
}

/**
 * Créer une commande et retourner l'URL WhatsApp
 */
export async function createOrderAction(input: unknown): Promise<ActionResult & { orderId?: string; whatsappUrl?: string }> {
  try {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;

    const tenant = await resolveTenant(data.slug);
    if (!tenant) return failure("Boutique introuvable");

    // Récupérer le panier (localStorage côté client, pas de session serveur)
    // Le panier est géré côté client, ici on reçoit les items directement
    // Pour la V1, on suppose que le panier est passé dans l'input
    // Mais comme l'action est appelée depuis le client avec localStorage,
    // on doit recevoir les items dans l'input. Modifions le schéma.

    return failure("Utilisez submitOrderAction à la place");
  } catch (error) {
    console.error("[storefront] createOrder error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de la création de la commande");
  }
}

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
    });

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const data = parsed.data;

    const tenant = await resolveTenant(data.slug);
    if (!tenant) return failure("Boutique introuvable");

    // Vérifier le numéro WhatsApp de la boutique
    const merchant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { contactPhone: true },
    });
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
        variants: {
          where: { id: { in: variantIds }, isActive: true },
          select: { id: true, name: true, price: true },
        },
      },
    });

    if (products.length !== productIds.length) {
      return failure("Un ou plusieurs produits sont introuvables ou indisponibles");
    }

    // Construire les lignes de commande avec prix serveur
    let subtotal = 0;
    const orderItems = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      let price = product.basePrice;
      let variantName: string | null = null;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new Error(`Variante ${item.variantId} introuvable`);
        }
        price = variant.price;
        variantName = variant.name;
      }

      const total = price * item.quantity;
      subtotal += total;

      return {
        productId: product.id,
        variantId: item.variantId ?? null,
        productName: product.name,
        variantName,
        price,
        quantity: item.quantity,
        total,
      };
    });

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
          customerEmail: `${data.customerPhone}@whatsapp.order`, // Email placeholder pour schéma
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

    // Logger l'action
    await logAction({
      action: "order.create",
      userId: null,
      tenantId: tenant.id,
      entity: "Order",
      entityId: order.id,
      metadata: {
        customerPhone: data.customerPhone,
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