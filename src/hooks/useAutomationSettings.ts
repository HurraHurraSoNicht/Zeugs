import { useCallback, useEffect, useState } from 'react';
import { fetchAutomationSettings, updateSitemapAutoCheckEnabled } from '../services/automationSettingsApi';
import type { AutomationSettings } from '../types/automationSettings';

// Only consumed by the Admin screen's "Neue Produkte gefunden" sub-page, so
// this is a plain fetch-on-mount hook rather than a shared Context like
// useProducts/useArticles.
export function useAutomationSettings() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchAutomationSettings();
        if (!cancelled) {
          setSettings(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Einstellungen konnten nicht geladen werden.');
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

  const setSitemapAutoCheckEnabled = useCallback(async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    // Optimistic update — the toggle should feel instant; rolled back below
    // if the write fails.
    setSettings((current) => (current ? { ...current, sitemapAutoCheckEnabled: enabled } : current));
    try {
      const saved = await updateSitemapAutoCheckEnabled(enabled);
      setSettings(saved);
    } catch (err) {
      setSettings((current) => (current ? { ...current, sitemapAutoCheckEnabled: !enabled } : current));
      setError(err instanceof Error ? err.message : 'Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, error, saving, setSitemapAutoCheckEnabled };
}
