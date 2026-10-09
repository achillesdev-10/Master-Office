"use server";

import { promises as dns } from "dns";
import { revalidatePath, revalidateTag } from "next/cache";
import { SslStatus, type User } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import { logAction } from "@/lib/audit/log";
import { addDomainSchema, getSslTarget } from "@/lib/validators/domain";
import { flattenErrors } from "@/lib/validators/tenant";
import { failure } from "@/lib/actions/types";
import type { ActionResult } from "@/lib/actions/types";
import { invalidateTenantCache } from "@/lib/tenant/provision";

const idSchema = z.string().cuid("Identifiant invalide");

/**
 * Server Actions des domaines (module 8 + onglet Domaines du module 7).
 *
 * Toutes les mutations passent par `requireSuperAdmin()`, une validation
 * Zod et le journal d'audit. Les appels réseau (DNS, Vercel) sont
 * isolés : une panne ne fait jamais échouer silencieusement l'action.
 */

async function getAdmin(): Promise<User | null> {
  try {
    return await requireSuperAdmin();
  } catch (error) {
    console.error("[domains] accès refusé", error);
    return null;
  }
}

/** Invalide la liste des domaines, sa fiche et l'onglet Domaines. */
function revalidateDomain(domainId: string, tenantId?: string): void {
  revalidatePath("/admin/domains");
  revalidatePath(`/admin/domains/${domainId}`);
  if (tenantId) revalidatePath(`/admin/tenants/${tenantId}/domains`);
  revalidatePath("/admin/tenants/[id]", "layout");
  revalidateTag("dashboard");
}

// ======================== AJOUT / SUPPRESSION ====================

/** Ajoute un domaine custom à une boutique (onglet Domaines). */
export async function addTenantDomain(input: unknown): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsed = addDomainSchema.safeParse(input);
    if (!parsed.success) {
      const { fieldErrors, formError } = flattenErrors(parsed.error);
      return failure(formError, fieldErrors);
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.data.tenantId, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) return failure("Boutique introuvable.");

    const existing = await prisma.tenantDomain.findUnique({
      where: { domain: parsed.data.domain },
      select: { id: true, tenant: { select: { name: true } } },
    });
    if (existing) {
      return failure(
        `Domaine déjà enregistré${existing.tenant ? ` (${existing.tenant.name})` : ""}.`,
        { domain: "Ce domaine est déjà utilisé." },
      );
    }

    const created = await prisma.tenantDomain.create({
      data: {
        domain: parsed.data.domain,
        tenantId: tenant.id,
        sslStatus: SslStatus.PENDING,
        verified: false,
      },
    });

    // Invalide le cache Redis pour inclure le nouveau domaine
    const allDomains = await prisma.tenantDomain.findMany({
      where: { tenantId: tenant.id },
      select: { domain: true },
    });
    await invalidateTenantCache(tenant.slug, allDomains.map((d) => d.domain));

    await logAction({
      action: "domain.add",
      userId: admin.id,
      tenantId: tenant.id,
      entity: "Domain",
      entityId: created.id,
      metadata: {
        domainId: created.id,
        domain: created.domain,
        result: "created",
      },
    });

    revalidateDomain(created.id, tenant.id);
    return {
      success: true,
      message: `Domaine ${created.domain} ajouté.`,
    };
  } catch (error) {
    console.error("[domains] ajout impossible", error);
    return failure("L'ajout du domaine a échoué.");
  }
}

/**
 * Supprime un domaine custom. Le sous-domaine automatique
 * `{slug}.{domaine racine}` est protégé (généré par la plateforme).
 */
