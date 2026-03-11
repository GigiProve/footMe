import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
          <Text style={{ color: "rgba(255,253,252,0.78)", lineHeight: 22 }}>
            Conversazione privata 1:1 del network footMe.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ gap: 12, paddingBottom: 12 }}
          style={{ flex: 1 }}
        >
          {isLoading ? (
            <View
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Caricamento conversazione in corso...
              </Text>
            </View>
          ) : null}
          {!isLoading && messages.length === 0 ? (
            <View
              style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Nessun messaggio ancora inviato. Usa il box qui sotto per rompere
                il ghiaccio.
              </Text>
            </View>
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
                    color: isOwnMessage ? "rgba(255,253,252,0.78)" : colors.textMuted,
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

        <View
          style={{
            gap: 12,
            padding: 16,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Scrivi un messaggio professionale e diretto"
            placeholderTextColor={colors.textMuted}
            style={{
              minHeight: 88,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
              textAlignVertical: "top",
            }}
            value={draft}
          />
          <Pressable
            disabled={isSending}
            onPress={handleSendMessage}
            style={{
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isSending ? "#6AA687" : colors.hero,
            }}
          >
            <Text style={{ color: colors.inkInvert, fontWeight: "800" }}>
              {isSending ? "Invio in corso..." : "Invia messaggio"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
