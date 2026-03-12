import type { Provider } from "@supabase/supabase-js";
import { Linking } from "react-native";

import { supabase } from "../../lib/supabase";

export const OAUTH_REDIRECT_URL = "footme://auth/callback";

export function extractOAuthCallbackParams(url: string) {
  const parsedUrl = new URL(url);
  const query = new URLSearchParams(parsedUrl.search);
  const hash = parsedUrl.hash.startsWith("#")
    ? parsedUrl.hash.slice(1)
    : parsedUrl.hash;
  const fragment = new URLSearchParams(hash);

  return {
    accessToken: query.get("access_token") ?? fragment.get("access_token") ?? "",
    code: query.get("code") ?? fragment.get("code") ?? "",
    refreshToken:
      query.get("refresh_token") ?? fragment.get("refresh_token") ?? "",
  };
}

export function isOAuthCallbackUrl(url: string) {
  return url.startsWith(OAUTH_REDIRECT_URL);
}

export async function completeOAuthSessionFromUrl(url: string) {
  if (!isOAuthCallbackUrl(url)) {
    return false;
  }

  const { accessToken, code, refreshToken } = extractOAuthCallbackParams(url);

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return true;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return true;
  }

  return false;
}

export async function startOAuthSignIn(provider: Extract<Provider, "apple" | "google">) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: OAUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("Impossibile avviare l'accesso social in questo momento.");
  }

  await Linking.openURL(data.url);
}
