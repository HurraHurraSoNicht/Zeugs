import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'device-id';

// Anonymous per-install identifier — there's no login system, so this
// stands in for "user_id" when voting: one rating per device per product,
// persisted so re-voting overwrites the same row instead of adding a new one.
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }
  const generated = generateId();
  await AsyncStorage.setItem(STORAGE_KEY, generated);
  cachedDeviceId = generated;
  return generated;
}
