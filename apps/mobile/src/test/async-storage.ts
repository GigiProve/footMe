// In-memory stub for @react-native-async-storage/async-storage. The real
// package talks to the native bridge, which is absent under Vitest/Node.
// Supabase's auth client only needs get/set/remove to resolve.
const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    store.set(key, value);
  },
  async removeItem(key: string) {
    store.delete(key);
  },
  async clear() {
    store.clear();
  },
  // La cache della Dashboard enumera e rimuove in blocco le chiavi di un
  // actor (DAS-REV-02 §15): senza queste due il logout non sarebbe testabile.
  async getAllKeys() {
    return [...store.keys()];
  },
  async multiRemove(keys: string[]) {
    keys.forEach((key) => store.delete(key));
  },
};

export default AsyncStorage;
