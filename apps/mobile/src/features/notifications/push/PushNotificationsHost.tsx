/**
 * HOM-14 §176-§179 — punto di aggancio unico del client Push nel root layout.
 * Non renderizza nulla. Su web (harness react-native-web) non monta il runtime nativo,
 * quindi nessun hook di expo-notifications viene eseguito e nulla può fallire.
 */

import { Platform } from "react-native";

import { usePushNotifications } from "./use-push-notifications";

function PushNotificationsRuntime() {
  usePushNotifications();
  return null;
}

export function PushNotificationsHost() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  return <PushNotificationsRuntime />;
}
