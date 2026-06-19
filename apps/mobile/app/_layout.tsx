import "react-native-url-polyfill/auto";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionProvider } from "../src/features/auth/session-provider";
import { queryClient } from "../src/lib/query-client";
import { ToastProvider } from "../src/ui";

export default function RootLayout() {
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
