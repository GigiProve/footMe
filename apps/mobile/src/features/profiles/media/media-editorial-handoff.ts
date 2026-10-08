/**
 * Handoff verso HOM-06.2 — Editoriale, bozze e programmazione (REV-PROF-21,
 * Screen 1).
 *
 * Il Master Profile non sceglie e non replica la modalità di creazione: non
 * sa niente di "Scrivi su PROLINK", "Collega da un link" e "Incolla un
 * articolo". Quello che fa è consegnare il contesto — da dove si arriva,
 * quale realtà editoriale pubblica, dove tornare — a un punto solo.
 *
 * Finché HOM-06.2 non esiste, quel punto apre il composer editoriale che è
 * già nel prodotto, così la CTA non è un vicolo cieco e, quando il flusso
 * arriverà, cambierà soltanto questo modulo. Il contratto è già quello
 * definitivo: `origin`, identità della realtà, destinazione di ritorno.
 */
import type { MediaProfileTab } from "./media-master-profile";

/** `source`/`origin` tecnica che HOM-06.2 riceve dal Master Profile. */
export const MEDIA_EDITORIAL_ORIGIN = "MEDIA_PROFILE";

export type MediaEditorialHandoff = {
  /** ID canonico della realtà editoriale che pubblica. */
  mediaProfileId: string;
  origin: typeof MEDIA_EDITORIAL_ORIGIN;
  /** Tab su cui riportare l'utente dopo la pubblicazione. */
  returnTab: MediaProfileTab;
};

export function buildMediaEditorialHandoff(
  mediaProfileId: string,
): MediaEditorialHandoff {
  return {
    mediaProfileId,
    origin: MEDIA_EDITORIAL_ORIGIN,
    returnTab: "articles",
  };
}
