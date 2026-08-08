import { useCallback, useEffect, useState } from 'react';
import { fetchManufacturerSitemapSummaries } from '../services/manufacturersApi';
import type { ManufacturerSitemapSummary } from '../types/manufacturer';

// Only consumed by the Admin screen's "Neue Produkte gefunden" sub-page, so
// this is a plain fetch-on-mount hook rather than a shared Context like
// useProducts/useArticles.
export function useManufacturerSitemaps() {
  const [summaries, setSummaries] = useState<ManufacturerSitemapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fetched = await fetchManufacturerSitemapSummaries();
      setSummaries(fetched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sitemaps konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { summaries, loading, error, refresh: load };
}
