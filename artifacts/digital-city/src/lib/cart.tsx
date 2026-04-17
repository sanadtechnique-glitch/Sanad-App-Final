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

// Promotion attached to a cart session (sourced from article.promo in the API)
export interface CartPromo {
  id: number;
  type: "qty" | "bundle";
  buyArticleId: number;
  getArticleId: number | null;
  getArticleNameAr: string | null;
  getArticleNameFr: string | null;
  getArticleImage: string | null;
  buyQty: number;
  getFreeQty: number;
  labelAr: string;
  labelFr: string;
}

// Derived free item (computed from cart items + promos — never stored)
export interface CartFreeItem {
  articleId: number;
  nameAr: string;
  nameFr: string;
  image?: string | null;
  freeQty: number;
  labelAr: string;
  labelFr: string;
  promoId: number;
}

export interface CartState {
  supplierId: number | null;
  supplierName: string;
  items: CartItem[];
  deliveryFee: number;
  promos: CartPromo[];
}

interface CartContextType {
  cart: CartState;
  addItem: (supplierId: number, supplierName: string, item: Omit<CartItem, "qty">, deliveryFee?: number) => void;
  removeItem: (itemId: number) => void;
  updateQty: (itemId: number, qty: number) => void;
  clearCart: () => void;
  setDeliveryFee: (fee: number) => void;
  setPromos: (promos: CartPromo[]) => void;
  total: number;
  itemCount: number;
  freeItems: CartFreeItem[];
  promoSavings: number;
}

export const WEIGHTED_STEP = 0.25;
export const UNIT_STEP = 1;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const EMPTY: CartState = { supplierId: null, supplierName: "", items: [], deliveryFee: 0, promos: [] };

// Compute free items from current cart items + active promotions
function computeFreeItems(items: CartItem[], promos: CartPromo[]): CartFreeItem[] {
  const result: CartFreeItem[] = [];
  for (const promo of promos) {
    const buyItem = items.find(i => i.id === promo.buyArticleId);
    if (!buyItem) continue;
    // Only whole-unit qty triggers promos (weighted items cannot have qty promos — validated at creation)
    const cycles = Math.floor(buyItem.qty / promo.buyQty);
    if (cycles < 1) continue;
    const freeQty = cycles * promo.getFreeQty;

    if (promo.type === "qty") {
      result.push({
        articleId: promo.buyArticleId,
        nameAr: buyItem.nameAr,
        nameFr: buyItem.name,
        image: buyItem.image,
        freeQty,
        labelAr: promo.labelAr,
        labelFr: promo.labelFr,
        promoId: promo.id,
      });
    } else if (promo.type === "bundle" && promo.getArticleId) {
      result.push({
        articleId: promo.getArticleId,
        nameAr: promo.getArticleNameAr ?? buyItem.nameAr,
        nameFr: promo.getArticleNameFr ?? buyItem.name,
        image: promo.getArticleImage,
        freeQty,
        labelAr: promo.labelAr,
        labelFr: promo.labelFr,
        promoId: promo.id,
      });
    }
  }
  return result;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(() => {
    try {
      const saved = localStorage.getItem("dc_cart");
      const parsed = saved ? JSON.parse(saved) : EMPTY;
      return { ...EMPTY, ...parsed, promos: parsed.promos ?? [] };
    } catch { return EMPTY; }
  });

  useEffect(() => {
    localStorage.setItem("dc_cart", JSON.stringify(cart));
  }, [cart]);

  const addItem = (supplierId: number, supplierName: string, item: Omit<CartItem, "qty">, deliveryFee = 0) => {
    const step = item.isWeighted ? WEIGHTED_STEP : UNIT_STEP;
    setCart(prev => {
      if (prev.supplierId !== null && prev.supplierId !== supplierId) {
        return { supplierId, supplierName, deliveryFee, items: [{ ...item, qty: step }], promos: [] };
      }
      const existing = prev.items.find(i => i.id === item.id);
      const items = existing
        ? prev.items.map(i => i.id === item.id ? { ...i, qty: round3(i.qty + step) } : i)
        : [...prev.items, { ...item, qty: step }];
      return { supplierId, supplierName, deliveryFee, items, promos: prev.promos };
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

  const setPromos = (promos: CartPromo[]) => {
    setCart(prev => ({ ...prev, promos }));
  };

  const freeItems   = computeFreeItems(cart.items, cart.promos);
  const subtotal    = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  // promoSavings = sum of (free-item price × freeQty) — we don't store the article price in CartPromo
  // so we approximate: for qty-type, the free article price is the same as the buy-item price
  const promoSavings = freeItems.reduce((sum, fi) => {
    const paidItem = cart.items.find(i => i.id === fi.articleId);
    return sum + (paidItem ? paidItem.price * fi.freeQty : 0);
  }, 0);
  const total     = subtotal + cart.deliveryFee;
  const itemCount = cart.items.length;

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQty, clearCart, setDeliveryFee, setPromos, total, itemCount, freeItems, promoSavings }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
