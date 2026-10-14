"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireTenantAccess } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { failure, type ActionResult } from "@/lib/actions/types";
import { flattenErrors } from "@/lib/validators/tenant";

const updateOrderStatusSchema = z.object({
  id: z.string().cuid(),
  tenantId: z.string().cuid(),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
});

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const parsed = updateOrderStatusSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, tenantId, status } = parsed.data;

    await requireTenantAccess(tenantId);

    const order = await prisma.order.findUnique({
      where: { id, tenantId },
      select: { id: true, status: true, customerName: true },
    });

    if (!order) {
      return failure("Commande introuvable");
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      NEW: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return failure(`Transition de statut invalide : ${order.status} → ${status}`);
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    });

    await logAction({
      action: "order.status.update",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId,
      entity: "Order",
      entityId: order.id,
      metadata: { from: order.status, to: status, customerName: order.customerName },
    });

    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${order.id}`);
    return { success: true, message: `Statut mis à jour : ${status}` };
  } catch (error) {
    console.error("[orders] update status error:", error);
    return failure("Erreur lors de la mise à jour du statut");
  }
}

export async function getOrderDetails(tenantId: string, orderId: string) {
  await requireTenantAccess(tenantId);

  const order = await prisma.order.findUnique({
    where: { id: orderId, tenantId },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
          variant: { select: { name: true } },
        },
      },
    },
  });

    if (!order) return null;

    return {
      id: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      subtotal: order.subtotal,
      shippingPrice: order.shippingPrice,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      total: order.total,
      currency: order.currency,
      notes: order.notes,
      internalNotes: order.internalNotes,
      couponCode: order.couponCode,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      paymentReference: order.paymentReference,
      paidAt: order.paidAt,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        productImage: item.product.images[0]?.url ?? null,
      })),
    };
  }

export async function cancelOrder(tenantId: string, orderId: string): Promise<ActionResult> {
  try {
    await requireTenantAccess("");
    const { id, tenantId: inputTenantId } = { id: orderId, tenantId };

    await requireTenantAccess(inputTenantId);

    const order = await prisma.order.findUnique({
      where: { id, tenantId: inputTenantId },
      select: { id: true, status: true },
    });

    if (!order) {
      return failure("Commande introuvable");
    }

    if (order.status === "CANCELLED" || order.status === "DELIVERED") {
      return failure("Cette commande ne peut pas être annulée");
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await logAction({
      action: "order.cancel",
      userId: (await getCurrentUser())?.id ?? null,
      tenantId: inputTenantId,
      entity: "Order",
      entityId: order.id,
    });

    revalidatePath("/dashboard/orders");
    revalidatePath(`/dashboard/orders/${orderId}`);
    return { success: true, message: "Commande annulée" };
  } catch (error) {
    console.error("[orders] cancel error:", error);
    return failure("Erreur lors de l'annulation de la commande");
  }
}

// Helper
async function getCurrentUser() {
  const { getCurrentUser } = await import("@/lib/auth/permissions");
  return getCurrentUser();
}