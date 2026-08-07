import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../services/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  // Resolves to `{ confirmationRequired: true }` when Supabase didn't return
  // a session (email confirmation is on for this project) — the caller
  // shows a "check your inbox" message instead of expecting to be logged in.
  // `captchaToken` is required once Captcha protection is turned on in the
  // Supabase Dashboard (Authentication > Attack Protection) — see
  // RegisterScreen.tsx / TurnstileWidget.web.tsx for where it comes from.
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// App.tsx swaps its whole Stack.Navigator screen set (Login/Register vs.
// Tabs) based on `session` here, so signing in/out immediately shows the
// right screens without any extra navigation logic elsewhere.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      throw new Error(error.message);
    }
  };

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      throw new Error(error.message);
    }
    return { confirmationRequired: !data.session };
  };

  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  };

  const value = useMemo(() => ({ session, loading, signIn, signUp, signOut }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
