"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, ChevronLeft, ChevronRight, Tag, MessageSquare, Minus, Plus, X, RotateCcw, Truck, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { normalizePhoneNumber } from "@/lib/utils";
import { useCart } from "./cart-context";
import { cn } from "@/lib/utils";
import { useStore, storeHref } from "./store-context";
import type { Prisma } from "@prisma/client";
import { submitOrderAction } from "@/lib/actions/storefront/checkout";

interface ProductDetailClientProps {
  initialProduct: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    shortDescription: string | null;
    basePrice: number;
    compareAtPrice: number | null;
    sku: string | null;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    requiresShipping: boolean;
    trackInventory: boolean;
    metaTitle: string | null;
    metaDescription: string | null;
    images: { id: string; url: string; altText: string | null; position: number }[];
    variants: {
      id: string;
      name: string;
      sku: string | null;
      price: number;
      compareAtPrice: number | null;
      weight: number | null;
      attributes: Prisma.JsonValue | null;
      inStock: boolean;
      quantity: number;
      images: { url: string; altText: string | null }[];
    }[];
    category: { id: string; name: string; slug: string } | null;
    relatedProducts: {
      id: string;
      name: string;
      slug: string;
      shortDescription: string | null;
      basePrice: number;
      compareAtPrice: number | null;
      images: { url: string; altText: string | null }[];
      category: { id: string; name: string; slug: string } | null;
      variants: { id: string; name: string; price: number; attributes: Prisma.JsonValue | null }[];
      inStock: boolean;
    }[];
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    contactPhone?: string | null;
  };
}

interface WhatsAppOrderInput {
  slug: string;
  items: { productId: string; variantId?: string; quantity: number }[];
  customerName: string;
  customerPhone: string;
  address: string;
  notes?: string;
}

