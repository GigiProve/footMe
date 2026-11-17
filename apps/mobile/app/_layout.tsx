import "react-native-url-polyfill/auto";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionGuard } from "../src/features/auth/SessionGuard";
import { SessionProvider } from "../src/features/auth/session-provider";
import { PushNotificationsHost } from "../src/features/notifications/push/PushNotificationsHost";
import { queryClient } from "../src/lib/query-client";
import { useAppFonts } from "../src/styles/fonts";
import { ToastProvider } from "../src/ui";

export default function RootLayout() {
  const fontsReady = useAppFonts();

  // Mulish porta i numeri e i titoli di schermata: montare l'albero prima che
  // sia pronto farebbe partire ogni statistica col fallback di sistema e poi
  // saltare alla misura definitiva.
  if (!fontsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          {/* HOM-14 §176-§179: registrazione Push, tap su notifica e pulizia al cambio account; non renderizza nulla. */}
          <PushNotificationsHost />
          {/* HOM-15 §293–§297: la guardia di sessione comune; le route pubbliche sono elencate in `session-guard-presentation`. */}
          <SessionGuard />
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
            {/* HOM-06.1 §6: il composer Post è a schermo intero, senza bottom navigation. */}
            <Stack.Screen
              name="post-compose"
              options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }}
            />
            {/* HOM-06.2 §28–§29: l'editor Articolo è a schermo intero, senza bottom navigation né chrome Home. */}
            <Stack.Screen
              name="article-compose"
              options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }}
            />
            {/* HOM-06.2 §137: Bozze e programmati è una schermata fuori dalle tab, con il suo Indietro (anche a gesto). */}
            <Stack.Screen name="drafts" options={{ gestureEnabled: true }} />
            {/* HOM-07 §45–§46, §54: la lista Mi piace è una pagina detail fuori dalle tab; il Back (anche a gesto) torna alla stessa lista e allo stesso scroll. */}
            <Stack.Screen name="likes/[type]/[id]" options={{ gestureEnabled: true }} />
            {/* HOM-11 §79, D7: Segnala è un flow a schermo intero, senza bottom navigation né chrome Home; «Fine» torna all'origine nello stack. */}
            <Stack.Screen
              name="report/[targetType]/[id]"
              options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }}
            />
          </Stack>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
