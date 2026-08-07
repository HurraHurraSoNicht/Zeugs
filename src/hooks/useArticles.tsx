import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { deleteArticle, fetchArticles, insertArticle, updateArticle } from '../services/articlesApi';
import type { Article } from '../types/article';

interface ArticlesContextValue {
  articles: Article[];
  loading: boolean;
  error: string | null;
  addArticle: (article: Article) => Promise<Article>;
  editArticle: (id: string, article: Article) => Promise<Article>;
  removeArticle: (id: string) => Promise<void>;
  getArticleById: (id: string) => Article | undefined;
}

const ArticlesContext = createContext<ArticlesContextValue | undefined>(undefined);

// Mirrors useProducts.tsx — articles live in Supabase (see
// src/services/articlesApi.ts), this just mirrors the fetched list into
// local state so the Snack-e-zine and Admin screens share one fetch.
export function ArticlesProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchArticles();
        if (!cancelled) {
          setArticles(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Artikel konnten nicht geladen werden.');
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

  const addArticle = useCallback(async (article: Article) => {
    const saved = await insertArticle(article);
    setArticles((current) => [saved, ...current]);
    return saved;
  }, []);

  const editArticle = useCallback(async (id: string, article: Article) => {
    const saved = await updateArticle(id, article);
    setArticles((current) => current.map((item) => (item.id === id ? saved : item)));
    return saved;
  }, []);

  const removeArticle = useCallback(async (id: string) => {
    await deleteArticle(id);
    setArticles((current) => current.filter((article) => article.id !== id));
  }, []);

  const getArticleById = useCallback(
    (id: string) => articles.find((article) => article.id === id),
    [articles],
  );

  const value = useMemo(
    () => ({ articles, loading, error, addArticle, editArticle, removeArticle, getArticleById }),
    [articles, loading, error, addArticle, editArticle, removeArticle, getArticleById],
  );

  return <ArticlesContext.Provider value={value}>{children}</ArticlesContext.Provider>;
}

export function useArticles(): ArticlesContextValue {
  const context = useContext(ArticlesContext);
  if (!context) {
    throw new Error('useArticles must be used within an ArticlesProvider');
  }
  return context;
}
