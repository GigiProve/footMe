/**
 * HOM-14 §176-§186, §231 — derivazioni pure del client Push, senza React né moduli
 * nativi, così da essere testabili senza renderizzare.
 *
 * Regola di fondo (§186): lo stato Push mostrato all'utente viene sempre dal permesso
 * reale del sistema operativo, mai da un flag interno. Un toggle non può "accendere"
 * le Push che iOS/Android hanno negato.
 */

import { isUuid, type ConversationLink } from "../conversation-target-presentation";

export type PushPermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export type PushPermissionInfo = {
  /** Se false il sistema non mostrerà più il prompt: si può solo andare nelle impostazioni. */
  canAskAgain: boolean;
  state: PushPermissionState;
};

/** Cosa può fare la pagina Preferenze per portare le Push a "Attive". */
export type PushPermissionAction = "none" | "request" | "open_settings";

/** Forma minima della risposta di `getPermissionsAsync` che serve alla derivazione. */
type PermissionResponseLike = {
  canAskAgain?: boolean;
  granted?: boolean;
  status?: string;
};

export const PUSH_PERMISSION_UNSUPPORTED: PushPermissionInfo = {
  canAskAgain: false,
  state: "unsupported",
};

export function resolvePushPermission(
  response: PermissionResponseLike | null | undefined,
): PushPermissionInfo {
  if (!response) {
    return PUSH_PERMISSION_UNSUPPORTED;
  }

  if (response.granted === true || response.status === "granted") {
    return { canAskAgain: true, state: "granted" };
  }

  if (response.status === "undetermined") {
    return { canAskAgain: response.canAskAgain ?? true, state: "undetermined" };
  }

  return { canAskAgain: response.canAskAgain ?? false, state: "denied" };
}

export function pushPermissionAction(info: PushPermissionInfo): PushPermissionAction {
  switch (info.state) {
    case "granted":
    case "unsupported":
      return "none";
    case "undetermined":
    case "denied":
      return info.canAskAgain ? "request" : "open_settings";
  }
}

/** §183: «Notifiche push — Attive» oppure «Disattivate». */
export function pushStatusLabel(info: PushPermissionInfo): string {
  return info.state === "granted" ? "Notifiche push — Attive" : "Notifiche push — Disattivate";
}

/** §184: dice chiaramente perché le Push non arrivano, senza fingere un'attivazione (§186). */
export function pushStatusHint(info: PushPermissionInfo): string {
  switch (info.state) {
    case "granted":
      return "Le notifiche push sono consentite su questo dispositivo.";
    case "undetermined":
      return "Per ricevere notifiche push devi consentirle su questo dispositivo.";
    case "denied":
      return "Le notifiche push sono disattivate nelle impostazioni del dispositivo. Finché restano disattivate non riceverai push, qualunque scelta fai qui sotto.";
    case "unsupported":
      return "Le notifiche push non sono disponibili su questo dispositivo.";
  }
}

export function pushActionLabel(action: PushPermissionAction): string | null {
  switch (action) {
    case "request":
      return "Attiva le notifiche push";
    case "open_settings":
      return "Apri le impostazioni del dispositivo";
    case "none":
      return null;
  }
}

/** Gli switch push restano modificabili, ma dichiarano che non arriveranno push (§186). */
export function pushTogglesBlocked(info: PushPermissionInfo): boolean {
  return info.state !== "granted";
}

const NOTIFICATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * §211: il payload Push porta solo `notification_id`. Lo si accetta solo se è un uuid:
 * finisce in un path di navigazione, quindi un valore arbitrario non deve passare.
 */
export function extractNotificationId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const value = (data as Record<string, unknown>).notification_id;

  return typeof value === "string" && NOTIFICATION_ID_PATTERN.test(value) ? value : null;
}

export type ConversationPushKind = "message" | "lifecycle";

/** Il payload data di una push chat o lifecycle (DAS-REV-34 §20): solo identificativi. */
export type ConversationPushPayload = {
  conversationId: string;
  kind: ConversationPushKind;
  periodId: string | null;
};

function conversationPushRecord(data: unknown): Record<string, unknown> | null {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
}

