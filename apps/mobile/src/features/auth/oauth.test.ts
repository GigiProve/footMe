import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeOAuthSessionFromUrl,
  extractOAuthCallbackParams,
  startOAuthSignIn,
} from "./oauth";

const mocks = vi.hoisted(() => {
  return {
    exchangeCodeForSession: vi.fn(),
    openURL: vi.fn(),
    setSession: vi.fn(),
    signInWithOAuth: vi.fn(),
  };
});

vi.mock("react-native", () => ({
  Linking: {
    openURL: mocks.openURL,
  },
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      setSession: mocks.setSession,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  },
}));

describe("oauth helpers", () => {
  beforeEach(() => {
    mocks.exchangeCodeForSession.mockReset();
    mocks.openURL.mockReset();
    mocks.setSession.mockReset();
    mocks.signInWithOAuth.mockReset();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.setSession.mockResolvedValue({ error: null });
  });

  it("extracts access and refresh tokens from the callback fragment", () => {
    expect(
      extractOAuthCallbackParams(
        "footme://auth/callback#access_token=token-1&refresh_token=refresh-1",
      ),
    ).toEqual({
      accessToken: "token-1",
      code: "",
      refreshToken: "refresh-1",
    });
  });

  it("completes the OAuth session from access and refresh tokens", async () => {
    await expect(
      completeOAuthSessionFromUrl(
        "footme://auth/callback#access_token=token-1&refresh_token=refresh-1",
      ),
    ).resolves.toBe(true);

    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: "token-1",
      refresh_token: "refresh-1",
    });
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("completes the OAuth session from an authorization code", async () => {
    await expect(
      completeOAuthSessionFromUrl("footme://auth/callback?code=auth-code-1"),
    ).resolves.toBe(true);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code-1");
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("opens the provider authorization URL for social sign in", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://oauth.example.com/start" },
      error: null,
    });

    await startOAuthSignIn("google");

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      options: {
        redirectTo: "footme://auth/callback",
        skipBrowserRedirect: true,
      },
      provider: "google",
    });
    expect(mocks.openURL).toHaveBeenCalledWith("https://oauth.example.com/start");
  });
});
