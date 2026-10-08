"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { SubscriptionStatus, type User } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { flattenErrors } from "@/lib/validators/tenant";
import {
  assignPlanSchema,
  BILLING_PERIOD_DAYS,
  planSchema,
  subscriptionStatusSchema,
  updatePlanSchema,
} from "@/lib/validators/subscription";
import { failure } from "@/lib/actions/types";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Server Actions du module 10 (abonnements & plans).
 * Chaque mutation est validée par Zod, auditée et revalidée.
 */

async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[subscriptions] accès refusé", error);
    return null;
  }
}

function revalidateSubscriptions(): void {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/tenants");
  revalidateTag("dashboard");
  revalidatePath("/admin/dashboard");
}

function nextPeriodEnd(): Date {
  return new Date(Date.now() + BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

/** Attribue (ou change) le plan d’une boutique : abonnement + planId. */
export async function assignSubscription(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = assignPlanSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const [tenant, plan] = await Promise.all([
      prisma.tenant.findFirst({
        where: { id: parsed.data.tenantId, deletedAt: null },
        select: { id: true, name: true, planId: true },
      }),
      prisma.plan.findUnique({
        where: { id: parsed.data.planId },
        select: { id: true, name: true },
      }),
    ]);
    if (!tenant) return failure("Boutique introuvable.");
    if (!plan) return failure("Plan introuvable.");

    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startedAt: new Date(),
          currentPeriodEnd: nextPeriodEnd(),
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          canceledAt: null,
          currentPeriodEnd: nextPeriodEnd(),
        },
      }),
      prisma.tenant.update({
        where: { id: tenant.id },
        data: { planId: plan.id },
      }),
    ]);

    await logAction({
      action: "subscription.assign",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Subscription",
      entityId: plan.id,
      metadata: { planId: plan.id, plan: plan.name, previous: tenant.planId },
    });

    revalidateSubscriptions();
    return {
      success: true,
      message: `Plan « ${plan.name} » attribué à ${tenant.name}.`,
    };
  } catch (error) {
    console.error("[subscriptions] attribution impossible", error);
    return failure("L'attribution du plan a échoué.");
  }
}

/** Change le statut d’un abonnement (résiliation incluse). */
export async function changeSubscriptionStatus(
  input: unknown,
): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = subscriptionStatusSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { subscriptionId, status } = parsed.data;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        status: true,
        planId: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!subscription) return failure("Abonnement introuvable.");
    if (subscription.status === status) {
      return { success: true, message: "Statut inchangé." };
    }

    const cancelled = status === SubscriptionStatus.CANCELLED;

    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status,
          canceledAt: cancelled ? new Date() : null,
          ...(cancelled
            ? {}
            : subscription.status === SubscriptionStatus.CANCELLED
              ? { currentPeriodEnd: nextPeriodEnd() }
              : {}),
        },
      }),
      prisma.tenant.update({
        where: { id: subscription.tenant.id },
        data: { planId: cancelled ? null : subscription.planId },
      }),
    ]);

    await logAction({
      action: "subscription.status",
      userId: admin.id,
      tenantId: subscription.tenant.id,
      entity: "Subscription",
      entityId: subscription.id,
      metadata: {
        from: subscription.status,
        to: status,
      },
    });

    revalidateSubscriptions();
    return {
      success: true,
      message: `Abonnement de ${subscription.tenant.name} : ${status}.`,
    };
  } catch (error) {
    console.error("[subscriptions] changement de statut impossible", error);
    return failure("Le changement de statut a échoué.");
  }
}

// ======================== PLANS ==================================

/** Crée un plan d’abonnement. */
export async function createPlan(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = planSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const existing = await prisma.plan.findFirst({
      where: {
        OR: [{ slug: parsed.data.slug }, { name: parsed.data.name }],
      },
      select: { slug: true },
    });
    if (existing) {
      return failure("Ce plan existe déjà (nom ou slug).", {
        slug: "Slug déjà utilisé.",
      });
    }

    const plan = await prisma.plan.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        price: parsed.data.price,
        currency: parsed.data.currency.toUpperCase(),
        features: parsed.data.features,
      },
    });

    await logAction({
      action: "plan.create",
      userId: admin.id,
      entity: "Plan",
      entityId: plan.id,
      metadata: {
        name: plan.name,
        slug: plan.slug,
        price: plan.price,
        currency: plan.currency,
      },
    });

    revalidateSubscriptions();
    return { success: true, message: `Plan « ${plan.name} » créé.` };
  } catch (error) {
    console.error("[subscriptions] création de plan impossible", error);
    return failure("La création du plan a échoué.");
  }
}

/** Met à jour un plan (tarification et features comprises). */
export async function updatePlan(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = updatePlanSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }
    const { id, ...data } = parsed.data;

    const plan = await prisma.plan.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!plan) return failure("Plan introuvable.");

    const conflict = await prisma.plan.findFirst({
      where: {
        id: { not: id },
        OR: [{ slug: data.slug }, { name: data.name }],
      },
      select: { slug: true },
    });
    if (conflict) {
      return failure("Ce nom ou slug est déjà pris.", {
        slug: "Slug déjà utilisé.",
      });
    }

    const updated = await prisma.plan.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        price: data.price,
        currency: data.currency.toUpperCase(),
        features: data.features,
      },
    });

    await logAction({
      action: "plan.update",
      userId: admin.id,
      entity: "Plan",
      entityId: updated.id,
      metadata: {
        from: { name: plan.name, slug: plan.slug },
        to: {
          name: updated.name,
          slug: updated.slug,
          price: updated.price,
          currency: updated.currency,
        },
      },
    });

    revalidateSubscriptions();
    return { success: true, message: `Plan « ${updated.name} » mis à jour.` };
  } catch (error) {
    console.error("[subscriptions] mise à jour de plan impossible", error);
    return failure("La mise à jour du plan a échoué.");
  }
}

/** Supprime un plan non utilisé. */
export async function deletePlan(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const plan = await prisma.plan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: {
          select: { tenants: true, subscriptions: true },
        },
      },
    });
    if (!plan) return failure("Plan introuvable.");

    const used = plan._count.tenants + plan._count.subscriptions;
    if (used > 0) {
      return failure(
        `Impossible : « ${plan.name} » est utilisé par ${used} élément(s).`,
      );
    }

    await prisma.plan.delete({ where: { id: plan.id } });

    await logAction({
      action: "plan.delete",
      userId: admin.id,
      entity: "Plan",
      entityId: plan.id,
      metadata: { name: plan.name },
    });

    revalidateSubscriptions();
    return { success: true, message: `Plan « ${plan.name} » supprimé.` };
  } catch (error) {
    console.error("[subscriptions] suppression de plan impossible", error);
    return failure("La suppression du plan a échoué.");
  }
}
