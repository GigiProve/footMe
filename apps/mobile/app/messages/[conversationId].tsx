import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { Screen } from "../../src/components/ui/screen";
import {
  getShareablePhoneContact,
  getConversationMessages,
  markConversationRead,
  sendContactCardMessage,
  sendMessage,
  subscribeToConversation,
  unsubscribeFromConversation,
  type ConversationMessage,
} from "../../src/features/messaging/messaging-service";
import { ContactCardMessage } from "../../src/features/messaging/contact-card-message";
import { ShareContactModal } from "../../src/features/messaging/share-contact-modal";
import { colors, radius, spacing, sizes } from "../../src/theme/tokens";
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
  const { needsOnboarding, profile, session } = useSession();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isSharingContact, setIsSharingContact] = useState(false);
  const [shareablePhone, setShareablePhone] = useState("");

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

  async function handleOpenShareContact() {
    if (!session?.user) {
      return;
    }

    try {
      const shareableContact = await getShareablePhoneContact(session.user.id);

      if (!shareableContact.phone.trim()) {
        throw new Error(
          "Aggiungi prima il tuo numero nella sezione Contatti del profilo per condividerlo in chat.",
        );
      }

      setShareablePhone(shareableContact.phone);
      setIsShareModalVisible(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il recupero del contatto da condividere.";
      Alert.alert("Contatto non disponibile", message);
    }
  }

  async function handleConfirmShareContact() {
    if (!conversationId || !session?.user || !shareablePhone.trim()) {
      return;
    }

    try {
      setIsSharingContact(true);
      await sendContactCardMessage({
        contactName: profile?.full_name?.trim() || "Utente footMe",
        conversationId,
        phone: shareablePhone,
        senderProfileId: session.user.id,
      });
      setIsShareModalVisible(false);
      await loadConversation();
      Alert.alert(
        "Contatto condiviso",
        "Il tuo numero è stato inviato come card dedicata in questa conversazione.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante la condivisione del contatto.";
      Alert.alert("Condivisione non riuscita", message);
    } finally {
      setIsSharingContact(false);
    }
  }

  async function handleCopyPhone(phone: string) {
    await Clipboard.setStringAsync(phone);
    Alert.alert("Numero copiato", "Puoi incollarlo dove preferisci.");
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
          <Button
            label="← Torna ai messaggi"
            onPress={() => router.back()}
            size="sm"
            style={{ alignSelf: "flex-start" }}
            variant="link"
          />
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

            return message.message_kind === "contact_card" &&
              message.shared_contact_name &&
              message.shared_contact_phone ? (
              <View
                key={message.message_id}
                style={{
                  alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                }}
              >
                <ContactCardMessage
                  isOwnMessage={isOwnMessage}
                  name={message.shared_contact_name}
                  onLongPress={() => void handleCopyPhone(message.shared_contact_phone ?? "")}
                  onPress={() => void Linking.openURL(`tel:${message.shared_contact_phone}`)}
                  phone={message.shared_contact_phone}
                  timestamp={formatTimestamp(message.sent_at)}
                />
              </View>
            ) : (
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
            gap: spacing[12],
            borderRadius: radius[22],
          }}
        >
          <Input
            multiline
            onChangeText={setDraft}
            placeholder="Scrivi un messaggio professionale e diretto"
            style={{ minHeight: sizes.messageComposerMinHeight }}
            value={draft}
          />
          <Button
            disabled={isSharingContact}
            label="Condividi contatto"
            onPress={() => void handleOpenShareContact()}
            variant="secondary"
          />
          <Button
            disabled={isSending}
            label={isSending ? "Invio in corso..." : "Invia messaggio"}
            onPress={handleSendMessage}
            variant="primary"
          />
        </Card>
        <ShareContactModal
          isLoading={isSharingContact}
          onCancel={() => {
            if (!isSharingContact) {
              setIsShareModalVisible(false);
            }
          }}
          onConfirm={() => void handleConfirmShareContact()}
          phone={shareablePhone}
          visible={isShareModalVisible}
        />
      </View>
    </Screen>
  );
}
