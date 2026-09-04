import { describe, expect, it } from "vitest";

import {
  colors,
  radius,
  shadows,
  sizes,
  spacing,
  textVariants,
  typography,
  zIndex,
} from "./tokens";

describe("theme tokens", () => {
  it("espone la palette ProLink del design UI Upgrade", () => {
    expect(colors.accent).toBe("#1B4FD8");
    expect(colors.accentStrong).toBe("#1540AE");
    expect(colors.accentSoft).toBe("#EDF2FE");
    expect(colors.textPrimary).toBe("#0C1B2A");
    expect(colors.background).toBe("#F4F6FA");
    expect(colors.success).toBe("#0FA36B");
    expect(colors.surface).toBe("#FFFFFF");
  });

  it("tiene distinte le due hairline del design", () => {
    // `border` racchiude il modulo, `divider` separa le righe al suo interno.
    expect(colors.border).toBe("#E3E8EF");
    expect(colors.divider).toBe("#F0F3F7");
    expect(colors.border).not.toBe(colors.divider);
  });

  it("resta piatto: nessuna ombra sulle superfici di contenuto", () => {
    expect(shadows.card.shadowOpacity).toBe(0);
    expect(shadows.elevated.shadowOpacity).toBe(0);
    // Solo ciò che galleggia davvero sopra la pagina ha un'ombra.
    expect(shadows.overlay.shadowOpacity).toBeGreaterThan(0);
  });

  it("usa Mulish per numeri, statistiche e titoli di schermata", () => {
    expect(textVariants.statValue.fontFamily).toBe("Mulish_900Black");
    expect(textVariants.screenTitle.fontFamily).toBe("Mulish_900Black");
    expect(textVariants.heroName.fontFamily).toBe("Mulish_900Black");
    // Il testo di sistema non deve mai finire in Mulish.
    expect(textVariants.bodyLg).not.toHaveProperty("fontFamily");
    expect(textVariants.meta).not.toHaveProperty("fontFamily");
  });

  it("definisce l'eyebrow come intestazione di ogni modulo", () => {
    expect(textVariants.eyebrow.fontSize).toBe(10.5);
    expect(textVariants.eyebrow.textTransform).toBe("uppercase");
    expect(textVariants.eyebrow.fontWeight).toBe("800");
  });

  it("espone le misure del modulo e della bottom nav", () => {
    expect(spacing[16]).toBe(16);
    expect(radius[16]).toBe(16);
    expect(radius.full).toBe(999);
    expect(sizes.actionRail).toBe(44);
    expect(sizes.personalizedRail).toBe(3);
    expect(sizes.touchTarget).toBeGreaterThanOrEqual(44);
    expect(sizes.tabBarHeight).toBe(72);
    expect(sizes.recruitingDescriptionMinHeight).toBe(120);
    expect(typography.fontSize[16]).toBe(16);
    expect(typography.fontWeight.semibold).toBe("600");
    expect(zIndex.content).toBeGreaterThan(zIndex.base);
  });
});
