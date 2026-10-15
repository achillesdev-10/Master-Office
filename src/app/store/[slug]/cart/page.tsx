"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Gift, Loader2, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { getCartItemsDetail } from "@/lib/actions/storefront/checkout";
import { useCart } from "@/components/storefront/cart-context";
import { useStore, storeHref } from "@/components/storefront/store-context";

type Params = Promise<{ slug: string }>;

interface CartItemDetail {
  productId: string;
  variantId?: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    images: { url: string; altText: string | null }[];
    basePrice: number;
    compareAtPrice: number | null;
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    compareAtPrice: number | null;
    inStock: boolean;
    quantity: number;
  } | null;
  lineTotal: number;
  inStock: boolean;
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-lg border bg-card p-4">
            <div className="h-24 w-24 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-4 w-1/4 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartSummarySkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex justify-between">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      ))}
      <div className="h-10 w-full bg-muted rounded" />
    </div>
  );
}

function CartPage() {
  const { slug } = useStore();
  const { items, itemCount, removeItem, updateQuantity, clearCart, isLoaded } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartDetails, setCartDetails] = useState<{ items: CartItemDetail[]; subtotal: number }>({ items: [], subtotal: 0 });
  const [detailsLoading, setDetailsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    const fetchDetails = async () => {
      if (items.length === 0) {
        setCartDetails({ items: [], subtotal: 0 });
        setDetailsLoading(false);
        return;
      }
      setDetailsLoading(true);
      try {
        const cartItems = items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        }));
        const result = await getCartItemsDetail(slug, cartItems);
        if (result.success && result.items) {
          setCartDetails({ items: result.items, subtotal: result.subtotal || 0 });
        } else {
          toast.error((result as { error?: string }).error ?? "Erreur lors du chargement du panier");
          setCartDetails({ items: [], subtotal: 0 });
        }
      } catch {
        toast.error("Erreur lors du chargement du panier");
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchDetails();
  }, [items, isLoaded, slug]);

  const handleUpdateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
    } else {
      updateQuantity(productId, variantId, quantity);
    }
  };

  const handleRemove = (productId: string, variantId?: string) => {
    if (!window.confirm("Retirer cet article du panier ?")) return;
    removeItem(productId, variantId);
  };

  const handleClear = () => {
    if (!window.confirm("Vider complètement le panier ?")) return;
    clearCart();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartDetails.items.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    // Check for out of stock items
    const outOfStock = cartDetails.items.filter(item => !item.inStock);
    if (outOfStock.length > 0) {
      toast.error("Certains articles ne sont plus disponibles");
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cartDetails.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      const result = await submitOrderAction({
        slug,
        items: orderItems,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        notes: notes.trim() || undefined,
        website: "", // Honeypot
      });

      if (result.success && result.whatsappUrl) {
        toast.success("Commande créée ! Redirection vers WhatsApp...");
        clearCart();
        window.location.href = result.whatsappUrl;
        setTimeout(() => {
          window.open(result.whatsappUrl!, "_blank");
        }, 100);
      } else {
        toast.error(String(result.error || "Erreur lors de la création de la commande"));
      }
    } catch (error) {
      console.error("Erreur soumission commande:", error);
      toast.error("Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex-1 py-8 px-4">
        <CartSkeleton />
        <CartSummarySkeleton />
      </div>
    );
  }

  if (detailsLoading) {
    return (
      <div className="flex-1 py-8 px-4">
        <CartSkeleton />
        <CartSummarySkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Votre panier</h1>
          <p className="mt-2 text-muted-foreground">
            {itemCount} article{itemCount !== 1 ? "s" : ""}
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Liste des articles */}
          <div className="lg:col-span-2 space-y-4">
            {cartDetails.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-6 rounded-xl border bg-muted/50 p-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <ShoppingCart className="size-8 text-muted-foreground" aria-hidden />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Votre panier est vide</h2>
                  <p className="mt-2 text-muted-foreground">
                    Ajoutez des produits pour commencer vos achats.
                  </p>
                  <Link
                      href={storeHref("", "/products")}
                      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <ShoppingCart className="size-4" aria-hidden />
                      Continuer mes achats
                    </Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y" role="list">
{cartDetails.items.map((item) => {
                    // Prix payé = variant.price (ou product.basePrice si pas de variante)
                    // compareAtPrice sert seulement pour l'affichage barré
                    const price = item.variant?.price ?? item.product.basePrice;
                    const hasDiscount = item.variant?.compareAtPrice && item.variant.compareAtPrice > item.variant.price;
                    const heroImage = item.product.images[0]?.url;
                  return (
                    <li key={`${item.productId}-${item.variantId || "default"}`} className="flex gap-4 rounded-lg border bg-card p-4">
                      <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                        {heroImage ? (
                          <img
                            src={heroImage}
                            alt={item.product.images[0]?.altText || item.product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Gift className="size-8" aria-hidden />
                          </div>
                        )}
                        {!item.inStock && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-white text-xs font-medium">
                            Rupture
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Link
                              href={storeHref("", `/products/${item.product.slug}`)}
                              className="font-medium hover:underline truncate block"
                            >
                              {item.product.name}
                            </Link>
                            {item.variant && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.variant.name}
                              </p>
                            )}
                            <p className="mt-2 font-medium">
                              {formatNumber(price)} FCFA
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemove(item.productId, item.variantId)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Retirer l'article"
                            disabled={!item.inStock}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-lg border bg-background">
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity - 1)}
                              disabled={item.quantity <= 1 || !item.inStock}
                              className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Diminuer"
                            >
                              <Minus className="size-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(parseInt(e.target.value) || 1, 99));
                                handleUpdateQuantity(item.productId, item.variantId, val);
                              }}
                              className="h-9 w-12 border-0 bg-transparent text-center text-sm font-medium focus:outline-none"
                              min={1}
                              max={99}
                              disabled={!item.inStock}
                            />
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity + 1)}
                              disabled={!item.inStock}
                              className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Augmenter"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          {!item.inStock && (
                            <span className="text-sm text-destructive">Indisponible</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {formatNumber(item.lineTotal)} FCFA
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {cartDetails.items.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClear}
                  className="text-sm font-medium text-destructive hover:underline"
                >
                  Vider le panier
                </button>
              </div>
            )}
          </div>

          {/* Résumé de commande + Formulaire */}
          <div className="sticky top-24 space-y-6">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">Résumé de la commande</h2>

              <div className="space-y-2 text-sm border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatNumber(cartDetails.subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  <span className="text-green-600">À convenir avec le vendeur</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatNumber(cartDetails.subtotal)} FCFA</span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">💬 Livraison et paiement à convenir avec le vendeur sur WhatsApp</p>
              </div>
            </div>

            {/* Formulaire client */}
            <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">Informations pour la commande</h2>
              <p className="text-sm text-muted-foreground">
                Ces informations seront envoyées au vendeur via WhatsApp.
              </p>

              <div className="space-y-4">
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
              </div>

              <button
                type="submit"
                disabled={submitting || cartDetails.items.length === 0 || cartDetails.items.some(i => !i.inStock)}
                className="w-full flex h-12 items-center justify-center gap-2 rounded-lg bg-green-600 text-white font-medium transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    Création de la commande...
                  </>
                ) : (
                  <>
                    <MessageSquare className="size-5" aria-hidden />
                    Commander sur WhatsApp
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                En validant, vous serez redirigé vers WhatsApp pour finaliser avec le vendeur.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import { submitOrderAction } from "@/lib/actions/storefront/checkout";

export default async function CartPageWrapper({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  return (
    <div className="flex-1 py-8 px-4">
      <CartPage />
    </div>
  );
}