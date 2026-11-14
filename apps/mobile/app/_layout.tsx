import "react-native-url-polyfill/auto";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionProvider } from "../src/features/auth/session-provider";
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
          </Stack>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
