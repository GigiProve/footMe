/**
 * Tutta la copy dei Commenti (HOM-08 §16, §22–§23, §30–§33, §82, §132–§134,
 * §157, §161, §165, §178, §182, §186, §190, §193, §231, §233). Nessuna stringa
 * dell'interfaccia sta nei componenti: le parole della specifica sono qui.
 */

export const COMMENTS_TITLE = "Commenti"; // §16
export const COMMENTS_SORT_RELEVANT = "Più rilevanti"; // §117
export const COMMENTS_SORT_RECENT = "Più recenti"; // §118
export const COMMENTS_SORT_SHEET_TITLE = "Ordina i commenti";
export const COMMENTS_SORT_ACCESSIBILITY = "Ordina i commenti";

export const COMMENT_PLACEHOLDER = "Scrivi un commento…"; // §22
export const COMMENT_PUBLISH = "Pubblica"; // §23
export const COMMENT_AS_TITLE = "Commenta come"; // §31
export const COMMENT_CONTEXT_PERSON = "Profilo personale";
export const COMMENT_CONTEXT_SOCIETY = "Società";
export const COMMENT_CONTEXT_MEDIA = "Media";

export const COMMENT_REPLY = "Rispondi"; // §68
export const COMMENT_REPLYING_TO = "Rispondi a"; // §82
export const COMMENT_REPLY_CANCEL = "Annulla risposta"; // §83
export const COMMENT_LIKE_ZERO = "Mi piace"; // §69

export const COMMENT_REPLIES_SHOW_ONE = "Visualizza 1 risposta"; // §132
export const COMMENT_REPLIES_MORE = "Visualizza altre risposte"; // §134
export const COMMENT_AUTHOR_LABEL = "Autore"; // §64–§65
export const COMMENT_EDITED_LABEL = "Modificato"; // §157
export const COMMENT_DELETED = "Commento eliminato"; // §165
export const COMMENT_UNAVAILABLE = "Commento non disponibile"; // §195
export const COMMENT_ACTIONS_LABEL = "Azioni commento"; // §231
// §143: la freccia ↑ la disegna già `NewContentPill`: nella label sarebbe doppia.
export const COMMENTS_NEW = "Nuovi commenti";

export const COMMENTS_EMPTY_TITLE = "Nessun commento"; // §182
export const COMMENTS_EMPTY_BODY = "Inizia tu la conversazione."; // §182
export const COMMENTS_LOAD_ERROR = "Non è stato possibile caricare i commenti."; // §186
export const COMMENTS_RETRY = "Riprova"; // §186
export const COMMENTS_LOAD_MORE = "Visualizza altri commenti"; // §130, stessa parola di «Visualizza altre risposte»
export const COMMENTS_LOADING = "Caricamento dei commenti";
export const COMMENTS_DISABLED = "I commenti sono disattivati per questo contenuto."; // §178
export const COMMENT_CONTENT_UNAVAILABLE = "Contenuto non disponibile"; // §190

export const COMMENT_SEND_FAILED = "Invio non riuscito"; // §98

export const COMMENT_PERMISSION_LOST = "Non hai più i permessi per commentare con questo profilo."; // §43
export const COMMENT_TARGET_UNAVAILABLE = "Questo commento non è più disponibile."; // §193
export const COMMENT_TOO_LONG = "Il commento è troppo lungo.";
export const COMMENT_INVALID_BODY = "Scrivi qualcosa per pubblicare.";
export const COMMENT_INVALID_MENTION = "Controlla le menzioni e riprova.";
export const COMMENT_PUBLISH_ERROR = "Non è stato possibile pubblicare il commento. Riprova.";
export const COMMENT_EDIT_ERROR = "Non è stato possibile salvare la modifica."; // §159
export const COMMENT_EDIT_CONFLICT = "Questo commento è stato modificato nel frattempo."; // §155, §159
export const COMMENT_EDIT_CURRENT_VERSION = "Versione attuale"; // §155: il testo del server, accanto al proprio
export const COMMENT_EDIT_DISCARD_TITLE = "Annullare le modifiche?";
export const COMMENT_EDIT_DISCARD_CONFIRM = "Annulla modifiche";
export const COMMENT_EDIT_DISCARD_CONTINUE = "Continua a modificare";
export const COMMENT_REOPEN_BLOCKED = "Completa o svuota il commento in corso per riaprire questo.";
export const COMMENT_EDIT_FORBIDDEN = "Non puoi più modificare questo commento.";
export const COMMENT_DELETE_ERROR = "Non è stato possibile eliminare il commento.";

export const COMMENT_DELETE_TITLE = "Eliminare questo commento?"; // §161
export const COMMENT_DELETE_CANCEL = "Annulla";
export const COMMENT_DELETE_CONFIRM = "Elimina";
export const COMMENT_ACTION_EDIT = "Modifica"; // §146
export const COMMENT_ACTION_DELETE = "Elimina"; // §146
export const COMMENT_EDIT_HEADER_TITLE = "Modifica"; // §151
export const COMMENT_EDIT_CANCEL = "Annulla";
export const COMMENT_EDIT_SAVE = "Salva";

export const COMMENT_MENTION_BUTTON = "Menziona qualcuno";
export const COMMENT_INPUT_LABEL = "Scrivi un commento";

/** §81–§82: «Visualizza 8 risposte» / «Visualizza 1 risposta». */
export function commentRepliesLabel(count: number): string {
  return count === 1 ? COMMENT_REPLIES_SHOW_ONE : `Visualizza ${count} risposte`;
}
