import { useEffect, useState } from 'react';
import { fetchNewSitemapEntries } from '../services/manufacturersApi';
import type { NewSitemapEntry } from '../types/manufacturer';

// Only consumed by the Admin screen's "Neue Produkte gefunden" sub-page, so
// this is a plain fetch-on-mount hook rather than a shared Context like
// useProducts/useArticles.
export function useNewSitemapEntries() {
  const [entries, setEntries] = useState<NewSitemapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchNewSitemapEntries();
        if (!cancelled) {
          setEntries(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Neue Produkte konnten nicht geladen werden.');
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

  return { entries, loading, error };
}
