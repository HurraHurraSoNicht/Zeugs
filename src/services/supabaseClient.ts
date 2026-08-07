import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const client: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Throws only when a feature actually needs Supabase, so the rest of the app
// (mock-data screens) keeps working before real project credentials exist.
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase ist nicht konfiguriert. Kopiere .env.example zu .env und trage die Zugangsdaten deines Supabase-Projekts ein.',
    );
  }
  return client;
}

// supabase-js's FunctionsHttpError only exposes the raw Response as `.context`
// — this pulls out the `{ error: string }` body our Edge Functions return,
// falling back to a generic message if the response wasn't JSON.
export async function extractFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') {
        return body.error;
      }
    } catch {
      // response body wasn't JSON, fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}
