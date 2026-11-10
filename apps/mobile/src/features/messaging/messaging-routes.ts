/**
 * Destinazioni raggiunte dalla chat (DAS-REV-33 §5, §26). Una definizione per
 * destinazione.
 */

/**
 * Info gruppo, `app/group-info/[conversationId]`. La schermata appartiene
 * al modulo Gruppi (`dashboard/groups/manage/GroupInfoScreen`, origin
 * «messages»); la route esiste, quindi la testata è navigabile.
 */
export const GROUP_INFO_AVAILABLE = true;

/**
 * Una sola definizione dell'URL di Info gruppo, usata anche dal modulo Gruppi
 * (`GROUP_MANAGE_HREFS.info`). Dalla Dashboard porta `?origin=dashboard`, che
 * serve solo al ritorno.
 */
export function groupInfoRoute(conversationId: string, origin?: "dashboard"): string {
  return `/group-info/${encodeURIComponent(conversationId)}${origin === "dashboard" ? "?origin=dashboard" : ""}`;
}

/** Inbox Messaggi: destinazione dopo la revoca dell'accesso (§26). */
export const MESSAGES_INBOX_ROUTE = "/(tabs)/messages";
