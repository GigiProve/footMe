// React Native and Expo modules assume the `__DEV__` global injected by Metro.
// Vitest runs in Node, where it is absent, so `if (__DEV__)` guards (e.g. in
// expo-modules-core and utils/supabase) throw `ReferenceError: __DEV__ is not
// defined` on import. Define it up front. `false` keeps tests production-like
// and suppresses dev-only debug logging.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// `@supabase/realtime-js` (2.100+) requires a WebSocket constructor at import
// time and refuses to fall back on Node < 22, which has no global one. Node 20
// is what `engines` targets, so provide the `ws` implementation here rather
// than passing a transport through the production client in utils/supabase.
// React Native supplies its own global WebSocket, so this is test-only.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket: NodeWebSocket } = require("ws") as {
    WebSocket: unknown;
  };
  (globalThis as { WebSocket?: unknown }).WebSocket = NodeWebSocket;
}