export function ProductDetailClient({ initialProduct, tenant }: ProductDetailClientProps) {
  const { slug } = useStore();
  const { addItem } = useCart();
  const [product] = useState(initialProduct);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.find((v) => v.inStock) || product.variants[0] || null
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdding] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (product.metaTitle) document.title = `${product.metaTitle} - ${tenant.name}`;
    else document.title = `${product.name} - ${tenant.name}`;
  }, [product, tenant.name]);

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.basePrice) / product.compareAtPrice!) * 100)
    : 0;

  const currentPrice = selectedVariant?.price ?? product.basePrice;
  const currentCompareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const productInStock = product.variants.some((v) => v.inStock);
  const currentInStock = selectedVariant?.inStock ?? productInStock;
  const currentQuantity = selectedVariant?.quantity ?? 0;
  const heroImage = product.images[selectedImageIndex]?.url ?? product.images[0]?.url;
  const whatsappPhone = normalizePhoneNumber(tenant.contactPhone);
  const hasWhatsApp = !!whatsappPhone;

  const handleAddToCart = () => {
    if (!selectedVariant || !currentInStock) return;
    if (selectedVariant) {
      addItem(product.id, selectedVariant.id, quantity);
      toast.success(`${product.name} ajouté au panier`);
    }
  };

  const handleWhatsAppOrderClick = () => {
    if (!hasWhatsApp || !selectedVariant || !currentInStock) return;
    setOrderFormOpen(true);
  };

  const handleWhatsAppOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    if (!currentInStock) {
      toast.error("Ce produit n'est plus disponible");
      return;
    }

    setIsOrdering(true);
    try {
      const result = await submitOrderAction({
        slug: tenant.slug,
        items: [{ productId: product.id, variantId: selectedVariant?.id, quantity }],
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        notes: notes.trim() || undefined,
        website: "", // Honeypot
      });

      if (result.success && result.whatsappUrl) {
        toast.success("Commande créée ! Redirection vers WhatsApp...");
        setOrderFormOpen(false);
        window.location.href = result.whatsappUrl;
        setTimeout(() => {
          window.open(result.whatsappUrl, "_blank");
        }, 100);
      } else {
        toast.error(String(result.error || "Erreur lors de la création de la commande"));
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setIsOrdering(false);
    }
  };

  const incrementQty = () => setQuantity((q) => Math.min(q + 1, currentQuantity || 99));
  const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Fil d'Ariane */}
      <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-label="Fil d'Ariane">
        <Link href={storeHref("", "/")} className="hover:underline">
          Accueil
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href={storeHref("", "/products")} className="hover:underline">
          Catalogue
        </Link>
        {product.category && (
          <>
            <ChevronRight className="size-4" aria-hidden />
            <Link href={storeHref("", `/products?category=${product.category.slug}`)} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="size-4" aria-hidden />
        <span className="truncate text-foreground max-w-xs" aria-current="page">
          {product.name}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galerie d'images */}
        <div className="space-y-4">
          <div
            className="relative aspect-square rounded-xl overflow-hidden bg-muted"
            style={{ background: "var(--store-primary)" }}
          >
            {heroImage ? (
              <Image
                src={heroImage}
                alt={product.images[selectedImageIndex]?.altText || product.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Tag className="size-16" aria-hidden />
              </div>
            )}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedImageIndex((i) =>
                      i === 0 ? product.images.length - 1 : i - 1
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white transition-colors"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  onClick={() =>
                    setSelectedImageIndex((i) =>
                      i === product.images.length - 1 ? 0 : i + 1
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white transition-colors"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={cn(
                    "relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors",
                    idx === selectedImageIndex
                      ? "border-primary"
                      : "border-transparent hover:border-primary/50"
                  )}
                  aria-label={`Voir l'image ${idx + 1}`}
                  aria-current={idx === selectedImageIndex ? "true" : "false"}
                >
                  <Image
                    src={img.url}
                    alt={img.altText || `${product.name} - Image ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                <Tag className="size-3.5" aria-hidden />
                Économie de {Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100)}%
              </span>
            )}
            {!productInStock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                Rupture de stock
              </span>
            )}
            {product.trackInventory && product.variants.some((v) => v.quantity > 0 && v.quantity < 10) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-3 py-1 text-sm font-medium text-amber">
                Stock limité
              </span>
            )}
          </div>
        </div>

        {/* Infos produit */}
        <div className="space-y-6">
          {/* Catégorie */}
          {product.category && (
            <Link
              href={`/store/${tenant.slug}/products?category=${product.category.slug}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span>Catégorie :</span>
              <span className="font-medium text-foreground">{product.category.name}</span>
            </Link>
          )}

          {/* Titre */}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>

          {/* Prix */}
          <div className="flex flex-wrap items-baseline gap-4">
            <span className="text-3xl font-bold">
              {formatNumber(currentPrice)} FCFA
            </span>
            {hasDiscount && (
              <>
                <span className="text-xl line-through text-muted-foreground">
                  {formatNumber(currentCompareAtPrice!)} FCFA
                </span>
                <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>

          {/* SKU */}
          {product.sku && (
            <p className="text-sm text-muted-foreground">
              Référence : <span className="font-mono text-foreground">{product.sku}</span>
            </p>
          )}

          {/* Description courte */}
          {product.shortDescription && (
            <p className="text-muted-foreground">{product.shortDescription}</p>
          )}

          {/* Sélection de variante */}
          {product.variants.length > 1 && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Choisir une option</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {product.variants.map((variant) => (
                  <label
                    key={variant.id}
                    className={cn(
                      "relative flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors",
                      selectedVariant?.id === variant.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50",
                      !variant.inStock && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={variant.id}
                      checked={selectedVariant?.id === variant.id}
                      onChange={() => setSelectedVariant(variant)}
                      disabled={!variant.inStock}
                      className="sr-only"
                    />
                    <span className="truncate">{variant.name}</span>
                    {hasDiscount && variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-white">
                        -{Math.round(((variant.compareAtPrice! - variant.price) / variant.compareAtPrice!) * 100)}%
                      </span>
                    )}
                    {!variant.inStock && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-white text-xs font-medium">
                        Rupture
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Quantité */}
          <div className="space-y-2">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantité
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border bg-background">
                <button
                  type="button"
                  onClick={decrementQty}
                  disabled={quantity <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Diminuer la quantité"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, product.variants[0]?.quantity || 99));
                    setQuantity(val);
                  }}
                  className="h-10 w-16 border-0 bg-transparent text-center text-base font-medium focus:outline-none"
                  min={1}
                  max={product.variants[0]?.quantity || 99}
                />
                <button
                  type="button"
                  onClick={incrementQty}
                  disabled={quantity >= (product.variants[0]?.quantity || 99)}
                  className="flex h-10 w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Augmenter la quantité"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
              {currentQuantity > 0 && (
                <span className="text-sm text-muted-foreground">
                  {currentQuantity} en stock
                </span>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2">
            <button
              onClick={handleAddToCart}
              disabled={isAdding || !currentInStock}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAdding ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Ajout en cours...
                </>
              ) : !currentInStock ? (
                <>
                  <X className="size-5" aria-hidden />
                  Rupture de stock
                </>
              ) : (
                <>
                  <ShoppingCart className="size-5" aria-hidden />
                  Ajouter au panier
                </>
              )}
            </button>

            {hasWhatsApp && (
              <button
                onClick={handleWhatsAppOrderClick}
                disabled={!currentInStock || isOrdering}
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="size-5" aria-hidden />
                <span>Commander sur WhatsApp</span>
              </button>
            )}
          </div>

          {/* Garanties */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2 rounded-lg bg-background/50 p-4 border">
              <Truck className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Livraison rapide</p>
                <p className="text-xs text-muted-foreground">Partout en CI</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background/50 p-4 border">
              <Shield className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Paiement à convenir</p>
                <p className="text-xs text-muted-foreground">Avec le vendeur</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background/50 p-4 border">
              <RotateCcw className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Retour 14 jours</p>
                <p className="text-xs text-muted-foreground">Satisfait ou remboursé</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background/50 p-4 border">
              <Truck className="size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Support client</p>
                <p className="text-xs text-muted-foreground">Disponible 7j/7</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description complète */}
      <div className="mt-12 border-t pt-8">
        <h2 className="mb-4 text-2xl font-semibold">Description</h2>
        {product.description ? (
          <div className="prose max-w-none text-muted-foreground">
            <p>{product.description}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Aucune description disponible.</p>
        )}

        {/* Spécifications */}
        {(product.weight || product.length || product.width || product.height) && (
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold">Spécifications</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              {product.weight && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <dt className="text-muted-foreground">Poids</dt>
                  <dd className="font-medium">{product.weight} g</dd>
                </div>
              )}
              {product.length && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <dt className="text-muted-foreground">Longueur</dt>
                  <dd className="font-medium">{product.length} cm</dd>
                </div>
              )}
              {product.width && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <dt className="text-muted-foreground">Largeur</dt>
                  <dd className="font-medium">{product.width} cm</dd>
                </div>
              )}
              {product.height && (
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <dt className="text-muted-foreground">Hauteur</dt>
                  <dd className="font-medium">{product.height} cm</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Produits connexes */}
      {product.relatedProducts.length > 0 && (
        <section className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Vous aimerez aussi</h2>
            <Link
              href={storeHref("", "/products")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Voir tout le catalogue →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {product.relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} tenantWhatsAppPhone={tenant.contactPhone} />
            ))}
          </div>
        </section>
      )}

      {/* Modal commande WhatsApp */}
      {orderFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOrderFormOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Commander sur WhatsApp</h2>
              <button onClick={() => setOrderFormOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Remplissez vos informations pour commander <strong>{product.name}</strong>
              {selectedVariant && <span> ({selectedVariant.name})</span>}
              x{quantity}
            </p>
            <form onSubmit={handleWhatsAppOrderSubmit} className="space-y-4">
              <div>
                <label htmlFor="customerName" className="block text-sm font-medium mb-1">
                  Nom complet <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Votre nom complet"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium mb-1">
                  Téléphone <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: 07 01 02 03 04"
                  required
                />
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium mb-1">
                  Quartier / Adresse <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Cocody, Abidjan - Rue des Jardins, Lot 12"
                  required
                />
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-1">
                  Notes (optionnel)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Instructions de livraison, code porte, etc."
                />
              </div>
              <button
                type="submit"
                disabled={isOrdering}
                className="w-full flex h-12 items-center justify-center gap-2 rounded-lg bg-green-600 text-white font-medium transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOrdering ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    Création de la commande...
                  </>
                ) : (
                  <>
                    <MessageSquare className="size-5" aria-hidden />
                    Commander sur WhatsApp
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export ProductCard pour éviter l'import circulaire
import { ProductCard } from "./product-card";