/**
 * HOM-14 §180-§201 — derivazioni pure delle Preferenze notifiche.
 *
 * `fetch_my_notification_preferences()` restituisce ora jsonb
 * `{ push: {...}, other: {...} }` (prima era una riga rotta a runtime). Il parser
 * qui sotto è tollerante: una chiave mancante prende il default HOM-14
 * (§189-§194: Mi piace OFF, il resto ON), così un backend più vecchio o un campo
 * aggiunto in futuro (§200) non rompe la pagina.
 */

import {
  OTHER_PREFERENCE_KEYS,
  PUSH_PREFERENCE_KEYS,
  type NotificationPreferenceKey,
  type NotificationPreferences,
  type OtherPreferenceKey,
  type PushPreferenceKey,
} from "./notification-preferences-types";

export const DEFAULT_PUSH_PREFERENCES: Record<PushPreferenceKey, boolean> = {
  comments_replies: true,
  likes: false,
  mentions: true,
  new_followers: true,
  reposts: true,
  scheduled_content: true,
};

export const DEFAULT_OTHER_PREFERENCES: Record<OtherPreferenceKey, boolean> = {
  applications: true,
  content_tags: true,
  promotions: true,
  requests: true,
  store: true,
};

export type PreferenceRowConfig<K extends NotificationPreferenceKey> = {
  key: K;
  label: string;
};

export type PreferenceSectionConfig<K extends NotificationPreferenceKey> = {
  eyebrow: string;
  rows: readonly PreferenceRowConfig<K>[];
};

/** §187: Interazioni. Messaggi non c'è, di proposito (§201). */
export const PUSH_INTERACTION_SECTION: PreferenceSectionConfig<PushPreferenceKey> = {
  eyebrow: "Interazioni",
  rows: [
    { key: "comments_replies", label: "Commenti e risposte" },
    { key: "mentions", label: "Mention" },
    { key: "reposts", label: "Repost" },
    { key: "new_followers", label: "Nuovi follower" },
    { key: "likes", label: "Mi piace" },
  ],
};

/** §188: Pubblicazione. */
export const PUSH_PUBLISHING_SECTION: PreferenceSectionConfig<PushPreferenceKey> = {
  eyebrow: "Pubblicazione",
  rows: [{ key: "scheduled_content", label: "Contenuti programmati" }],
};

/** Decisione di prodotto: i vecchi toggle operativi restano e controllano l'in-app. */
export const OTHER_ACTIVITY_SECTION: PreferenceSectionConfig<OtherPreferenceKey> = {
  eyebrow: "Altre attività",
  rows: [
    { key: "requests", label: "Richieste" },
    { key: "applications", label: "Candidature" },
    { key: "content_tags", label: "Tag nei contenuti" },
    { key: "store", label: "Store" },
    { key: "promotions", label: "Promozioni" },
  ],
};

/** §181-§182: gli switch controllano le push, il Centro continua a mostrare l'attività. */
export const PUSH_SECTION_MICROCOPY =
  "Gli switch controllano le notifiche push. Il Centro Notifiche continua a mostrare le attività.";

/** §198. */
export const MANAGED_IDENTITIES_COPY =
  "Le preferenze si applicano alle identity che gestisci con questo account.";

export const OTHER_SECTION_MICROCOPY =
  "Queste preferenze controllano le notifiche nel Centro Notifiche.";

export const SYSTEM_ROW_LABEL = "Sistema e sicurezza";
export const SYSTEM_ROW_SUBTITLE = "Consigliato sempre attivo";

/** §186: quando il sistema nega le push, lo switch salvato non deve sembrare efficace. */
/** §186: un solo avviso, non uno per riga; gli switch push restano visibili ma non modificabili. */
export const PUSH_BLOCKED_NOTICE =
  "Le notifiche push sono bloccate dal dispositivo: le scelte qui sotto restano salvate e potrai modificarle dopo averle attivate.";

export function isPushPreferenceKey(key: NotificationPreferenceKey): key is PushPreferenceKey {
  return (PUSH_PREFERENCE_KEYS as readonly string[]).includes(key);
}

function readBoolean(source: unknown, key: string, fallback: boolean): boolean {
  if (typeof source !== "object" || source === null) {
    return fallback;
  }

  const value = (source as Record<string, unknown>)[key];

  return typeof value === "boolean" ? value : fallback;
}

/**
 * Accetta il jsonb così com'è (oggetto) oppure avvolto in array come fanno alcune
 * risposte PostgREST. Un valore che non è un oggetto è un errore vero, non un default:
 * mostrare tutti gli switch al valore di default nasconderebbe una scelta salvata.
 */
export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const row = Array.isArray(raw) ? raw[0] : raw;

  if (typeof row !== "object" || row === null) {
    throw new Error("Preferenze notifiche non valide");
  }

  const { other, push } = row as { other?: unknown; push?: unknown };

  return {
    other: Object.fromEntries(
      OTHER_PREFERENCE_KEYS.map((key) => [key, readBoolean(other, key, DEFAULT_OTHER_PREFERENCES[key])]),
    ) as Record<OtherPreferenceKey, boolean>,
    push: Object.fromEntries(
      PUSH_PREFERENCE_KEYS.map((key) => [key, readBoolean(push, key, DEFAULT_PUSH_PREFERENCES[key])]),
    ) as Record<PushPreferenceKey, boolean>,
  };
}

/** Aggiornamento ottimistico: una nuova copia con una sola chiave cambiata. */
export function applyPreferenceChange(
  preferences: NotificationPreferences,
  key: NotificationPreferenceKey,
  value: boolean,
): NotificationPreferences {
  if (isPushPreferenceKey(key)) {
    return { ...preferences, push: { ...preferences.push, [key]: value } };
  }

  return { ...preferences, other: { ...preferences.other, [key]: value } };
}

export function readPreference(
  preferences: NotificationPreferences,
  key: NotificationPreferenceKey,
): boolean {
  return isPushPreferenceKey(key) ? preferences.push[key] : preferences.other[key];
}
