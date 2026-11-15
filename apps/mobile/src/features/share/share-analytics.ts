/**
 * Eventi di prodotto della Condivisione (HOM-09 §263–§265). Non sono mai
 * mostrati all'utente.
 *
 * La union tipizzata è il punto: aggiungere un evento senza dichiararlo qui non
 * compila, e il test verifica la corrispondenza 1:1 con l'elenco del §263.
 *
 * Privacy (§264): nessun evento porta il testo del messaggio opzionale, la
 * query di ricerca, il nome di un destinatario o l'URL canonico. Si registrano
 * id del contenuto, tipo, provenienza, conteggi e il tipo di destinatario. Un
 * multi-send è UN batch con N delivery (§143, §195, §320–§321): `batchId`
 * identifica l'azione, `deliveryCount` le destinazioni. `external_share_completion`
 * non esiste: il sistema non dà un segnale affidabile (§202–§203, §323).
 * Il messaggio in sé lo traccia il dominio Messaggi (§265): qui nessun doppione.
 * Il contatore Condivisioni di HOM-05 non nasce da questi eventi ma dal server.
 */

import { trackEvent, type AnalyticsProps } from "../../lib/analytics";
import type { FeedContentType } from "../feed/feed-types";
import type { ShareOrigin, ShareRecipientKind } from "./share-types";

type SurfaceProps = {
  contentId: string;
  contentType: FeedContentType;
  origin: ShareOrigin;
};

type BatchProps = {
  batchId: string;
  contentId: string;
  contentType: FeedContentType;
};

export type ShareAnalyticsEvent =
  | ({ name: "share_sheet_open" } & SurfaceProps)
  | { name: "recent_recipient_selected"; recipientKind: ShareRecipientKind; position: number }
  | { name: "share_more_open" }
  | { name: "share_recipient_search"; queryLength: number }
  | { name: "share_recipient_selected"; recipientKind: ShareRecipientKind; selected: boolean }
  | { name: "share_multi_select"; count: number }
  | { name: "share_message_step_open"; recipientCount: number }
  | ({ name: "internal_share_attempt"; deliveryCount: number } & BatchProps)
  | ({ name: "internal_share_success"; deliveryCount: number } & BatchProps)
  | ({ name: "internal_share_failure"; deliveryCount: number } & BatchProps)
  | ({
      name: "internal_share_partial_success";
      deliveryCount: number;
      failedCount: number;
      successCount: number;
    } & BatchProps)
  | ({ name: "internal_share_retry"; retryCount: number } & BatchProps)
  | ({ name: "copy_link_success" } & SurfaceProps)
  | ({ name: "external_share_sheet_open" } & SurfaceProps);

export function trackShare(event: ShareAnalyticsEvent): void {
  const { name, ...rest } = event;
  trackEvent(name, rest as AnalyticsProps);
}
