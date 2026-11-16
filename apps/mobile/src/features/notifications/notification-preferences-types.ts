/**
 * HOM-14 §180-§201 — tipi delle Preferenze notifiche.
 *
 * Due gruppi con significato diverso (decisione di prodotto, non della spec):
 * - `push`: le sei categorie HOM-14. Gli switch decidono quali eventi producono una
 *   notifica push (§181); il Centro Notifiche continua a mostrare l'attività (§182).
 * - `other`: i toggle operativi storici (Richieste, Candidature, ...) che continuano
 *   a controllare le notifiche in-app. Restano in una sezione separata.
 *
 * Messaggi non compare (§201): appartiene al dominio Messaggi.
 */

export const PUSH_PREFERENCE_KEYS = [
  "comments_replies",
  "mentions",
  "reposts",
  "new_followers",
  "likes",
  "scheduled_content",
] as const;

export const OTHER_PREFERENCE_KEYS = [
  "requests",
  "applications",
  "content_tags",
  "store",
  "promotions",
] as const;

export type PushPreferenceKey = (typeof PUSH_PREFERENCE_KEYS)[number];
export type OtherPreferenceKey = (typeof OTHER_PREFERENCE_KEYS)[number];
export type NotificationPreferenceKey = PushPreferenceKey | OtherPreferenceKey;

export type NotificationPreferences = {
  other: Record<OtherPreferenceKey, boolean>;
  push: Record<PushPreferenceKey, boolean>;
};
