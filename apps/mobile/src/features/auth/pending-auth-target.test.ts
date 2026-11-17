import { describe, expect, it, vi } from "vitest";

import {
  PENDING_AUTH_TARGET_TTL_MS,
  decodePendingAuthTarget,
  encodePendingAuthTarget,
} from "./pending-auth-target";

// vi.mock è sollevato prima degli import da vitest.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() },
}));

const NOW = 1_800_000_000_000;

describe("pending auth target (HOM-15 §297)", () => {
  it("restituisce il target salvato entro la scadenza", () => {
    const raw = encodePendingAuthTarget("/content/profile_post/abc?origin=DEEP_LINK", NOW);

    expect(decodePendingAuthTarget(raw, NOW + PENDING_AUTH_TARGET_TTL_MS)).toBe(
      "/content/profile_post/abc?origin=DEEP_LINK",
    );
  });

  it("scarta un target scaduto: il login di giorni dopo non riporta al vecchio link", () => {
    const raw = encodePendingAuthTarget("/profile/abc", NOW);

    expect(decodePendingAuthTarget(raw, NOW + PENDING_AUTH_TARGET_TTL_MS + 1)).toBeNull();
  });

  it("scarta un istante nel futuro (orologio spostato)", () => {
    const raw = encodePendingAuthTarget("/profile/abc", NOW + 60_000);

    expect(decodePendingAuthTarget(raw, NOW)).toBeNull();
  });

  it("scarta valori assenti, malformati o senza istante", () => {
    expect(decodePendingAuthTarget(null, NOW)).toBeNull();
    expect(decodePendingAuthTarget("/profile/abc", NOW)).toBeNull();
    expect(decodePendingAuthTarget(JSON.stringify({ target: "/profile/abc" }), NOW)).toBeNull();
    expect(decodePendingAuthTarget(JSON.stringify({ savedAt: NOW, target: 42 }), NOW)).toBeNull();
  });
});
