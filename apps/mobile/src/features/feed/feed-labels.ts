/**
 * Tutte le stringhe italiane della Home in un posto solo, più gli helper di
 * etichetta.
 *
 * I testi obbligatori del brief (titoli, helper, CTA, stati vuoti, errori) sono
 * costanti esportate: raggrupparle qui rende immediato verificare che il copy
 * spedito sia quello approvato, invece di cercarlo in dodici componenti.
 *
 * Le etichette di ruolo/posizione NON vengono ricalcolate qui: si riusano
 * `getPlayerPositionLabel` e `formatRole` come impone CLAUDE.md.
 */

import { formatRole } from "../profiles/profile-display-helpers";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import type {
  FeedEditorialItem,
  FeedPositionPayload,
  FeedScope,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "./feed-types";

// ── Header e tab ────────────────────────────────────────────────
/** §2: solo il nome testuale. Nessun logo, nemmeno provvisorio. */
export const FEED_BRAND = "PROLINK";
export const FEED_TAB_LABELS: Record<FeedScope, string> = {
  per_te: "Per te",
  seguiti: "Seguiti",
};

// ── Modulo di primo accesso (HOM-01.1 §28) ──────────────────────
export const FEED_INTRO_TITLE = "Personalizza ciò che vuoi vedere";
export const FEED_INTRO_BODY =
  "Dicci cosa ti interessa per rendere il Feed ancora più rilevante.";
export const FEED_INTRO_PRIMARY_CTA = "Personalizza";
export const FEED_INTRO_SECONDARY_CTA = "Non ora";
/**
 * Il foglio che «Personalizza» apre (§30): riusa le quattro opzioni e il
 * salvataggio di HOM-01, cambia solo il punto d'accesso.
 */
export const FEED_INTRO_SHEET_BODY =
  "PROLINK utilizzerà il tuo ruolo, le aree di interesse e i profili che segui per mostrarti contenuti più rilevanti.";
export const FEED_INTRO_SHEET_SAVE = "Salva preferenze";

// ── Posizione suggerita (§9) ────────────────────────────────────
export const FEED_POSITION_OVERLINE = "Per te";
export const FEED_POSITION_HELPER = "In base al tuo profilo";
export const FEED_POSITION_CTA = "Apri posizione";

// ── Moduli discovery (§11) ──────────────────────────────────────
export const FEED_SUGGESTED_PROFILES_TITLE = "Persone che potresti conoscere";
export const FEED_SUGGESTED_CLUBS_TITLE = "Società che potresti seguire";
export const FEED_SEE_ALL = "Vedi tutte";
export const FEED_FOLLOW_CTA = "Segui";
/**
 * HOM-01.1 §21: «Segui già o equivalente previsto dal sistema Follow
 * definitivo». L'equivalente in uso ovunque (Cerca, profili, Società) è
 * "Seguito": la Home si allinea invece di avere un'etichetta sua.
 */
export const FEED_FOLLOWING_LABEL = "Seguito";

// ── Tab Seguiti (HOM-01.1 §24, §35) ─────────────────────────────
// Nessun helper permanente sotto le tab (§24): la label "Seguiti" basta.
export const FEED_FOLLOWING_EMPTY_TITLE = "Ancora nessun contenuto";
export const FEED_FOLLOWING_EMPTY_BODY =
  "Segui profili, società e Media per vedere qui i loro aggiornamenti.";
export const FEED_FOLLOWING_EMPTY_CTA = "Scopri chi seguire";
export const FEED_SUGGESTIONS_TITLE = "Suggerimenti per iniziare";
/** §37: «massimo 3–4 righe». */
export const FEED_FOLLOWING_SUGGESTION_ROWS = 4;

// ── Tab Per te senza contenuti ──────────────────────────────────
/**
 * La spina fa già di tutto per non arrivare qui: mostra contenuti globali a chi
 * non segue nessuno, promuove i contenuti popolari e lascia cadere il limite di
 * 180 giorni quando l'archivio recente è troppo povero. Questo stato resta per
 * il caso in cui davvero non esista alcun contenuto pubblicato — e in quel caso
 * va detto, non lasciato a schermo bianco.
 */
export const FEED_PER_TE_EMPTY_TITLE = "Non ci sono ancora contenuti da mostrare";
export const FEED_PER_TE_EMPTY_BODY =
  "Appena società, profili e testate inizieranno a pubblicare, li troverai qui.";

// ── Paginazione e nuovi contenuti (HOM-01.1 §40, §51) ───────────
// Niente "Aggiornamento Feed…" (§43) e niente "Riprendi da dove eri" (§45):
// il refresh usa l'indicatore nativo e il ripristino è invisibile.
export const FEED_END_OF_LIST = "Sei aggiornato";
export const FEED_NEW_CONTENT = "Nuovi contenuti";

// ── Errore e offline (§23, §24) ─────────────────────────────────
export const FEED_ERROR_TITLE = "Non è stato possibile aggiornare la Home";
export const FEED_ERROR_BODY = "Controlla la connessione e riprova.";
export const FEED_RETRY = "Riprova";
export const FEED_OFFLINE =
  "Sei offline. Alcuni contenuti potrebbero non essere aggiornati.";

// ── Azioni post (§10) ───────────────────────────────────────────
export const FEED_ACTION_LIKE = "Mi piace";
export const FEED_ACTION_COMMENT = "Commenta";
export const FEED_ACTION_SHARE = "Condividi";

/**
 * Il §29 esclude da questo blocco il sistema Mi piace, i commenti e la
 * condivisione. I controlli restano visibili e leggibili come chiede il §10, e
 * il tap risponde con un messaggio esplicito: nessun comportamento inventato,
 * nessun tap morto. Il segnalibro nella stessa riga funziona davvero.
 */
export const FEED_SOON_MESSAGES = {
  comment: "I commenti arriveranno presto.",
  hide: "Questa azione arriverà presto.",
  like: "Le reazioni arriveranno presto.",
  notInterested: "Questa azione arriverà presto.",
  report: "Le segnalazioni arriveranno presto.",
  share: "La condivisione arriverà presto.",
  unfollow: "Questa azione arriverà presto.",
} as const;

// ── Menu contestuale (§20) ──────────────────────────────────────
export const FEED_MENU_LABELS = {
  hide: "Nascondi",
  notInterested: "Non mi interessa",
  report: "Segnala",
  save: "Salva",
  unsave: "Rimuovi dai salvati",
  unfollow: "Non seguire",
} as const;

// ── Helper di etichetta ─────────────────────────────────────────

/** §12: la CTA deve essere coerente con la tipologia. */
export function editorialCta(item: FeedEditorialItem): string {
  return item.type === "video" ? "Guarda video" : "Leggi articolo";
}

/**
 * Il ruolo è l'elemento più visibile del contenitore posizione (§9). Per i
 * calciatori si usa l'etichetta della posizione; per allenatori e staff il
 * ruolo enum non è significativo, quindi si ricade sul titolo dell'annuncio.
 */
export function positionHeadline(
  payload: FeedPositionPayload,
  fallbackTitle: string | null,
): string {
  if (payload.targetRole === "player" && payload.roleRequired) {
    return getPlayerPositionLabel(payload.roleRequired, fallbackTitle ?? "Posizione aperta");
  }

  return fallbackTitle ?? "Posizione aperta";
}

/**
 * es. "Prima squadra · Parma Calcio". HOM-01.1 §76: la squadra accompagna la
 * Società e non la sostituisce. Stesso formato di `teamMetaLine` in Cerca
 * (CER-04), come chiede il §74.
 */
export function positionTeamLine(payload: FeedPositionPayload): string {
  return [payload.teamName, payload.clubName].filter(Boolean).join(" · ");
}

/** es. "Serie B · Parma, Emilia-Romagna" — come `locationMetaLine` in Cerca. */
export function positionLocationLine(payload: FeedPositionPayload): string {
  const place = [payload.city, payload.region].filter(Boolean).join(", ");
  return [payload.category, place].filter(Boolean).join(" · ");
}

/** Riga secondaria di un profilo suggerito: ruolo + informazione essenziale (§11). */
export function suggestedProfileMetaLine(row: FeedSuggestedProfileRow): string {
  const roleOrPosition =
    row.role === "player" && row.primary_position
      ? getPlayerPositionLabel(row.primary_position)
      : formatRole(row.role);

  return [roleOrPosition, row.current_club_name].filter(Boolean).join(" · ");
}

/** Riga secondaria di una società suggerita: categoria + località. */
export function suggestedClubMetaLine(row: FeedSuggestedClubRow): string {
  const place = [row.city, row.region].filter(Boolean).join(", ");
  return [row.category, place].filter(Boolean).join(" · ");
}
