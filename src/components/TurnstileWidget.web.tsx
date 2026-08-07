import { useEffect, useRef } from 'react';
import type { TurnstileWidgetProps } from './TurnstileWidget';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Loaded once and cached — re-mounting the widget (e.g. navigating away from
// and back to Register) reuses the already-loaded script instead of
// re-fetching it.
let scriptLoadPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile-Skript konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

// Real widget for web — see TurnstileWidget.tsx for the native no-op
// fallback Metro resolves this file against on iOS/Android.
export default function TurnstileWidget({ siteKey, onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled) {
          return;
        }
        if (!containerRef.current || !window.turnstile) {
          console.error('Turnstile: Skript geladen, aber window.turnstile oder Container-Element fehlt.');
          onError?.('Captcha konnte nicht initialisiert werden.');
          return;
        }
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: onVerify,
            'error-callback': (code: unknown) => {
              console.error('Turnstile error-callback:', code);
              onError?.(`Captcha-Fehler (Code ${code}). Prüfe die Domain-Konfiguration in Cloudflare.`);
            },
          });
        } catch (err) {
          console.error('Turnstile render() failed:', err);
          onError?.(err instanceof Error ? err.message : 'Captcha konnte nicht angezeigt werden.');
        }
      })
      .catch((err) => {
        // Visible now instead of swallowed — a failed script load (network
        // block, ad blocker, Cloudflare outage, ...) previously left no
        // trace at all, making it impossible to tell apart from a config
        // issue. The "Bitte bestätige das Captcha" validation in
        // RegisterScreen still blocks submit either way.
        console.error('Turnstile-Skript konnte nicht geladen werden:', err);
        onError?.('Captcha-Skript konnte nicht geladen werden (Netzwerk-/Blockierungsproblem).');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} />;
}
