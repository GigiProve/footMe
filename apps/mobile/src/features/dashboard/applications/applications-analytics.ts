/**
 * Eventi del pack Candidature (§30).
 *
 * «Parametri ammessi: origine enumerata, tab, tipo profilo/ambito se
 * conforme alla policy, numero di filtri, esito, codice errore non sensibile
 * e latenza aggregata. Non inviare nomi, bio, statistiche individuali, date
 * di nascita, recapiti, URL, ID di persone/candidature/posizioni o contenuti
 * delle chat nelle analytics prodotto.»
 *
 * Da cui due assenze volute: nessun evento porta un `applicationId`, un
 * `personId` o un `adId` — §30 li vieta esplicitamente, e un id di
 * candidatura è un identificativo personale indiretto; e non esiste un
 * `application_read` separato da `application_read_result`, perché una
 * lettura riuscita e una tentata non sono lo stesso fatto (§8).
 */
import { trackEvent, type AnalyticsProps } from "../../../lib/analytics";

export type ApplicationsEventName =
  | "applications_center_view"
  | "applications_center_load_failed"
  | "applications_center_retry"
  | "applications_tab_changed"
  | "applications_filter_opened"
  | "applications_filter_applied"
  | "applications_filter_cleared"
  | "application_opened"
  | "application_read_result"
  | "application_detail_load_failed"
  | "application_detail_retry"
  | "application_career_opened"
  | "application_profile_opened"
  | "application_shortlist_attempt"
  | "application_shortlist_result"
  | "application_message_opened"
  | "application_message_failed"
  | "applications_access_unavailable";

export function trackApplicationsEvent(
  name: ApplicationsEventName,
  params?: AnalyticsProps,
): void {
  trackEvent(name, params);
}
