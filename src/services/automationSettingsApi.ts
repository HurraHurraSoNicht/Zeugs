import { extractFunctionError, getSupabase } from './supabaseClient';
import type { AutomationSettings } from '../types/automationSettings';

interface AutomationSettingsRow {
  sitemap_auto_check_enabled: boolean;
}

function rowToSettings(row: AutomationSettingsRow): AutomationSettings {
  return { sitemapAutoCheckEnabled: row.sitemap_auto_check_enabled };
}

// Reads are publicly allowed by RLS (see supabase/migrations/
// 0012_automation_settings.sql), so this goes straight to the table with the
// anon key, same as fetchProducts/fetchArticles.
export async function fetchAutomationSettings(): Promise<AutomationSettings> {
  const { data, error } = await getSupabase()
    .from('automation_settings')
    .select('sitemap_auto_check_enabled')
    .eq('id', 1)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return rowToSettings(data as AutomationSettingsRow);
}

// Writes go through the admin-settings Edge Function (service role key) —
// RLS blocks updates for the anon key on purpose, see that migration's
// comments and the admin-settings function's header.
export async function updateSitemapAutoCheckEnabled(enabled: boolean): Promise<AutomationSettings> {
  const { data, error } = await getSupabase().functions.invoke('admin-settings', {
    method: 'PUT',
    body: { sitemapAutoCheckEnabled: enabled },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  return data as AutomationSettings;
}
