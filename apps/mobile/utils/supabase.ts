import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "placeholder-anon-key";

export const hasSupabaseEnv =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!(
    process.env.EXPO_PUBLIC_SUPABASE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

if (__DEV__) {
  console.log("[supabase] env", {
    hasSupabaseEnv,
    keyPrefix: supabaseKey.slice(0, 20),
    url: supabaseUrl,
  });
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
