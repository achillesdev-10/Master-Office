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
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(slug: string, items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey(slug), JSON.stringify(items));
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children, slug }: { children: ReactNode; slug: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setItems(getCartFromStorage(slug));
    setIsLoaded(true);
  }, [slug]);

  const saveAndNotify = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    saveCartToStorage(slug, newItems);
    // Dispatch custom event for other components to react
    window.dispatchEvent(new CustomEvent("cart-update", { detail: { slug, items: newItems } }));
  }, [slug]);

  const addItem = useCallback((productId: string, variantId?: string, quantity = 1) => {
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
            quantity: existingItem.quantity + quantity,
          };
        }
      } else {
        newItems = [...current, { productId, variantId, quantity }];
      }
      saveAndNotify(newItems);
      return newItems;
    });
  }, [saveAndNotify]);

  const removeItem = useCallback((productId: string, variantId?: string) => {
    setItems((current) => {
      const newItems = current.filter(
        (item) => !(item.productId === productId && item.variantId === variantId)
      );
      saveAndNotify(newItems);
      return newItems;
    });
  }, [saveAndNotify]);

  const updateQuantity = useCallback((productId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((current) => {
      const newItems = current.map((item) =>
        item.productId === productId && item.variantId === variantId
          ? { ...item, quantity }
          : item
      );
      saveAndNotify(newItems);
      return newItems;
    });
  }, [removeItem, saveAndNotify]);

  const clearCart = useCallback(() => {
    setItems([]);
    saveCartToStorage(slug, []);
    window.dispatchEvent(new CustomEvent("cart-update", { detail: { slug, items: [] } }));
  }, [slug]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, itemCount, addItem, removeItem, updateQuantity, clearCart, isLoaded }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(slug: string) {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}