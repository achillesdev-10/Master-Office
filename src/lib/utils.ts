import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind de façon conditionnelle,
 * en résolvant les conflits (utilisé par tous les composants shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Formatters partagés (fr-CI pour XOF) — instanciés une seule fois. */
const numberFormatter = new Intl.NumberFormat("fr-CI");
const currencyFormatter = new Intl.NumberFormat("fr-CI", {
  style: "currency",
  currency: "XOF",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("fr-CI", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** 1234567 → "1 234 567" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 1297 → "1 297 FCFA" */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** 12.5 → "+12,5 %" ; -3 → "−3 %" */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)} %`;
}

/** Formate un montant en XOF (alias pour formatCurrency) */
export function formatXOF(value: number): string {
  return currencyFormatter.format(value);
}

/**
 * Normalise un numéro de téléphone ivoirien vers le format international sans +.
 * Ex: "07 01 02 03 04" → "2250701020304"
 * Ex: "+225 07 01 02 03 04" → "2250701020304"
 * Ex: "2250701020304" → "2250701020304"
 * Valide 8-15 chiffres.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");

  // Si commence par 225 (indicatif CI), garde tel quel
  if (digits.startsWith("225")) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  // Si commence par 0 (format national 10 chiffres), ajoute 225
  if (digits.startsWith("0") && digits.length === 10) {
    const normalized = "225" + digits.slice(1);
    return normalized.length >= 8 && normalized.length <= 15 ? normalized : null;
  }

  // Sinon, si longueur valide, suppose déjà format international
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/**
 * Vérifie si une URL appartient au tenant (blob Vercel Storage).
 * L'URL doit être hébergée sur *.blob.vercel-storage.com ET commencer par /tenants/${tenantId}/
 */
export function isOwnedBlobUrl(url: string, tenantId: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Vérifie que l'hôte est Vercel Blob
    if (!parsedUrl.hostname.endsWith(".blob.vercel-storage.com")) {
      return false;
    }
    // Vérifie que le chemin commence par /tenants/${tenantId}/
    return parsedUrl.pathname.startsWith(`/tenants/${tenantId}/`);
  } catch {
    return false;
  }
}
