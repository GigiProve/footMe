/**
 * Destinazioni dei Gruppi operativi (DAS-REV-32 §5, §12).
 *
 * Centro e dettaglio vivono nello Stack della tab Dashboard (bottom
 * navigation con Dashboard selezionata). Il wizard è un flusso focalizzato
 * fuori dalle tab. La chat creata si apre con la route canonica di Messaggi:
 * nessuna variante per l'origine Dashboard (§31).
 */
import type { GroupComposeOrigin } from "./groups-types";

export const GROUPS_HREFS = {
  center: () => "/(tabs)/dashboard/groups",
  /** La riga apre il dettaglio amministrativo, mai la chat (§5, QA-003). */
  detail: (conversationId: string) => `/(tabs)/dashboard/groups/${encodeURIComponent(conversationId)}`,
  /**
   * Da Dashboard la Società è quella dell'identity; da Messaggi può arrivare
   * già risolta (una sola Società eleggibile) o essere scelta nel selector.
   */
  create: (origin: GroupComposeOrigin, clubId?: string | null) =>
    `/group-compose?origin=${origin}` + (clubId ? `&clubId=${encodeURIComponent(clubId)}` : ""),
  /** Route canonica della chat (MES-02). */
  conversation: (conversationId: string, title: string) =>
    `/messages/${encodeURIComponent(conversationId)}?otherName=${encodeURIComponent(title)}`,
} as const;
