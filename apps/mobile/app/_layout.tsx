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
          <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
