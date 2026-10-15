import type { Prisma } from "@prisma/client";

/**
 * Résout le prix unitaire d'une ligne de commande.
 * Le prix payé est TOUJOURS variant.price (ou product.basePrice si pas de variante).
 * compareAtPrice ne sert qu'à l'affichage barré.
 */
export function resolveLinePrice(
  product: { basePrice: number; compareAtPrice: number | null },
  variant: { price: number; compareAtPrice: number | null } | null
): { price: number; compareAtPrice: number | null } {
  if (variant) {
    return { price: variant.price, compareAtPrice: variant.compareAtPrice };
  }
  return { price: product.basePrice, compareAtPrice: product.compareAtPrice };
}

/**
 * Calcule le total d'une ligne (prix unitaire * quantité).
 */
export function calculateLineTotal(
  product: { basePrice: number; compareAtPrice: number | null },
  variant: { price: number; compareAtPrice: number | null } | null,
  quantity: number
): number {
  const { price } = resolveLinePrice(product, variant);
  return price * quantity;
}