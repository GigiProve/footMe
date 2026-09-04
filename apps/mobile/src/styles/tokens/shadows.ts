/**
 * Il design ProLink è piatto: l'elevazione è data dalla hairline `colors.border`
 * attorno al modulo, non da un'ombra. Le chiavi restano per non toccare le
 * decine di punti che le usano, ma non disegnano nulla.
 *
 * L'unica ombra ammessa è `overlay`, per ciò che galleggia davvero sopra la
 * pagina (bottom sheet, action sheet, toast, menu contestuali).
 */
export const shadows = {
  subtle: {
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    shadowOpacity: 0,
    elevation: 0,
  },
  elevated: {
    shadowOpacity: 0,
    elevation: 0,
  },
  overlay: {
    shadowColor: "#0C1B2A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;
