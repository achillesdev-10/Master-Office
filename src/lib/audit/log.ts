import { type Prisma } from "@prisma/client";
import { headers } from "next/headers";
import prisma from "@/lib/db/prisma";

/**
 * Journal d'activité (module 5/6 ; étendu par le module 12).
 *
 * `logAction` est appelée par toutes les Server Actions qui modifient
 * des données. Une échec d'écriture d'audit ne doit jamais faire
 * échouer l'action métier : l'erreur est journalisée puis ignorée.
 */

export type LogActionInput = {
  /** Code d'action : "tenant.create", "tenant.suspend", "tenant.delete"… */
  action: string;
  /** Super Admin à l'origine de l'action */
  userId?: string | null;
  tenantId?: string | null;
  /** Entité touchée : "Tenant", "Domain", "User", "Plan", "Theme"… */
  entity?: string | null;
  /** Identifiant de l'entité touchée */
  entityId?: string | null;
  /** Contexte structuré stocké dans `AuditLog.metadata` (JSON) */
  metadata?: Prisma.InputJsonObject;
};

/** Adresse IP du demandeur (derrière le proxy de la plateforme). */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip");
}

export async function logAction(input: LogActionInput): Promise<void> {
  try {
    const ip = await getRequestIp();
    await prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        ip,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] échec de l'action ${input.action}`, error);
  }
}
