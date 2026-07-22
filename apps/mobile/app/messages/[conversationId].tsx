import { useMemo } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";
import { ChatScreen } from "../../src/features/messaging/components/ChatScreen";

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ conversationId?: string; otherName?: string }>();
  const { needsOnboarding, session } = useSession();

  const conversationId = useMemo(() => {
    if (Array.isArray(params.conversationId)) {
      return params.conversationId[0];
    }

    return params.conversationId ?? "";
  }, [params.conversationId]);

  const initialName = useMemo(() => {
    if (Array.isArray(params.otherName)) {
      return params.otherName[0] ?? "Conversazione";
    }

    return params.otherName ?? "Conversazione";
  }, [params.otherName]);

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return <ChatScreen conversationId={conversationId} initialName={initialName} />;
}
