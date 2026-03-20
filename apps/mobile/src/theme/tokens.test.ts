import { describe, expect, it } from "vitest";

import {
  borders,
  colors,
  opacity,
  radius,
  shadows,
  sizes,
  spacing,
  textPresets,
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

  it("exposes new semantic color tokens for success, warning and transparent", () => {
    expect(colors.success).toBe("#027A48");
    expect(colors.successSoft).toBe("#D1FADF");
    expect(colors.warning).toBe("#B54708");
    expect(colors.warningSoft).toBe("#FEF0C7");
    expect(colors.transparent).toBe("transparent");
  });

  it("exposes avatar and icon size tokens", () => {
    expect(sizes.avatarSm).toBe(32);
    expect(sizes.avatarMd).toBe(48);
    expect(sizes.avatarLg).toBe(72);
    expect(sizes.avatarXl).toBe(104);
    expect(sizes.iconSm).toBe(16);
    expect(sizes.iconXl).toBe(32);
  });

  it("exposes extended spacing scale", () => {
    expect(spacing[2]).toBe(2);
    expect(spacing[40]).toBe(40);
    expect(spacing[48]).toBe(48);
    expect(spacing[64]).toBe(64);
  });

  it("exposes small radius values", () => {
    expect(radius[4]).toBe(4);
    expect(radius[8]).toBe(8);
    expect(radius[12]).toBe(12);
  });

  it("exposes opacity and border tokens", () => {
    expect(opacity.disabled).toBe(0.56);
    expect(opacity.pressed).toBe(0.88);
    expect(borders.thin).toBe(1);
    expect(borders.thick).toBe(4);
  });

  it("exposes text presets with correct hierarchy", () => {
    expect(textPresets.display.fontSize).toBeGreaterThan(textPresets.h1.fontSize);
    expect(textPresets.h1.fontSize).toBeGreaterThan(textPresets.h2.fontSize);
    expect(textPresets.h2.fontSize).toBeGreaterThan(textPresets.h3.fontSize);
    expect(textPresets.body.fontSize).toBe(16);
    expect(textPresets.meta.textTransform).toBe("uppercase");
  });

  it("exposes shadow levels (sm, card, lg)", () => {
    expect(shadows.sm.elevation).toBeLessThan(shadows.card.elevation);
    expect(shadows.card.elevation).toBeLessThan(shadows.lg.elevation);
  });
});
