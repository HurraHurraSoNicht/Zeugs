import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { mockProducts } from '../data/mockProducts';
import { deleteProduct, fetchProducts, insertProduct, updateProduct } from '../services/productsApi';
import { submitRating } from '../services/ratingsApi';
import type { Product } from '../types/product';

interface ProductsContextValue {
  products: Product[];
  loading: boolean;
  error: string | null;
  addProduct: (product: Product) => Promise<Product>;
  editProduct: (id: string, product: Product) => Promise<Product>;
  removeProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  rateProduct: (id: string, deviceId: string, stars: number) => Promise<void>;
}

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

// Products live in Supabase now (see src/services/productsApi.ts) — this
// just mirrors the fetched list into local state so components don't each
// need their own loading logic. Falls back to the (now empty) mock seed if
// Supabase isn't configured or the fetch fails, so the rest of the app
// still renders instead of crashing.
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchProducts();
        if (!cancelled) {
          setProducts(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addProduct = useCallback(async (product: Product) => {
    const saved = await insertProduct(product);
    setProducts((current) => [saved, ...current]);
    return saved;
  }, []);

  const editProduct = useCallback(async (id: string, product: Product) => {
    const saved = await updateProduct(id, product);
    setProducts((current) => current.map((item) => (item.id === id ? saved : item)));
    return saved;
  }, []);

  const removeProduct = useCallback(async (id: string) => {
    await deleteProduct(id);
    setProducts((current) => current.filter((product) => product.id !== id));
  }, []);

  const getProductById = useCallback(
    (id: string) => products.find((product) => product.id === id),
    [products],
  );

  const rateProduct = useCallback(async (id: string, deviceId: string, stars: number) => {
    const { averageRating, ratingsCount } = await submitRating(id, deviceId, stars);
    setProducts((current) =>
      current.map((product) => (product.id === id ? { ...product, averageRating, ratingsCount } : product)),
    );
  }, []);

  const value = useMemo(
    () => ({ products, loading, error, addProduct, editProduct, removeProduct, getProductById, rateProduct }),
    [products, loading, error, addProduct, editProduct, removeProduct, getProductById, rateProduct],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts(): ProductsContextValue {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
