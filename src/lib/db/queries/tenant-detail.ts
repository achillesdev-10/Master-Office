import { type Role } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { maskEncrypted } from "@/lib/security/crypto";
import { getRootDomain } from "@/lib/db/queries/tenants";

/**
 * Requêtes des onglets de la fiche boutique (module 7).
 *
 * Les clés API sont toujours masquées côté serveur : le client ne
 * reçoit que les 4 derniers caractères.
 */

export type DomainType = "SUBDOMAIN" | "CUSTOM";

export type TenantDomainItem = {
  id: string;
  domain: string;
  type: DomainType;
  sslStatus: string;
  verified: boolean;
  verifiedAt: string | null;
  checkedAt: string | null;
  createdAt: string;
};

export type TenantPaymentItem = {
  id: string;
  provider: string;
  enabled: boolean;
  /** Derniers caractères de la clé, ou null si aucune clé enregistrée. */
  keyMasked: string | null;
  updatedAt: string;
};

export type ShippingItem = {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
};

export type TenantMemberItem = {
  id: string;
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type TenantStats = {
  members: number;
  admins: number;
  domains: number;
  verifiedDomains: number;
  activePayments: number;
  shippingMethods: number;
  auditLogs30d: number;
  theme: string | null;
  plan: string | null;
  clerkConnected: boolean;
};

function classifyDomain(domain: string): DomainType {
  return domain.toLowerCase().endsWith(`.${getRootDomain().toLowerCase()}`)
    ? "SUBDOMAIN"
    : "CUSTOM";
}

/** Domaines de la boutique (onglet Domaines). */
export async function getTenantDomains(
  tenantId: string,
): Promise<TenantDomainItem[]> {
  const rows = await prisma.tenantDomain.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    domain: row.domain,
    type: classifyDomain(row.domain),
    sslStatus: row.sslStatus,
    verified: row.verified,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Providers de paiement avec clés masquées (onglet Paiements). */
export async function getTenantPayments(
  tenantId: string,
): Promise<TenantPaymentItem[]> {
  const rows = await prisma.tenantPayment.findMany({
    where: { tenantId },
    orderBy: { provider: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    enabled: row.enabled,
    keyMasked: maskEncrypted(row.apiKeyEncrypted),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Méthodes de livraison (onglet Livraison), prix en centimes. */
export async function getTenantShipping(
  tenantId: string,
): Promise<ShippingItem[]> {
  const rows = await prisma.shippingMethod.findMany({
    where: { tenantId },
    orderBy: [{ enabled: "desc" }, { price: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    enabled: row.enabled,
  }));
}

/** Membres de la boutique (onglet Utilisateurs). */
export async function getTenantMembers(
  tenantId: string,
): Promise<TenantMemberItem[]> {
  const rows = await prisma.tenantUser.findMany({
    where: { tenantId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { email: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: row.user.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** KPIs simples de l'onglet Statistiques. */
export async function getTenantStats(tenantId: string): Promise<TenantStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [members, admins, domains, verifiedDomains, activePayments, shippingMethods, auditLogs30d, tenant] =
    await Promise.all([
      prisma.tenantUser.count({ where: { tenantId } }),
      prisma.tenantUser.count({ where: { tenantId, role: "ADMIN" } }),
      prisma.tenantDomain.count({ where: { tenantId } }),
      prisma.tenantDomain.count({ where: { tenantId, verified: true } }),
      prisma.tenantPayment.count({ where: { tenantId, enabled: true } }),
      prisma.shippingMethod.count({ where: { tenantId, enabled: true } }),
      prisma.auditLog.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          clerkOrgId: true,
          theme: { select: { name: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);

  return {
    members,
    admins,
    domains,
    verifiedDomains,
    activePayments,
    shippingMethods,
    auditLogs30d,
    theme: tenant?.theme?.name ?? null,
    plan: tenant?.plan?.name ?? null,
    clerkConnected: Boolean(tenant?.clerkOrgId),
  };
}
