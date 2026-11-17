/**
 * HOM-14 — tipi del Centro Notifiche lato client.
 *
 * Forma camelCase delle righe di `fetch_notification_timeline` (§113, §143). Il
 * client non crea mai notifiche (§171): questi tipi descrivono solo ciò che il
 * backend restituisce. `isNew` (seen_revision < revision) alimenta il badge,
 * `isOpened` (read_revision >= revision) l'azzurrino: due stati distinti, mai un
 * unico `is_read` (§10–§13).
 */

/** Identità che ha compiuto l'azione o che riceve (§93–§94). */
export type NotificationIdentityType = "person" | "media" | "society";

/**
 * I soli target che il backend produce (CHECK `notifications_target_type_check`).
 * `conversation` (DAS-REV-34 §15–§17): le notifiche strutturali dei gruppi; l'id è
 * la Conversation e il tap passa sempre dal resolver server, mai da un'apertura diretta.
 */
export type NotificationTargetType =
  | "profile"
  | "content"
  | "comment"
  | "scheduled_content"
  | "conversation";

export type NotificationActor = {
  /** Falso quando l'identità è stata cancellata (§266): nome e avatar mancano. */
  available: boolean;
  avatarUrl: string | null;
  id: string;
  name: string | null;
  type: NotificationIdentityType;
  verified: boolean;
};

export type NotificationRecipient = {
  id: string;
  /** Vero quando non è la persona dell'account: il copy va disambiguato (§98, §102). */
  managed: boolean;
  name: string | null;
  type: NotificationIdentityType;
};

export type NotificationTarget = {
  id: string;
  params: Record<string, unknown>;
  type: NotificationTargetType;
};

export type InboxNotification = {
  actor: NotificationActor | null;
  body: string | null;
  category: string | null;
  createdAt: string;
  /** Payload storico dei tipi operativi (id richiesta, evento, Società…). */
  data: Record<string, unknown>;
  /** `n_display_at`: ordina il Centro e decide la sezione temporale (§143, §145). */
  displayAt: string;
  eventCount: number;
  id: string;
  /** Azzurrino = non aperta (§13). */
  isOpened: boolean;
  /** NEW = non ancora vista nel Centro (§12). */
  isNew: boolean;
  preview: string | null;
  recipient: NotificationRecipient | null;
  revision: number;
  target: NotificationTarget | null;
  title: string;
  type: string;
};

export type NotificationPage = {
  /** Ora del server della prima lettura: il cutoff di `mark_notification_center_seen` (§15). */
  asOf: string | null;
  hasMore: boolean;
  items: InboxNotification[];
};

/** Cursore keyset (§222): l'ultima riga della pagina precedente. */
export type NotificationCursor = {
  beforeAt: string;
  beforeId: string;
};

/** Quel che serve a risolvere una destinazione, anche da una riga letta per id (push, §167). */
export type NotificationTargetSource = Pick<InboxNotification, "actor" | "data" | "target" | "type">;
