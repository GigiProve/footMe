/**
 * Fallback «conversazione non disponibile» (DAS-REV-34 §22; PNG 11, 12).
 * `?reason=revoked|deleted|unavailable`: il motivo è l'unico dato in ingresso.
 * Route statica: ha la precedenza su `messages/[conversationId]`, quindi
 * `unavailable` non viene mai letto come un id di conversazione. Come la chat,
 * richiede una sessione valida; non porta nomi, foto o body.
 */
import { Redirect, useLocalSearchParams } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";
import { ConversationUnavailableScreen } from "../../src/features/messaging/components/ConversationUnavailableScreen";
import { unavailableReasonOf } from "../../src/features/messaging/unavailable-presentation";

export default function ConversationUnavailableRoute() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const { needsOnboarding, session } = useSession();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return <ConversationUnavailableScreen reason={unavailableReasonOf(params.reason)} />;
}
