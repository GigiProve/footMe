import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE_AVATAR_URI, withDefaultProfileAvatar } from "./profile-avatar";

describe("withDefaultProfileAvatar", () => {
  it("returns the provided avatar when available", () => {
    expect(withDefaultProfileAvatar(" https://example.com/avatar.jpg ")).toBe(
      "https://example.com/avatar.jpg",
    );
  });

  it("falls back to the default blank avatar when the value is empty", () => {
    expect(withDefaultProfileAvatar("   ")).toBe(DEFAULT_PROFILE_AVATAR_URI);
  });
});
