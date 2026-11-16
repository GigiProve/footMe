/**
 * HOM-14 §176-§179, §231, §274-§275 — client Push: permesso OS, registrazione del
 * token Expo sul backend, de-registrazione al logout.
 *
 * Scelta documentata: il prompt del sistema NON parte mai all'avvio a freddo. Parte
 * solo da `requestPushPermission`, chiamata dalla pagina Preferenze notifiche (azione
 * esplicita dell'utente, §179). All'avvio e al ritorno in primo piano si registra il
 * token solo se il permesso è già concesso.
 *
 * Nessuna funzione qui lancia: un errore di registrazione non deve bloccare nulla
 * (§231), il Centro in-app funziona comunque. Su web e simulatore tutto degrada a
 * "non supportato" senza toccare i moduli nativi.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "../../../lib/supabase";
import {
  PUSH_PERMISSION_UNSUPPORTED,
  pushRegistrationBlocker,
  resolveExpoProjectId,
  resolvePushPermission,
  type PushPermissionInfo,
  type PushRegistrationBlocker,
} from "./push-presentation";

const PUSH_TOKEN_STORAGE_KEY = "prolink.push.expo-token";
const UNREGISTER_TIMEOUT_MS = 3000;

export type PushRegistrationOutcome =
  | { status: "registered"; token: string }
  | { reason: PushRegistrationBlocker | "missing_project_id" | "failed"; status: "skipped" };

function isNativePushPlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Lo stato reale del permesso OS (§183-§184), mai un flag interno. */
export async function readPushPermission(): Promise<PushPermissionInfo> {
  if (!isNativePushPlatform()) {
    return PUSH_PERMISSION_UNSUPPORTED;
  }

  try {
    return resolvePushPermission(await Notifications.getPermissionsAsync());
  } catch (error) {
    console.warn("[push] lettura permesso fallita", error);
    return PUSH_PERMISSION_UNSUPPORTED;
  }
}

/** Chiede il permesso al sistema. Va chiamata solo da un gesto esplicito dell'utente. */
export async function requestPushPermission(): Promise<PushPermissionInfo> {
  if (!isNativePushPlatform()) {
    return PUSH_PERMISSION_UNSUPPORTED;
  }

  try {
    return resolvePushPermission(await Notifications.requestPermissionsAsync());
  } catch (error) {
    console.warn("[push] richiesta permesso fallita", error);
    return readPushPermission();
  }
}

async function rememberToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch (error) {
    console.warn("[push] token non memorizzato", error);
  }
}

async function readRememberedToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function forgetToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // Niente da fare: al prossimo accesso il token viene comunque riscritto.
  }
}

/**
 * Registra il token di questo device per l'account autenticato. Idempotente lato
 * backend, quindi si può richiamare a ogni avvio e al ritorno in primo piano.
 */
export async function registerPushDevice(): Promise<PushRegistrationOutcome> {
  try {
    const permission = await readPushPermission();
    const blocker = pushRegistrationBlocker({
      isDevice: Device.isDevice,
      permission: permission.state,
      platform: Platform.OS,
    });

    if (blocker) {
      return { reason: blocker, status: "skipped" };
    }

    const projectId = resolveExpoProjectId(Constants);

    if (!projectId) {
      console.warn("[push] projectId EAS assente: registrazione saltata");
      return { reason: "missing_project_id", status: "skipped" };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc("register_push_device", {
      p_app_version: Constants.expoConfig?.version ?? null,
      p_platform: Platform.OS,
      p_token: token,
    });

    if (error) {
      throw error;
    }

    await rememberToken(token);
    return { status: "registered", token };
  } catch (error) {
    console.warn("[push] registrazione device fallita", error);
    return { reason: "failed", status: "skipped" };
  }
}

async function unregisterRememberedToken(): Promise<void> {
  const token = await readRememberedToken();

  if (token) {
    const { error } = await supabase.rpc("unregister_push_device", { p_token: token });

    if (error) {
      console.warn("[push] de-registrazione device fallita", error);
    }
  }

  await forgetToken();
}

/**
 * §274: al logout il device smette di ricevere le push dell'account che esce e il
 * badge dell'icona viene azzerato. Va chiamata PRIMA del signOut (la RPC richiede la
 * sessione) e non deve mai bloccare l'uscita: tetto di tempo e nessun throw.
 */
export async function clearPushStateForLogout(): Promise<void> {
  if (!isNativePushPlatform()) {
    return;
  }

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS));

  try {
    await Promise.race([unregisterRememberedToken(), timeout]);
  } catch (error) {
    console.warn("[push] pulizia logout fallita", error);
  }

  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Il badge dell'icona è un di più (§273): nessun effetto sul logout.
  }
}
