"use server";

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
import { provisionCustomDomain, unprovisionCustomDomain } from "@/lib/tenant/provision";
import { addVercelDomain, removeVercelDomain, verifyVercelDomain, getVercelDomain, formatDnsRecords } from "@/lib/vercel/domains";

const idSchema = z.string().cuid("Identifiant invalide");

/**
 * Server Actions des domaines (module 8 + onglet Domaines du module 7).
 *
 * Toutes les mutations passent par `requireSuperAdmin()`, une validation
 * Zod et le journal d'audit. Les appels réseau (Vercel API) sont
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

function getProjectId(): string {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    throw new Error("VERCEL_PROJECT_ID manquant");
  }
  return projectId;
}

function getTeamId(): string | undefined {
  return process.env.VERCEL_TEAM_ID;
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

    // Ajoute le domaine sur Vercel
    let dnsRecords: { type: string; name: string; value: string; reason: string }[] = [];
    try {
      const projectId = getProjectId();
      const teamId = getTeamId();
      const vercelResult = await addVercelDomain(parsed.data.domain, projectId, teamId);
      dnsRecords = formatDnsRecords(vercelResult.dnsRecords);
    } catch (vercelError) {
      console.error("[domains] erreur Vercel à l'ajout", vercelError);
      // On continue quand même : le domaine sera ajouté en base mais sans config Vercel
    }

    const created = await prisma.tenantDomain.create({
      data: {
        domain: parsed.data.domain,
        tenantId: tenant.id,
        sslStatus: SslStatus.PENDING,
        verified: false,
      },
    });

    // Provisionne le domaine custom dans Redis (sans TTL)
    await provisionCustomDomain(tenant.slug, parsed.data.domain);

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
        dnsRecords,
      },
    });

    revalidateDomain(created.id, tenant.id);
    return {
      success: true,
      message: `Domaine ${created.domain} ajouté.`,
      dnsRecords,
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

    // Supprime le domaine de Vercel
    try {
      const projectId = getProjectId();
      const teamId = getTeamId();
      await removeVercelDomain(domain.domain, projectId, teamId);
    } catch (vercelError) {
      console.error("[domains] erreur Vercel à la suppression", vercelError);
      // On continue : on supprime de la base quand même
    }

    await prisma.tenantDomain.delete({ where: { id: domain.id } });

    // Retire le domaine custom de Redis
    await unprovisionCustomDomain(domain.domain);

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

// ======================== VÉRIFICATION VIA VERCEL ===================

/**
 * Vérifie le domaine via l'API Vercel (déclenche la vérification DNS chez Vercel)
 * et met à jour `verified` / `checkedAt` / `verifiedAt` + le journal d'audit.
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

    const projectId = getProjectId();
    const teamId = getTeamId();
    const now = new Date();

    let ok = false;
    let dnsError: string | null = null;
    let dnsRecords: { type: string; name: string; value: string; reason: string }[] = [];

    try {
      // Demande la vérification à Vercel
      const vercelDomain = await verifyVercelDomain(domain.domain, projectId, teamId);
      ok = vercelDomain.verified ?? false;
      dnsRecords = formatDnsRecords(vercelDomain.verification ?? []);
    } catch (vercelError) {
      dnsError = vercelError instanceof Error ? vercelError.message : "Erreur Vercel";
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
        result: ok ? "ok" : dnsError ? "error" : "pending",
        dnsRecords,
        ...(dnsError ? { dnsError } : {}),
      },
    });

    revalidateDomain(domain.id, domain.tenantId);

    if (ok) {
      return { success: true, message: `${domain.domain} vérifié par Vercel.` };
    }
    if (dnsError) {
      return failure(`Erreur lors de la vérification : ${dnsError}`);
    }
    return failure(`${domain.domain} en cours de vérification par Vercel. Réessayez dans quelques minutes.`);
  } catch (error) {
    console.error("[domains] vérification impossible", error);
    return failure("La vérification a échoué.");
  }
}

// ======================== SYNC STATUT VERCEL ======================

/**
 * Synchronise le statut du domaine avec Vercel (polling).
 */
export async function syncDomainStatus(id: string): Promise<ActionResult> {
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

    const projectId = getProjectId();
    const teamId = getTeamId();
    const now = new Date();

    let ok = false;
    let dnsRecords: { type: string; name: string; value: string; reason: string }[] = [];
    let sslStatus: SslStatus = SslStatus.PENDING;

    try {
      const vercelDomain = await getVercelDomain(domain.domain, projectId, teamId);
      if (vercelDomain) {
        ok = vercelDomain.verified ?? false;
        dnsRecords = formatDnsRecords(vercelDomain.verification ?? []);
        sslStatus = ok ? SslStatus.ACTIVE : SslStatus.PENDING;
      }
    } catch (vercelError) {
      console.error("[domains] sync erreur Vercel", vercelError);
    }

    await prisma.tenantDomain.update({
      where: { id: domain.id },
      data: {
        verified: ok,
        checkedAt: now,
        verifiedAt: ok ? now : null,
        sslStatus,
      },
    });

    await logAction({
      action: "domain.sync",
      userId: admin.id,
      tenantId: domain.tenantId,
      entity: "Domain",
      entityId: domain.id,
      metadata: {
        domainId: domain.id,
        domain: domain.domain,
        result: ok ? "ok" : "pending",
        dnsRecords,
      },
    });

    revalidateDomain(domain.id, domain.tenantId);

    if (ok) {
      return { success: true, message: `${domain.domain} synchronisé : SSL actif.` };
    }
    return failure(`${domain.domain} : vérification en cours ou échec.`);
  } catch (error) {
    console.error("[domains] sync impossible", error);
    return failure("La synchronisation a échoué.");
  }
}

// ======================== SSL =====================================

/**
 * Le SSL est géré automatiquement par Vercel une fois le domaine vérifié.
 * Cette fonction n'est plus nécessaire mais maintenue pour compatibilité.
 */
export async function requestSsl(id: string): Promise<ActionResult> {
  return failure(
    "SSL géré automatiquement par Vercel. Vérifiez le domaine d'abord.",
  );
}