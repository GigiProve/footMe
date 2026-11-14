/**
 * Testi dei Salvati (HOM-07 §95–§98, §152–§158, §181), senza dipendenze.
 *
 * Un file a parte, senza import, perché li usano anche le superfici che non
 * hanno altro a che fare con il Saved Center (profilo pubblico, Dashboard,
 * Posizioni) e non devono trascinarsi dietro le route dei contenuti.
 */

export const SAVED_COPY = {
  backLabel: "Indietro",
  closedPosition: "Posizione chiusa",
  emptyContentDescription: "I contenuti che salvi su PROLINK compariranno qui.",
  emptyContentTitle: "Nessun contenuto salvato",
  emptyPositionTitle: "Nessuna posizione salvata",
  emptyProfileTitle: "Nessun profilo salvato",
  emptySocietyTitle: "Nessuna società salvata",
  errorRetry: "Riprova",
  errorTitle: "Non è stato possibile caricare i salvati.",
  removeContentLabel: "Rimuovi dai salvati",
  removed: "Rimosso dai salvati",
  removedUndo: "Annulla",
  saveContentLabel: "Salva contenuto",
  saved: "Contenuto salvato",
  title: "Salvati",
} as const;

/** Copy del toast di conferma per tipo di target (§95; gli altri target mantengono il testo già in uso). */
export const SAVED_CONFIRMATION: Record<string, string> = {
  content: "Contenuto salvato",
  position: "Posizione salvata",
  profile: "Profilo salvato",
  society: "Società salvata",
  team: "Squadra salvata",
};

/** §97 (salvataggio) e §98 (rimozione): i due errori con rollback. */
export const SAVED_ERRORS = {
  content: "Non è stato possibile salvare il contenuto. Riprova.",
  generic: "Non è stato possibile salvare. Riprova.",
  remove: "Non è stato possibile completare l'operazione.",
} as const;

export function saveFailureMessage(targetType: string, nextSaved: boolean): string {
  if (!nextSaved) {
    return SAVED_ERRORS.remove;
  }
  return targetType === "content" ? SAVED_ERRORS.content : SAVED_ERRORS.generic;
}
