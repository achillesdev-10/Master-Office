"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Tag } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    basePrice: number;
    compareAtPrice: number | null;
    images: { url: string; altText: string | null }[];
    variants: {
      id: string;
      name: string;
      price: number;
      attributes: Prisma.JsonValue | null;
    }[];
    inStock: boolean;
  };
  slug: string;
}

export function ProductCard({ product, slug }: ProductCardProps) {
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.basePrice) / product.compareAtPrice!) * 100)
    : 0;

  const primaryImage = product.images[0]?.url;

  return (
    <Link
      href={`/store/${slug}/products/${product.slug}`}
      className="group flex flex-col bg-card border rounded-xl overflow-hidden transition-all hover:shadow-lg hover:border-primary/50"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Tag className="size-12" aria-hidden />
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
            -{discountPercent}%
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="rounded-full bg-destructive px-3 py-1 text-sm font-medium text-white">
              Rupture de stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 truncate font-medium group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-col">
            {hasDiscount ? (
              <>
                <span className="text-lg font-bold">
                  {formatNumber(product.basePrice)} FCFA
                </span>
                <span className="text-sm line-through text-muted-foreground">
                  {formatNumber(product.compareAtPrice!)} FCFA
                </span>
              </>
            ) : (
              <span className="text-lg font-bold">
                {formatNumber(product.basePrice)} FCFA
              </span>
            )}
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!product.inStock}
            aria-label={`Ajouter ${product.name} au panier`}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </Link>
  );
}