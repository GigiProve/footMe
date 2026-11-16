/**
 * HOM-14 §176-§186, §231 — derivazioni pure del client Push, senza React né moduli
 * nativi, così da essere testabili senza renderizzare.
 *
 * Regola di fondo (§186): lo stato Push mostrato all'utente viene sempre dal permesso
 * reale del sistema operativo, mai da un flag interno. Un toggle non può "accendere"
 * le Push che iOS/Android hanno negato.
 */

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
