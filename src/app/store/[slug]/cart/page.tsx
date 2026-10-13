"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Gift, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { submitOrderAction } from "@/lib/actions/storefront/checkout";
import { useCart } from "@/components/storefront/cart-context";

type Params = Promise<{ slug: string }>;

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    images: { url: string; altText: string | null }[];
    variants: { id: string; name: string; price: number }[];
  };
  variant?: {
    id: string;
    name: string;
    price: number;
  } | null;
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

function CartPage({ slug }: { slug: string }) {
  const { items, itemCount, removeItem, updateQuantity, clearCart, isLoaded } = useCart(slug);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subtotal, setSubtotal] = useState(0);

  // Calculer le sous-total à partir des items (lineTotal doit être calculé côté client)
  useState(() => {
    const total = items.reduce((sum, item) => sum + ((item as { lineTotal?: number }).lineTotal ?? 0), 0);
    setSubtotal(total);
    return total;
  });

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
    if (items.length === 0) {
      toast.error("Votre panier est vide");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = items.map((item) => ({
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
      });

      if (result.success && result.whatsappUrl) {
        toast.success("Commande créée ! Redirection vers WhatsApp...");
        clearCart();
        // Redirige vers WhatsApp
        window.location.href = result.whatsappUrl;
        // Fallback : affiche aussi un bouton pour ouvrir WhatsApp
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
            {items.length === 0 ? (
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
                    href={`/store/${slug}/products`}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <ShoppingCart className="size-4" aria-hidden />
                    Continuer mes achats
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="divide-y" role="list">
                {items.map((item) => {
                  // Pour l'affichage, on a besoin des données produit complètes
                  // Dans une vraie app, on les récupèrerait via une query
                  return (
                    <li key={`${item.productId}-${item.variantId || "default"}`} className="flex gap-4 rounded-lg border bg-card p-4">
                      <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Gift className="size-8" aria-hidden />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Link
                              href={`/store/${slug}/products/${item.productId}`}
                              className="font-medium hover:underline"
                            >
                              Produit {item.productId.slice(-6)}
                            </Link>
                            {item.variantId && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Variante {item.variantId.slice(-6)}
                              </p>
                            )}
                            <p className="mt-2 font-medium">
                              {formatNumber(0)} FCFA
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemove(item.productId, item.variantId)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Retirer l'article"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-lg border bg-background">
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
                              aria-label="Diminuer"
                            >
                              <Minus className="size-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                handleUpdateQuantity(item.productId, item.variantId, val);
                              }}
                              className="h-9 w-12 border-0 bg-transparent text-center text-sm font-medium focus:outline-none"
                              min={1}
                            />
                            <button
                              onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity + 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted"
                              aria-label="Augmenter"
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {formatNumber(0)} FCFA
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {items.length > 0 && (
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
                  <span>{formatNumber(subtotal)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  <span className="text-green-600">À convenir avec le vendeur</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatNumber(subtotal)} FCFA</span>
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
                disabled={submitting || items.length === 0}
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

export default function CartPageWrapper({
  params,
}: {
  params: Params;
}) {
  const { slug } = use(params);
  return (
    <div className="flex-1 py-8 px-4">
      <CartPage slug={slug} />
    </div>
  );
}