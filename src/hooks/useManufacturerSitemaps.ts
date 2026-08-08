import { useEffect, useState } from 'react';
import { fetchManufacturerSitemapSummaries } from '../services/manufacturersApi';
import type { ManufacturerSitemapSummary } from '../types/manufacturer';

// Only consumed by the Admin screen's "Neue Produkte gefunden" sub-page, so
// this is a plain fetch-on-mount hook rather than a shared Context like
// useProducts/useArticles.
export function useManufacturerSitemaps() {
  const [summaries, setSummaries] = useState<ManufacturerSitemapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchManufacturerSitemapSummaries();
        if (!cancelled) {
          setSummaries(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sitemaps konnten nicht geladen werden.');
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

  return { summaries, loading, error };
}
