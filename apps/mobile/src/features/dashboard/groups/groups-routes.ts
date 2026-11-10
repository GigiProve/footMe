/**
 * Destinazioni dei Gruppi operativi (DAS-REV-32 §5, §12).
 *
 * Centro e dettaglio vivono nello Stack della tab Dashboard (bottom
 * navigation con Dashboard selezionata). Il wizard è un flusso focalizzato
 * fuori dalle tab. La chat creata si apre con la route canonica di Messaggi:
 * nessuna variante per l'origine Dashboard (§31).
 */
import { groupInfoRoute, MESSAGES_INBOX_ROUTE } from "../../messaging/messaging-routes";
import type { GroupComposeOrigin, GroupManageOrigin } from "./groups-types";

const enc = encodeURIComponent;

/**
 * DAS-REV-33 §6, §9: Info gruppo ha due ingressi, una route e un solo
 * componente, **senza bottom navigation** in entrambi i casi (screen 01-03,
 * 16, 19). `app/group-info/[conversationId]` è l'URL che espone anche
 * `messaging-routes.groupInfoRoute`; dalla Dashboard porta `?origin=dashboard`.
 * Persone, Aggiungi persone e successione sono flussi focalizzati condivisi
 * (screen 07, 08, 13); `origin` serve solo al ritorno. Solo i Gruppi
 * archiviati (screen 18) restano nello Stack della tab Dashboard.
 */
export const GROUP_MANAGE_HREFS = {
  /* Un solo URL: quello definito da Messaggi (`groupInfoRoute`). */
  info: (conversationId: string, origin: GroupManageOrigin) =>
    groupInfoRoute(conversationId, origin === "dashboard" ? "dashboard" : undefined),
  /** `recovery`: stessa lista in modalità recupero (§22, screen 19). */
  people: (conversationId: string, origin: GroupManageOrigin, mode?: "recovery") =>
    `/group-info/${enc(conversationId)}/people?origin=${origin}${mode === "recovery" ? "&mode=recovery" : ""}`,
  addPeople: (conversationId: string, origin: GroupManageOrigin) =>
    `/group-info/${enc(conversationId)}/add-people?origin=${origin}`,
  handover: (conversationId: string, origin: GroupManageOrigin) =>
    `/group-info/${enc(conversationId)}/handover?origin=${origin}`,
  archived: () => "/(tabs)/dashboard/groups/archived",
  /** Profilo pubblico: il resolver globale decide privacy e Block (§12, QA-048). */
  profile: (profileId: string) => `/profile/${enc(profileId)}`,
  /** Inbox Messaggi: destinazione dopo uscita o revoca (§18, §26). */
  inbox: () => MESSAGES_INBOX_ROUTE,
} as const;

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
