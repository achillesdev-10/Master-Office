import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind de façon conditionnelle,
 * en résolvant les conflits (utilisé par tous les composants shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* Formatters partagés (fr-FR) — instanciés une seule fois. */
const numberFormatter = new Intl.NumberFormat("fr-FR");
const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** 1234567 → "1 234 567" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 1297 → "1 297 €" */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** 12.5 → "+12,5 %" ; -3 → "−3 %" */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)} %`;
}
