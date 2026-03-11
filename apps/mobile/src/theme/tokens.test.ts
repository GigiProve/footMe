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
    expect(colors.background).toBe("#F5F2E9");
    expect(colors.accent).toBe("#0D7A43");
    expect(colors.surfaceOverlay).toBe("rgba(255,253,252,0.12)");
    expect(colors.buttonDisabled).toBe("#6AA687");
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
