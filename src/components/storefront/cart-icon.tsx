"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./cart-context";

interface CartIconProps {
  slug: string;
}

export function CartIcon({ slug }: CartIconProps) {
  const { itemCount } = useCart(slug);

  if (itemCount === 0) return null;

  return (
    <Link
      href={`/store/${slug}/cart`}
      className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      aria-label={`Panier (${itemCount} articles)`}
    >
      <ShoppingCart className="size-5" aria-hidden />
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
        {itemCount > 99 ? "99+" : itemCount}
      </span>
    </Link>
  );
}