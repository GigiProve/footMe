// React Native and Expo modules assume the `__DEV__` global injected by Metro.
// Vitest runs in Node, where it is absent, so `if (__DEV__)` guards (e.g. in
// expo-modules-core and utils/supabase) throw `ReferenceError: __DEV__ is not
// defined` on import. Define it up front. `false` keeps tests production-like
// and suppresses dev-only debug logging.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
