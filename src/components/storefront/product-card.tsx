"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Tag, MessageSquare } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useCart } from "./cart-context";
import { normalizePhoneNumber } from "@/lib/utils";
import { useStore, storeHref } from "./store-context";
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
  tenantWhatsAppPhone?: string | null;
}

export function ProductCard({ product, tenantWhatsAppPhone }: ProductCardProps) {
  const { slug } = useStore();
  const { addItem } = useCart();
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.basePrice) / product.compareAtPrice!) * 100)
    : 0;

  const primaryImage = product.images[0]?.url;
  const whatsappPhone = normalizePhoneNumber(tenantWhatsAppPhone);
  const hasWhatsApp = !!whatsappPhone;
  const defaultVariant = product.variants[0];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (defaultVariant) {
      addItem(product.id, defaultVariant.id, 1);
    }
  };

  const handleWhatsAppOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!whatsappPhone || !defaultVariant) return;
    const message = encodeURIComponent(
      `Bonjour, je souhaite commander : ${product.name} ${defaultVariant.name ? `(${defaultVariant.name})` : ""} x1 — ${formatNumber(defaultVariant.price)} FCFA`
    );
    window.open(`https://wa.me/${whatsappPhone}?text=${message}`, "_blank");
  };

  return (
    <Link
      href={storeHref("", `/products/${product.slug}`)}
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

        <div className="mt-auto flex flex-col gap-2">
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

          <div className="flex gap-2">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className="flex-1 flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Ajouter ${product.name} au panier`}
            >
              <ShoppingCart className="size-5" aria-hidden />
              <span className="hidden sm:inline">Panier</span>
            </button>

            {hasWhatsApp && (
              <button
                onClick={handleWhatsAppOrder}
                disabled={!product.inStock}
                className="flex-1 flex h-10 items-center justify-center gap-2 rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Commander ${product.name} sur WhatsApp`}
              >
                <MessageSquare className="size-5" aria-hidden />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}