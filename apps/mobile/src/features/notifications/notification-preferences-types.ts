/**
 * HOM-14 §180-§201 — tipi delle Preferenze notifiche.
 *
 * Due gruppi con significato diverso (decisione di prodotto, non della spec):
 * - `push`: le categorie delle notifiche push. Gli switch decidono quali eventi producono
 *   una notifica push (§181); il Centro Notifiche continua a mostrare l'attività (§182).
 * - `other`: i toggle operativi storici (Richieste, Candidature, ...) che continuano
 *   a controllare le notifiche in-app. Restano in una sezione separata.
 *
 * DAS-REV-34 §15–§17 (decisione di Luigi, 2026-11-17): HOM-14 §201 teneva Messaggi
 * fuori; ora i due interruttori GLOBALI dell'account entrano nelle Preferenze
 * esistenti, nel gruppo `push` perché governano solo le push:
 * - `push_messages` (stesso nome in lettura, `push.push_messages`, e in scrittura): le push dei nuovi messaggi in chat e gruppi (e le notifiche
 *   strutturali dei gruppi, che non seguono il mute della singola conversazione).
 * - `message_preview`: mostra mittente e testo nella notifica, o solo «Nuovo messaggio».
 * Il mute della singola conversazione vive nel menu della chat, non qui.
 */

export const PUSH_PREFERENCE_KEYS = [
  "comments_replies",
  "mentions",
  "reposts",
  "new_followers",
  "likes",
  "scheduled_content",
  "push_messages",
  "message_preview",
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
