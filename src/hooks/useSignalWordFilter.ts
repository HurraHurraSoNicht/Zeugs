import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'admin-new-products-signal-words';

// Persists the Admin "Neue Produkte gefunden" keyword filter across app
// restarts (same AsyncStorage pattern as src/utils/deviceId.ts), so the last
// entered signal words are still active after a reload.
export function useSignalWordFilter() {
  const [signalWords, setSignalWordsState] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (cancelled || !stored) {
        return;
      }
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((word) => typeof word === 'string')) {
          setSignalWordsState(parsed);
        }
      } catch {
        // Corrupt/old storage value — ignore and keep the empty default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSignalWords = (words: string[]) => {
    setSignalWordsState(words);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words)).catch(() => {});
  };

  return { signalWords, setSignalWords };
}
