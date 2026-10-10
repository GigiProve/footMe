/**
 * Colori effettivi della Rete societaria (§36, punti 7 e 8).
 *
 * «Verificare i colori effettivi di token/stili: #111111 per la tipografia
 * generale, grigi neutri per il secondario, token blu PROLINK condiviso per il
 * fondo delle primarie e #FFFFFF per le loro label. **Non basta che un token
 * si chiami black/dark/primary.**»
 *
 * Il confronto visuale sul dispositivo non è stato eseguito — su questa
 * macchina manca Xcode e con esso il simulatore — quindi questi test non lo
 * sostituiscono. Coprono però esattamente ciò che §36.7 chiede di guardare
 * **oltre** al bitmap: i valori risolti, non i nomi dei token. E sono l'unica
 * forma in cui la regola resta vera anche dopo il prossimo refactor.
 */
import { describe, expect, it } from "vitest";

import { colors } from "../../styles";
import { buttonVariants } from "../../ui/Button/button-tokens";

/** Luminanza relativa WCAG di un colore esadecimale a 6 cifre. */
function luminance(hex: string): number {
  const channel = (value: number) => {
    const srgb = value / 255;

    return srgb <= 0.03928
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
}

describe("CTA primaria (§3)", () => {
  it("ha fondo blu PROLINK e testo bianco, non nera né outlined", () => {
    // §3 corregge qui la v1.0 della task: «Il vincolo sul nero riguarda la
    // tipografia generale e non converte i pulsanti primari in pulsanti neri
    // o outlined».
    expect(buttonVariants.primary.backgroundColor).toBe("#1B4FD8");
    expect(buttonVariants.primary.textColor).toBe("#FFFFFF");
  });

  it("usa lo stesso blu dell'onboarding, non una tonalità Dashboard", () => {
    expect(buttonVariants.primary.backgroundColor).toBe(colors.accent);
    expect(colors.accent).toBe("#1B4FD8");
  });

  it("regge il contrasto AA del testo bianco sul blu (§3, §32)", () => {
    expect(contrast("#FFFFFF", colors.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("azioni secondarie e distruttive (§3)", () => {
  it("la navigazione secondaria è bianca con bordo neutro e testo nero", () => {
    // Riga 08 della matrice: "Vedi profilo società".
    expect(buttonVariants.neutralOutline.backgroundColor).toBe("#FFFFFF");
    expect(buttonVariants.neutralOutline.borderColor).toBe("#111111");
    expect(buttonVariants.neutralOutline.textColor).toBe("#111111");
  });

  it("la conferma distruttiva non usa il blu della primaria positiva", () => {
    // Riga 09 della matrice: "Termina collegamento" dentro lo sheet.
    expect(buttonVariants.neutralOutline.backgroundColor).not.toBe(colors.accent);
    expect(buttonVariants.neutralOutline.borderColor).not.toBe(colors.danger);
  });

  it("i link testuali sono blu senza riempimento", () => {
    expect(buttonVariants.link.backgroundColor).toBe("transparent");
    expect(buttonVariants.link.textColor).toBe(colors.accent);
  });
});

describe("tipografia generale (§3)", () => {
  it("il nero è neutro, senza dominante blu", () => {
    expect(colors.textNeutral).toBe("#111111");

    const r = parseInt(colors.textNeutral.slice(1, 3), 16);
    const g = parseInt(colors.textNeutral.slice(3, 5), 16);
    const b = parseInt(colors.textNeutral.slice(5, 7), 16);

    // Un navy/indigo ha il blu più alto del rosso. Qui i tre canali coincidono.
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("i metadati sono grigi neutri e restano leggibili su bianco", () => {
    expect(colors.textNeutralMuted).toBe("#686868");
    expect(colors.textNeutralSoft).toBe("#737373");

    expect(contrast(colors.textNeutralMuted, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textNeutralSoft, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("il testo nero neutro supera largamente l'AA su bianco", () => {
    expect(contrast(colors.textNeutral, "#FFFFFF")).toBeGreaterThanOrEqual(7);
  });
});
