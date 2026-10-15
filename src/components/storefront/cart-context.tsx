"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  addItem: (productId: string, variantId?: string, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, variantId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isLoaded: boolean;
}

const CART_STORAGE_PREFIX = "cart:";

function getStorageKey(slug: string): string {
  return `${CART_STORAGE_PREFIX}${slug}`;
}

function getCartFromStorage(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getStorageKey(slug));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem =>
      item && typeof item.productId === "string" && typeof item.quantity === "number" && item.quantity > 0
    );
  } catch {
    return [];
  }
}

function saveCartToStorage(slug: string, items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
  } catch {
    // Ignore localStorage errors (quota, privacy mode, etc.)
  }
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children, slug }: { children: ReactNode; slug: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial load from localStorage
  useEffect(() => {
    setItems(getCartFromStorage(slug));
    setIsLoaded(true);
  }, [slug]);

  // Persist to localStorage and emit cart-update event whenever items change
  useEffect(() => {
    if (!isLoaded) return;
    saveCartToStorage(slug, items);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cart-update", { detail: { slug, items } }));
    }
  }, [items, slug, isLoaded]);

  // Listen for storage events (cross-tab sync) and cart-update events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === getStorageKey(slug) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    const handleCartUpdate = (e: CustomEvent) => {
      if (e.detail?.slug === slug && Array.isArray(e.detail?.items)) {
        setItems(e.detail.items);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("cart-update", handleCartUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("cart-update", handleCartUpdate as EventListener);
    };
  }, [slug]);

  const addItem = useCallback((productId: string, variantId?: string, quantity = 1) => {
    if (quantity <= 0) return;
    setItems((current) => {
      const existingIndex = current.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );
      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = [...current];
        const existingItem = newItems[existingIndex];
        if (existingItem) {
          newItems[existingIndex] = {
            ...existingItem,
            quantity: Math.min(existingItem.quantity + quantity, 99),
          };
        }
      } else {
        newItems = [...current, { productId, variantId, quantity: Math.min(quantity, 99) }];
      }
      return newItems;
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems((current) => {
      return current.filter(
        (item) => !(item.productId === productId && item.variantId === variantId)
      );
    });
  }, []);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((current) => {
      return current.map((item) =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, quantity: Math.min(quantity, 99) }
          : item
      );
    });
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, itemCount, addItem, removeItem, updateQuantity, clearCart, isLoaded }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}