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
};

export default AsyncStorage;
