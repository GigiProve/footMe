import { describe, expect, it } from "vitest";

import {
  colors,
  radius,
  sizes,
  spacing,
  typography,
  zIndex,
} from "./tokens";

describe("theme tokens", () => {
  it("re-exports the shared color palette and semantic states", () => {
    expect(colors.background).toBe("#F4F8FB");
    expect(colors.surface).toBe("#FFFFFF");
    expect(colors.accent).toBe("#0A66C2");
    expect(colors.hero).toBe("#004182");
    expect(colors.surfaceOverlay).toBe("rgba(255,255,255,0.16)");
    expect(colors.buttonDisabled).toBe("#A7C6E6");
  });

  it("exposes spacing, radius, sizing and typography scales used by the UI", () => {
    expect(spacing[16]).toBe(16);
    expect(radius.full).toBe(999);
    expect(sizes.touchTarget).toBeGreaterThanOrEqual(44);
    expect(sizes.tabBarHeight).toBe(72);
    expect(sizes.recruitingDescriptionMinHeight).toBe(120);
    expect(typography.fontSize[16]).toBe(16);
    expect(typography.fontWeight.semibold).toBe("600");
    expect(zIndex.content).toBeGreaterThan(zIndex.base);
  });
});
