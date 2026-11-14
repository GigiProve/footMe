/**
 * Copy del Mi piace (HOM-07 §16, §30–§31, §67, §65).
 *
 * Una sola reaction, «Mi piace» (§2): la label d'azione del controllo resta
 * `FEED_ACTION_LIKE` del Feed; qui stanno solo le frasi nuove.
 */

/** §31: letto dopo il conteggio quando l'identità corrente ha messo Mi piace. */
export const LIKE_YOURS_LABEL = "Hai messo Mi piace";
/** §30–§31: le due azioni accessibili del controllo. */
export const LIKE_ACTION_ADD = "Metti Mi piace";
export const LIKE_ACTION_REMOVE = "Rimuovi Mi piace";
export const LIKE_ACTION_VIEW_LIST = "Visualizza chi ha messo Mi piace";

/** §45: titolo della pagina detail. */
export const LIKES_TITLE = "Mi piace";
/** §65: nessuna grande illustrazione. */
export const LIKES_EMPTY = "Nessun Mi piace";
/** §67 */
export const LIKES_ERROR = "Non è stato possibile caricare i Mi piace.";
export const LIKES_RETRY = "Riprova";
