import { TenantStatus } from "@prisma/client";

/**
 * Client API Vercel pour la gestion des domaines personnalisés.
 * Utilisé côté serveur (Node.js) uniquement.
 */

export type VercelDomain = {
  id: string;
  name: string;
  apexName: string;
  projectId: string;
  redirect: string | null;
  redirectStatusCode: number | null;
  gitBranch: string | null;
  updatedAt: string;
  createdAt: string;
  verified: boolean;
  verification: {
    type: "TXT" | "CNAME" | "A";
    domain: string;
    value: string;
    reason: string;
  }[];
  verifiedAt: string | null;
};

export type VercelDomainConfig = {
  domain: string;
  projectId: string;
  teamId?: string;
};

function getVercelHeaders(): Record<string, string> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error("VERCEL_API_TOKEN manquant");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(): string {
  return "https://api.vercel.com";
}

/**
 * Ajoute un domaine au projet Vercel.
 * Retourne la configuration DNS à communiquer au client.
 */
export async function addVercelDomain(
  domain: string,
  projectId: string,
  teamId?: string,
): Promise<{ domain: VercelDomain; dnsRecords: VercelDomain["verification"] }> {
  const url = new URL(`${getBaseUrl()}/v9/projects/${projectId}/domains`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getVercelHeaders(),
    body: JSON.stringify({ name: domain }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Vercel: ${error.error?.message ?? response.statusText}`);
  }

  const domainData = (await response.json()) as { domain: VercelDomain };
  return {
    domain: domainData.domain,
    dnsRecords: domainData.domain.verification ?? [],
  };
}

/**
 * Récupère les détails d'un domaine (statut de vérification).
 */
export async function getVercelDomain(
  domain: string,
  projectId: string,
  teamId?: string,
): Promise<VercelDomain | null> {
  const url = new URL(`${getBaseUrl()}/v9/projects/${projectId}/domains/${domain}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url.toString(), {
    headers: getVercelHeaders(),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Vercel: ${error.error?.message ?? response.statusText}`);
  }

  const data = (await response.json()) as { domain: VercelDomain };
  return data.domain;
}

/**
 * Supprime un domaine du projet Vercel.
 */
export async function removeVercelDomain(
  domain: string,
  projectId: string,
  teamId?: string,
): Promise<boolean> {
  const url = new URL(`${getBaseUrl()}/v9/projects/${projectId}/domains/${domain}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: getVercelHeaders(),
  });

  if (response.status === 404) return true;
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Vercel: ${error.error?.message ?? response.statusText}`);
  }

  return true;
}

/**
 * Demande la vérification d'un domaine (déclenche la vérification DNS chez Vercel).
 */
export async function verifyVercelDomain(
  domain: string,
  projectId: string,
  teamId?: string,
): Promise<VercelDomain> {
  const url = new URL(`${getBaseUrl()}/v9/projects/${projectId}/domains/${domain}/verify`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getVercelHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erreur Vercel: ${error.error?.message ?? response.statusText}`);
  }

  const data = (await response.json()) as { domain: VercelDomain };
  return data.domain;
}

/**
 * Formate les enregistrements DNS pour l'affichage dans l'UI admin.
 */
export function formatDnsRecords(verification: VercelDomain["verification"]): {
  type: string;
  name: string;
  value: string;
  reason: string;
}[] {
  return (verification ?? []).map((v) => ({
    type: v.type,
    name: v.domain,
    value: v.value,
    reason: v.reason,
  }));
}