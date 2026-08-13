"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "contexts/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "utils/api";
import { FALLBACK_PRODUCT_IMAGE, normalizeProductImageUrl } from "utils/catalog";
import { purchaseQuantityErrorMessage } from "utils/purchase-quantity";

import { CART_RESET_EVENT, clearCartSession, ensureCartSessionId } from "utils/cart";

// =================================================================================

// =================================================================================
const INITIAL_STATE = {
  cart: [],
  total: 0
};

// ==============================================================

// ==============================================================

export const CartContext = createContext({});

function normalizeCart(apiCart) {
  const items = Array.isArray(apiCart?.items)
    ? apiCart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        variantName: item.variantName ?? null,
        variantAttributes: item.variantAttributes ?? null,
        slug: item.product?.slug || item.product?.id || item.productId || "",
        title: item.product?.name || "Product",
        thumbnail: normalizeProductImageUrl(item.product?.imageUrl || FALLBACK_PRODUCT_IMAGE),
        price: Number(item.unitPrice || 0),
        qty: item.quantity,
        availableStock: Number(item.availableStock ?? 0),
        maxPurchaseQty: item.maxPurchaseQty == null ? null : Number(item.maxPurchaseQty),
        effectiveMaxQuantity: Number(item.effectiveMaxQuantity ?? item.availableStock ?? 0),
        availabilityChanged: Boolean(item.availabilityChanged),
        total: Number(item.total || 0)
      }))
    : [];

  return {
    cart: items,
    total:
      typeof apiCart?.total === "number"
        ? apiCart.total
        : items.reduce((sum, item) => sum + item.price * item.qty, 0)
  };
}

export default function CartProvider({ children }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const [ready, setReady] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  const syncCart = useCallback(async () => {
    if (!isAuthenticated) {
      ensureCartSessionId();
    }

    const cart = await apiGet("/cart");
    setState(normalizeCart(cart));
    return cart;
  }, [isAuthenticated]);

  const addItem = useCallback(async (productId, quantity, variantId = null) => {
    try {
      setCartMessage("");
      const body = { productId, quantity };
      if (variantId) body.variantId = variantId;
      const cart = await apiPost("/cart/items", body);
      setState(normalizeCart(cart));
      return cart;
    } catch (error) {
      setCartMessage(purchaseQuantityErrorMessage(error));
      throw error;
    }
  }, []);

  const updateItem = useCallback(async (itemId, quantity) => {
    try {
      setCartMessage("");
      const cart = await apiPatch(`/cart/items/${itemId}`, { quantity });
      setState(normalizeCart(cart));
      return cart;
    } catch (error) {
      setCartMessage(purchaseQuantityErrorMessage(error));
      try {
        const freshCart = await apiGet("/cart");
        setState(normalizeCart(freshCart));
      } catch {}
      throw error;
    }
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const cart = await apiDelete(`/cart/items/${itemId}`);
    setState(normalizeCart(cart));
    return cart;
  }, []);

  const clearCart = useCallback(async () => {
    const cart = await apiDelete("/cart/clear");
    setState(normalizeCart(cart));
    return cart;
  }, []);

  const dispatch = useCallback(
    async (action) => {
      if (!action || typeof action !== "object") return;

      try {
        switch (action.type) {
          case "CHANGE_CART_AMOUNT": {
            const cartItem = action.payload;
            const nextQuantity = Number(cartItem?.qty ?? 0);

            if (!cartItem || Number.isNaN(nextQuantity)) {
              return;
            }

            if (cartItem.productId) {
              if (nextQuantity < 1) {
                await removeItem(cartItem.id);
                return;
              }

              await updateItem(cartItem.id, nextQuantity);
              return;
            }

            if (nextQuantity < 1) {
              return;
            }

            await addItem(cartItem.id, nextQuantity, cartItem.variantId ?? null);
            return;
          }

          case "CLEAR_CART":
            await clearCart();
            return;

          default:
            return;
        }
      } catch {
        // Quantity errors are exposed through cartMessage and reconciled above.
        return;
      }
    },
    [addItem, clearCart, removeItem, updateItem]
  );

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const loadCart = async () => {
      try {
        const cart = await syncCart();

        if (!cancelled) {
          setState(normalizeCart(cart));
        }
      } catch {
        if (!cancelled) {
          setState(INITIAL_STATE);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    loadCart();

    return () => {
      cancelled = true;
    };
  }, [authLoading, syncCart]);

  useEffect(() => {
    const handleCartReset = (event) => {
      if (event?.detail?.resetSession !== false) {
        clearCartSession();
      }

      setState(INITIAL_STATE);
    };

    window.addEventListener(CART_RESET_EVENT, handleCartReset);

    return () => {
      window.removeEventListener(CART_RESET_EVENT, handleCartReset);
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      ready,
      refreshCart: syncCart,
      addItem,
      cartMessage,
      clearCartMessage: () => setCartMessage("")
    }),
    [addItem, cartMessage, dispatch, ready, state, syncCart]
  );
  return <CartContext value={contextValue}>{children}</CartContext>;
}

/** Named convenience hook — mirrors the default hooks/useCart.js */
export function useCart() {
  return use(CartContext);
}