/**
 * DAS-REV-34 §20, §25: le push di chat portano `{conversation_id, period_id, kind}` e
 * nessun testo. Si accettano solo uuid e i due `kind` noti: i valori finiscono in una
 * RPC e in un path, e un id non è comunque una capability (lo decide il server).
 * `period_id` assente o null = DIRECT; presente ma non uuid = payload scartato.
 */
export function extractConversationPush(data: unknown): ConversationPushPayload | null {
  const record = conversationPushRecord(data);
  const conversationId = record?.conversation_id;

  if (!record || !isUuid(conversationId)) {
    return null;
  }

  const { kind, period_id: period } = record;

  if (kind !== "message" && kind !== "lifecycle") {
    return null;
  }

  if (period !== undefined && period !== null && !isUuid(period)) {
    return null;
  }

  return { conversationId, kind, periodId: typeof period === "string" ? period : null };
}

/** L'intento da passare al resolver: la push ordinaria è `message`, Archive/Reactivate `lifecycle`. */
export function conversationPushLink(payload: ConversationPushPayload): ConversationLink {
  return { conversationId: payload.conversationId, intent: payload.kind, periodId: payload.periodId };
}

/**
 * DAS-REV-34 §20: in foreground, la push di una conversazione già aperta e visibile
 * non deve produrre banner né voce in lista. Solo per la stessa conversazione: ogni
 * altra push, anche di chat, si presenta normalmente.
 */
export function shouldSuppressForegroundPush(data: unknown, visibleConversationId: string | null): boolean {
  if (!visibleConversationId) {
    return false;
  }

  const record = conversationPushRecord(data);

  return record !== null && record.conversation_id === visibleConversationId;
}

export type ForegroundPresentation = {
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
  shouldShowBanner: boolean;
  shouldShowList: boolean;
};

/**
 * Come si presenta una push mentre l'app è in primo piano. Su iOS niente suono
 * forzato; su Android `shouldPlaySound: false` sopprime anche il banner (doc
 * expo-notifications), quindi lì resta true: il volume lo governa il sistema.
 * La push della conversazione visibile non mostra nulla, nemmeno il suono.
 */
export function foregroundPresentation(
  data: unknown,
  visibleConversationId: string | null,
  isAndroid: boolean,
): ForegroundPresentation {
  const suppressed = shouldSuppressForegroundPush(data, visibleConversationId);

  return {
    shouldPlaySound: !suppressed && isAndroid,
    shouldSetBadge: false,
    shouldShowBanner: !suppressed,
    shouldShowList: !suppressed,
  };
}

/** Vero per una push di conversazione (chat o lifecycle): alla ricezione si ricaricano Inbox e badge Messaggi. */
export function isConversationPush(data: unknown): boolean {
  return extractConversationPush(data) !== null;
}

/** §177: il tap apre il Centro; l'handler `open` decide opened + Target Resolver (§167). */
export function notificationOpenHref(notificationId: string): string {
  return `/notifications?open=${notificationId}`;
}

type ConstantsLike = {
  easConfig?: { projectId?: unknown } | null;
  expoConfig?: { extra?: { eas?: { projectId?: unknown } } | null } | null;
};

/** Senza projectId non si può chiedere il token: si salta la registrazione, non si va in crash. */
export function resolveExpoProjectId(constants: ConstantsLike): string | null {
  const candidates = [constants.easConfig?.projectId, constants.expoConfig?.extra?.eas?.projectId];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

export type PushRegistrationBlocker =
  | "unsupported_platform"
  | "not_physical_device"
  | "permission_not_granted";

/**
 * La registrazione parte solo su device fisico, fuori dal web, e solo con il permesso
 * già concesso: il prompt OS non parte mai da qui (vedi `use-push-notifications.ts`).
 */
export function pushRegistrationBlocker(input: {
  isDevice: boolean;
  permission: PushPermissionState;
  platform: string;
}): PushRegistrationBlocker | null {
  if (input.platform !== "ios" && input.platform !== "android") {
    return "unsupported_platform";
  }

  if (!input.isDevice) {
    return "not_physical_device";
  }

  return input.permission === "granted" ? null : "permission_not_granted";
}
