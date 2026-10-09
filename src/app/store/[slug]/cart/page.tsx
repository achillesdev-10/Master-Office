"use client";

import { useEffect, use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Gift, Truck, Shield, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import {
  addToCartAction,
  updateCartItemAction,
  removeFromCartAction,
  clearCartAction,
  getCartDetailAction,
} from "@/lib/actions/storefront/cart";
import type { CartDetail } from "@/lib/db/queries/storefront/cart";

type Params = Promise<{ slug: string }>;

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
  const searchParams = useSearchParams();
  const router = useRouter();

  const [cart, setCart] = useState<CartDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      router.replace(`/store/${slug}/cart?sessionId=${newSessionId}`);
      return;
    }
    loadCart();
  }, [slug, searchParams, router]);

  const loadCart = async () => {
    setLoading(true);
    try {
      const result = await getCartDetailAction(slug);
      if (result.success && result.cart) {
        setCart(result.cart);
      } else {
        // Panier vide ou erreur : on affiche un panier vide
        setCart({ id: "", items: [], subtotal: 0, itemCount: 0, currency: "XOF" });
      }
    } catch (error) {
      console.error("Erreur chargement panier:", error);
      setCart({ id: "", items: [], subtotal: 0, itemCount: 0, currency: "XOF" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    setUpdating(itemId);
    try {
      const result = await updateCartItemAction({ slug, itemId, quantity });
      if (result.success) {
        toast.success("Panier mis à jour");
        loadCart();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur inattendue");
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!window.confirm("Retirer cet article du panier ?")) return;

    try {
      const result = await removeFromCartAction({ slug, itemId });
      if (result.success) {
        toast.success("Article retiré");
        loadCart();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur inattendue");
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Vider complètement le panier ?")) return;

    try {
      const result = await clearCartAction({ slug });
      if (result.success) {
        toast.success("Panier vidé");
        setCart({ id: "", items: [], subtotal: 0, itemCount: 0, currency: "XOF" });
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur inattendue");
    }
  };

  if (loading) {
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
            {cart?.itemCount || 0} article{cart?.itemCount !== 1 ? "s" : ""}
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Liste des articles */}
          <div className="lg:col-span-2 space-y-4">
            {cart?.items?.length === 0 ? (
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
                {cart?.items?.map((item) => (
                  <li key={item.id} className="flex gap-4 rounded-lg border bg-card p-4">
                    <div className="relative h-24 w-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {item.product.images[0]?.url ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Gift className="size-8" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/store/${slug}/products/${item.product.slug}`}
                            className="font-medium hover:underline"
                          >
                            {item.product.name}
                          </Link>
                          {item.variant && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.variant.name}
                            </p>
                          )}
                          <p className="mt-2 font-medium">
                            {formatNumber(item.price)} FCFA
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label={`Retirer ${item.product.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-lg border bg-background">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || updating === item.id}
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
                              handleUpdateQuantity(item.id, val);
                            }}
                            className="h-9 w-12 border-0 bg-transparent text-center text-sm font-medium focus:outline-none"
                            min={1}
                          />
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={updating === item.id}
                            className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-muted disabled:opacity-50"
                            aria-label="Augmenter"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {formatNumber(item.lineTotal)} FCFA
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {cart?.items?.length && cart?.items.length > 0 && (
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

          {/* Résumé de commande */}
          <div className="sticky top-24">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="text-lg font-semibold">Résumé de la commande</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatNumber(cart?.subtotal || 0)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison</span>
                  <span className="text-green-600">Offerte</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TVA</span>
                  <span>Incluse</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatNumber(cart?.subtotal || 0)} FCFA</span>
                </div>
              </div>

              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                <p className="font-medium">🎁 Livraison offerte pour cette commande !</p>
              </div>

              <Link
                href={`/store/${slug}/checkout`}
                className="block w-full rounded-lg bg-primary py-3 text-center text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <span className="flex items-center justify-center gap-2">
                  Passer la commande
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>

              <p className="text-center text-xs text-muted-foreground">
                En continuant, vous acceptez nos
                <a href="#" className="underline">CGV</a> et notre
                <a href="#" className="underline">politique de confidentialité</a>.
              </p>
            </div>
          </div>

          {/* Garanties */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                <p className="text-sm font-medium">Paiement sécurisé</p>
                <p className="text-xs text-muted-foreground">Orange Money, MTN, Wave...</p>
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