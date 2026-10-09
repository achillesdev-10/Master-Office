"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getOrCreateCart, getCartDetail, clearCart } from "@/lib/db/queries/storefront/cart";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";
import type { PaymentProvider } from "@prisma/client";
import { logAction } from "@/lib/audit/log";

const checkoutSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères").max(120),
  customerEmail: z.string().trim().email("Adresse email invalide"),
  customerPhone: z.string().trim().min(8, "Numéro de téléphone invalide").max(32),
  shippingAddress: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    address: z.string().min(5),
    city: z.string().min(2),
    country: z.string().min(2),
    postalCode: z.string().optional(),
  }),
  billingAddress: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    address: z.string().min(5),
    city: z.string().min(2),
    country: z.string().min(2),
    postalCode: z.string().optional(),
  }).optional(),
  notes: z.string().max(500).optional(),
  paymentProvider: z.enum(["orange_money", "mtn_money", "moov_money", "wave", "cod", "bank_transfer"]),
});

function formatXOF(amount: number): string {
  return new Intl.NumberFormat("fr-CI", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(amount);
}

type WhatsAppAddress = {
  name: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  phone: string;
};

type WhatsAppOrder = {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: WhatsAppAddress;
  subtotal: number;
  shippingPrice: number;
  discountAmount: number;
  total: number;
  paymentProvider: string | null;
  notes: string | null;
  items: {
    productName: string;
    variantName?: string | null;
    quantity: number;
    total: number;
  }[];
};

type WhatsAppTenant = { id: string; name: string };

function buildWhatsAppMessage(order: WhatsAppOrder, tenant: WhatsAppTenant): string {
  const lines = [
    `🛍 *Nouvelle commande - ${tenant.name}*`,
    `📋 *Commande #${order.id.slice(-8).toUpperCase()}*`,
    "",
    `👤 *Client :* ${order.customerName}`,
    `📧 *Email :* ${order.customerEmail}`,
    `📱 *Téléphone :* ${order.customerPhone}`,
    "",
    `📦 *Adresse de livraison :*`,
    `${order.shippingAddress.name}`,
    `${order.shippingAddress.address}`,
    `${order.shippingAddress.city}${order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}`,
    `${order.shippingAddress.country}`,
    `${order.shippingAddress.phone}`,
    "",
    `🛒 *Articles :*`,
  ];

  for (const item of order.items) {
    lines.push(
      `• ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity} - ${formatXOF(item.total)}`
    );
  }

  lines.push("");
  lines.push(`💰 *Sous-total :* ${formatXOF(order.subtotal)}`);
  if (order.shippingPrice > 0) lines.push(`🚚 *Livraison :* ${formatXOF(order.shippingPrice)}`);
  if (order.discountAmount > 0) lines.push(`🎁 *Remise :* -${formatXOF(order.discountAmount)}`);
  lines.push(`💵 *Total :* ${formatXOF(order.total)}`);
  lines.push("");
  lines.push(`💳 *Paiement :* ${order.paymentProvider?.replace("_", " ").toUpperCase() || "À définir"}`);
  if (order.notes) lines.push(`📝 *Notes :* ${order.notes}`);
  lines.push("");
  lines.push(`🔗 Voir dans l'admin : ${process.env.NEXT_PUBLIC_APP_URL}/admin/tenants/${tenant.id}/orders/${order.id}`);

  return lines.join("\n");
}

/**
 * Créer une commande et envoyer la notification WhatsApp
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

    // Récupérer le panier
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cart = await getOrCreateCart(tenant.id, null, sessionId);
    if (!cart) return failure("Panier introuvable");

    const cartDetail = await getCartDetail(cart.id);
    if (!cartDetail || cartDetail.items.length === 0) {
      return failure("Votre panier est vide");
    }

    // Calculer les frais de livraison (pour l'instant, à 0 ou basé sur ShippingMethod)
    const shippingPrice = 0; // TODO: calculer selon la méthode choisie

    const subtotal = cartDetail.subtotal;
    const total = subtotal + shippingPrice;

    // Créer la commande en base
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          status: "PENDING",
          paymentStatus: "PENDING",
          paymentProvider: data.paymentProvider.toUpperCase() as PaymentProvider,
          billingAddress: data.billingAddress ?? data.shippingAddress,
          shippingAddress: data.shippingAddress,
          subtotal,
          shippingPrice,
          discountAmount: 0,
          taxAmount: 0,
          total,
          currency: tenant.currency,
          notes: data.notes,
          items: {
            create: cartDetail.items.map((item) => ({
              tenantId: tenant.id,
              productId: item.product.id,
              variantId: item.variant?.id ?? null,
              productName: item.product.name,
              variantName: item.variant?.name ?? null,
              sku: item.product.sku, // TODO: récupérer le SKU de la variante
              price: item.price,
              quantity: item.quantity,
              total: item.lineTotal,
            })),
          },
        },
      });

      // Créer l'enregistrement de paiement en attente
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          tenantId: tenant.id,
          provider: data.paymentProvider.toUpperCase() as PaymentProvider,
          status: "PENDING",
          amount: total,
          currency: tenant.currency,
        },
      });

      return newOrder;
    });

    // Libérer le stock réservé et décrémenter le stock réel
    for (const item of cartDetail.items) {
      if (item.variant?.id) {
        await prisma.inventory.update({
          where: { variantId: item.variant.id },
          data: {
            reservedQty: { decrement: item.quantity },
            quantity: { decrement: item.quantity },
          },
        });
      }
    }

    // Vider le panier
    await clearCart(cart.id);

    // Logger l'action
    await logAction({
      action: "order.create",
      userId: null, // Client non connecté
      tenantId: tenant.id,
      entity: "Order",
      entityId: order.id,
      metadata: {
        customerEmail: data.customerEmail,
        total,
        itemCount: cartDetail.itemCount,
        paymentProvider: data.paymentProvider,
      },
    });

    // Générer le lien WhatsApp
    const merchant = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { contactPhone: true },
    });
    const whatsappPhone = merchant?.contactPhone?.replace(/\D/g, "") || "225XXXXXXXXX"; // Numéro du marchand
    const message = buildWhatsAppMessage(
      {
        ...order,
        shippingAddress: data.shippingAddress,
        items: cartDetail.items.map((item) => ({
          productName: item.product.name,
          variantName: item.variant?.name,
          quantity: item.quantity,
          total: item.lineTotal,
        })),
      },
      tenant
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
    console.error("[storefront] createOrder error:", error);
    return failure(error instanceof Error ? error.message : "Erreur lors de la création de la commande");
  }
}