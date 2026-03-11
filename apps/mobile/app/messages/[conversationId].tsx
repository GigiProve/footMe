import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { Screen } from "../../src/components/ui/screen";
import {
  getConversationMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  unsubscribeFromConversation,
  type ConversationMessage,
} from "../../src/features/messaging/messaging-service";
import { colors } from "../../src/theme/tokens";
import { Button, Card, Input } from "../../src/ui";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string; otherName?: string }>();
  const { needsOnboarding, session } = useSession();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const conversationId = useMemo(() => {
    if (Array.isArray(params.conversationId)) {
      return params.conversationId[0];
    }

    return params.conversationId;
  }, [params.conversationId]);

  const otherName = useMemo(() => {
    if (Array.isArray(params.otherName)) {
      return params.otherName[0];
    }

    return params.otherName ?? "Conversazione";
  }, [params.otherName]);

  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const nextMessages = await getConversationMessages(conversationId);
      setMessages(nextMessages);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento della conversazione.";
      Alert.alert("Conversazione non disponibile", message);
    } finally {
      setIsLoading(false);
    }

    try {
      await markConversationRead(conversationId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile aggiornare lo stato di lettura.";
      Alert.alert("Stato lettura non aggiornato", message);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    const channel = subscribeToConversation(conversationId, () => {
      void loadConversation();
    });

    return () => {
      void unsubscribeFromConversation(channel);
    };
  }, [conversationId, loadConversation]);

  async function handleSendMessage() {
    if (!conversationId || !session?.user) {
      return;
    }

    try {
      setIsSending(true);
      await sendMessage({
        body: draft,
        conversationId,
        senderProfileId: session.user.id,
      });
      setDraft("");
      await loadConversation();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'invio del messaggio.";
      Alert.alert("Messaggio non inviato", message);
    } finally {
      setIsSending(false);
    }
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: 16 }}>
        <View
          style={{
            gap: 10,
            padding: 20,
            borderRadius: 24,
            backgroundColor: colors.textPrimary,
          }}
        >
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.heroSoft, fontWeight: "700" }}>
              ← Torna ai messaggi
            </Text>
          </Pressable>
          <Text
            style={{
              fontSize: 28,
              lineHeight: 32,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            {otherName}
          </Text>
          <Text style={{ color: colors.textInverseMuted, lineHeight: 22 }}>
            Conversazione privata 1:1 del network footMe.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
          style={{ flex: 1 }}
        >
          {isLoading ? (
            <Card style={{ borderRadius: 20 }}>
              <Text style={{ color: colors.textSecondary }}>
                Caricamento conversazione in corso...
              </Text>
            </Card>
          ) : null}
          {!isLoading && messages.length === 0 ? (
            <Card style={{ borderRadius: 20 }}>
              <Text style={{ color: colors.textSecondary }}>
                Nessun messaggio ancora inviato. Usa il box qui sotto per rompere
                il ghiaccio.
              </Text>
            </Card>
          ) : null}
          {messages.map((message) => {
            const isOwnMessage = message.sender_profile_id === session.user.id;

            return (
              <View
                key={message.message_id}
                style={{
                  alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  gap: 6,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: isOwnMessage
                    ? colors.accent
                    : colors.surface,
                  borderWidth: isOwnMessage ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: isOwnMessage ? colors.inkInvert : colors.textPrimary,
                    fontWeight: "800",
                  }}
                >
                  {isOwnMessage ? "Tu" : message.sender_full_name}
                </Text>
                <Text
                  style={{
                    color: isOwnMessage ? colors.inkInvert : colors.textPrimary,
                    lineHeight: 22,
                  }}
                >
                  {message.body}
                </Text>
                <Text
                  style={{
                    color: isOwnMessage ? colors.textInverseMuted : colors.textMuted,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {formatTimestamp(message.sent_at)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <Card
          style={{
            gap: 12,
            borderRadius: 22,
          }}
        >
          <Input
            multiline
            onChangeText={setDraft}
            placeholder="Scrivi un messaggio professionale e diretto"
            value={draft}
          />
          <Button
            disabled={isSending}
            label={isSending ? "Invio in corso..." : "Invia messaggio"}
            onPress={handleSendMessage}
            variant="hero"
          />
        </Card>
      </View>
    </Screen>
  );
}
