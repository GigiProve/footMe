/**
 * HOM-14 — query key del Centro Notifiche.
 *
 * §107-108 e §274-275: inbox, badge e stato seen/opened sono per account, quindi
 * ogni chiave porta il profilo dell'account (= auth.uid). Le radici
 * `"notifications"` e `"notifications-unread"` restano quelle già usate da
 * `invalidate-block-caches.ts` e dalle invalidazioni generiche esistenti, così
 * un blocco o un'azione su una richiesta continua a rinfrescare Centro e badge.
 */
export const notificationKeys = {
  all: ["notifications"] as const,
  timeline: (profileId: string) => ["notifications", "timeline", profileId] as const,
  badgeRoot: ["notifications-unread"] as const,
  badge: (profileId: string) => ["notifications-unread", profileId] as const,
  preferences: (profileId: string) => ["notification-preferences", profileId] as const,
};
