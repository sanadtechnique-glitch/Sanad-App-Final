import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  id: number;
  name: string;
  nameAr: string;
  price: number;
  qty: number;
  image?: string;
  isWeighted?: boolean;
}
export interface CartState {
  supplierId: number | null;
  supplierName: string;
  items: CartItem[];
  deliveryFee: number;
}

interface CartContextType {
  cart: CartState;
  addItem: (supplierId: number, supplierName: string, item: Omit<CartItem, "qty">, deliveryFee?: number) => void;
  removeItem: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  clearCart: () => void;
  setDeliveryFee: (fee: number) => void;
  total: number;
  itemCount: number;
}

export const WEIGHTED_STEP = 0.25;
export const UNIT_STEP = 1;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const EMPTY: CartState = { supplierId: null, supplierName: "", items: [], deliveryFee: 0 };

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(() => {
    try {
      const saved = localStorage.getItem("dc_cart");
      return saved ? JSON.parse(saved) : EMPTY;
    } catch { return EMPTY; }
  });

  useEffect(() => {
    localStorage.setItem("dc_cart", JSON.stringify(cart));
  }, [cart]);

  const addItem = (supplierId: number, supplierName: string, item: Omit<CartItem, "qty">, deliveryFee = 0) => {
    const step = item.isWeighted ? WEIGHTED_STEP : UNIT_STEP;
    setCart(prev => {
      if (prev.supplierId !== null && prev.supplierId !== supplierId) {
        return { supplierId, supplierName, deliveryFee, items: [{ ...item, qty: step }] };
      }
      const existing = prev.items.find(i => i.id === item.id);
      const items = existing
        ? prev.items.map(i => i.id === item.id ? { ...i, qty: round3(i.qty + step) } : i)
        : [...prev.items, { ...item, qty: step }];
      return { supplierId, supplierName, deliveryFee, items };
    });
  };

  const removeItem = (itemId: number) => {
    setCart(prev => {
      const items = prev.items.filter(i => i.id !== itemId);
      return items.length === 0 ? EMPTY : { ...prev, items };
    });
  };

  const updateQty = (itemId: number, qty: number) => {
    const rounded = round3(qty);
    if (rounded <= 0) { removeItem(itemId); return; }
    setCart(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, qty: rounded } : i) }));
  };

  const clearCart = () => setCart(EMPTY);

  const setDeliveryFee = (fee: number) => {
    setCart(prev => ({ ...prev, deliveryFee: fee }));
  };

  const subtotal  = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const total     = subtotal + cart.deliveryFee;
  const itemCount = cart.items.length;

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQty, clearCart, setDeliveryFee, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
