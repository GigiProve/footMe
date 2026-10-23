/**
 * Eventi prodotto del composer (DAS-REV-16 §33).
 *
 * «Non registrare testi, titolo custom, descrizione, requisiti,
 * responsabilità, qualifica libera, dati candidati, contatti, nomi o ID dei
 * Team, payload completi o coordinate.»
 *
 * Il tipo dei parametri è la garanzia: non esiste una chiave in cui far
 * entrare una stringa libera, e i conteggi sono numeri non identificativi.
 */
export type ComposeEventName =
  | "position_compose_detail_opened"
  | "position_compose_detail_saved"
  | "position_compose_drafts_created"
  | "position_compose_exit_with_changes"
  | "position_compose_opened"
  | "position_compose_preview_opened"
  | "position_compose_profile_selected"
  | "position_compose_publish_failed"
  | "position_compose_publish_succeeded"
  | "position_compose_second_search_added"
  | "position_compose_selection_changed";

export type ComposeEventParams = {
  /** Categoria dell'errore, mai il messaggio (§33). */
  errorCategory?: "authorization" | "conflict" | "offline" | "validation" | "unknown";
  /** Quante Position tocca l'operazione. Non identifica nessuna di esse. */
  count?: number;
  /** Presenza booleana di optional, non il loro contenuto. */
  hasDetails?: boolean;
  mode?: "batch" | "single";
  profileType?: "player" | "coach" | "staff" | "director";
  scope?: "society" | "team";
};

export function trackComposeEvent(
  name: ComposeEventName,
  params: ComposeEventParams = {},
): void {
  if (__DEV__) {
    console.log(`[analytics] ${name}`, params);
  }
}
