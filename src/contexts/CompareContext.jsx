"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const MAX_COMPARE = 4;
const STORAGE_KEY = "ab_compare";

const CompareContext = createContext({
  items: [],
  add: () => {},
  remove: () => {},
  toggle: () => {},
  clear: () => {},
  has: () => false,
  count: 0
});

export function CompareProvider({ children }) {
  const [items, setItems] = useState([]); // array of minimal product objects

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback(next => {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const add = useCallback(product => {
    setItems(current => {
      if (current.length >= MAX_COMPARE) return current;
      if (current.some(p => p.id === product.id)) return current;
      const minimal = {
        id: product.id,
        slug: product.slug,
        title: product.title || product.name,
        thumbnail: product.thumbnail || product.images?.[0] || null,
        price: product.price,
        brandRef: product.brandRef || null,
        brand: product.brand || null,
        sku: product.sku || null,
        specs: product.specs || null,
        stockQty: product.stockQty ?? 0,
        categoryName: product.categoryName || null
      };
      const next = [...current, minimal];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const remove = useCallback(productId => {
    setItems(current => {
      const next = current.filter(p => p.id !== productId);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const toggle = useCallback(product => {
    setItems(current => {
      if (current.some(p => p.id === product.id)) {
        const next = current.filter(p => p.id !== product.id);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      }
      if (current.length >= MAX_COMPARE) return current;
      const minimal = {
        id: product.id,
        slug: product.slug,
        title: product.title || product.name,
        thumbnail: product.thumbnail || product.images?.[0] || null,
        price: product.price,
        brandRef: product.brandRef || null,
        brand: product.brand || null,
        sku: product.sku || null,
        specs: product.specs || null,
        stockQty: product.stockQty ?? 0,
        categoryName: product.categoryName || null
      };
      const next = [...current, minimal];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setItems([]);
  }, []);

  const has = useCallback(productId => items.some(p => p.id === productId), [items]);

  return (
    <CompareContext.Provider value={{ items, add, remove, toggle, clear, has, count: items.length }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