export async function removeTenantDomain(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return failure("Identifiant invalide.");

    const domain = await prisma.tenantDomain.findUnique({
      where: { id: parsedId.data },
      select: {
        id: true,
        domain: true,
        tenantId: true,
        tenant: { select: { slug: true } },
      },
    });
    if (!domain) return failure("Domaine introuvable.");

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "maboutique.com";
    if (domain.domain.toLowerCase() === `${domain.tenant.slug}.${rootDomain}`.toLowerCase()) {
      return failure(
        "Le domaine automatique de la boutique ne peut pas être supprimé.",
      );
    }

    await prisma.tenantDomain.delete({ where: { id: domain.id } });

    // Invalide le cache Redis pour retirer le domaine supprimé
    const remainingDomains = await prisma.tenantDomain.findMany({
      where: { tenantId: domain.tenantId },
      select: { domain: true },
    });
    await invalidateTenantCache(domain.tenant.slug, remainingDomains.map((d) => d.domain));

    await logAction({
      action: "domain.remove",
      userId: admin.id,
      tenantId: domain.tenantId,
      entity: "Domain",
      entityId: domain.id,
      metadata: { domainId: domain.id, domain: domain.domain, result: "deleted" },
    });

    revalidateDomain(domain.id, domain.tenantId);
    return { success: true, message: `Domaine ${domain.domain} supprimé.` };
  } catch (error) {
    console.error("[domains] suppression impossible", error);
    return failure("La suppression a échoué.");
  }
}

// ======================== VÉRIFICATION DNS =======================

/**
 * Vérifie le CNAME du domaine (`dns.promises.resolveCname`) et met à
 * jour `verified` / `checkedAt` / `verifiedAt` + le journal d'audit.
 */
export async function verifyDomain(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return failure("Identifiant invalide.");

    const domain = await prisma.tenantDomain.findUnique({
      where: { id: parsedId.data },
      select: { id: true, domain: true, tenantId: true },
    });
    if (!domain) return failure("Domaine introuvable.");

    const target = getSslTarget().toLowerCase().replace(/\.$/, "");
    const now = new Date();

    let records: string[] = [];
    let ok = false;
    let dnsError: string | null = null;

    try {
      const raw = await dns.resolveCname(domain.domain);
      records = raw.map((record) => record.toLowerCase().replace(/\.$/, ""));
      ok = records.includes(target);
    } catch (error) {
      dnsError = error instanceof Error ? error.message : "Résolution impossible";
    }

    await prisma.tenantDomain.update({
      where: { id: domain.id },
      data: {
        verified: ok,
        checkedAt: now,
        verifiedAt: ok ? now : null,
      },
    });

    await logAction({
      action: "domain.verify",
      userId: admin.id,
      tenantId: domain.tenantId,
      entity: "Domain",
      entityId: domain.id,
      metadata: {
        domainId: domain.id,
        domain: domain.domain,
        result: ok ? "ok" : dnsError ? "absent" : "mismatch",
        records,
        target,
        ...(dnsError ? { dnsError } : {}),
      },
    });

    revalidateDomain(domain.id, domain.tenantId);

    if (ok) {
      return { success: true, message: `${domain.domain} vérifié (CNAME conforme).` };
    }
    if (dnsError) {
      return failure(
        `Aucun enregistrement CNAME trouvé pour ${domain.domain}. Ajoutez un CNAME vers ${target}.`,
      );
    }
    return failure(
      `CNAME trouvé (${records.join(", ")}) mais la cible attendue est ${target}.`,
    );
  } catch (error) {
    console.error("[domains] vérification impossible", error);
    return failure("La vérification DNS a échoué.");
  }
}

// ======================== SSL =====================================

/**
 * Déclenche (ou relance) la génération du certificat SSL.
 *
 * Pour l'instant, l'automatisation SSL n'est pas configurée.
 * Cette fonction retourne un échec explicite au lieu de simuler un succès.
 * L'intégration réelle (Vercel API ou autre provider) devra être ajoutée plus tard.
 */
export async function requestSsl(id: string): Promise<ActionResult> {
  try {
    const admin = await getAdmin();
    if (!admin) return failure("Accès refusé : rôle Super Admin requis.");

    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return failure("Identifiant invalide.");

    const domain = await prisma.tenantDomain.findUnique({
      where: { id: parsedId.data },
      select: { id: true, domain: true, tenantId: true, sslStatus: true },
    });
    if (!domain) return failure("Domaine introuvable.");
    if (domain.sslStatus === SslStatus.ACTIVE) {
      return { success: true, message: `SSL déjà actif pour ${domain.domain}.` };
    }

    // L'automatisation SSL n'est pas encore implémentée.
    // Ne pas modifier le statut ni prétendre qu'une demande a été faite.
    return failure(
      "Automatisation SSL non configurée. Intégration Vercel (ou autre provider) à connecter via VERCEL_API_TOKEN.",
    );
  } catch (error) {
    console.error("[domains] demande SSL impossible", error);
    return failure("La demande de certificat a échoué.");
  }
}