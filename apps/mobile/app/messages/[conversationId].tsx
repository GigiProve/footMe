import { useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Alert,
  Linking,
  StyleSheet,
  View,
} from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
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
import { AppText, Button, Card, Input } from "../../src/ui";

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
      <KeyboardAwareForm
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Button
            label="← Torna ai messaggi"
            onPress={() => router.back()}
            size="sm"
            style={styles.backButton}
            variant="link"
          />
          <AppText variant="displaySm" color="inverse">
            {otherName}
          </AppText>
          <AppText variant="bodySm" color="inverseMuted">
            Conversazione privata 1:1 del network footMe.
          </AppText>
        </View>

        {isLoading ? (
          <Card style={styles.statusCard}>
            <AppText color="secondary">
              Caricamento conversazione in corso...
            </AppText>
          </Card>
        ) : null}
        {!isLoading && messages.length === 0 ? (
          <Card style={styles.statusCard}>
            <AppText color="secondary">
              Nessun messaggio ancora inviato. Usa il box qui sotto per rompere
              il ghiaccio.
            </AppText>
          </Card>
        ) : null}
        {messages.map((message) => {
          const isOwnMessage = message.sender_profile_id === session.user.id;

          return message.message_kind === "contact_card" &&
            message.shared_contact_name &&
            message.shared_contact_phone ? (
            <View
              key={message.message_id}
              style={[
                styles.contactCardWrapper,
                isOwnMessage ? styles.alignEnd : styles.alignStart,
              ]}
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
              style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownBubble : styles.otherBubble,
              ]}
            >
              <AppText
                variant="titleSm"
                color={isOwnMessage ? "inverse" : "primary"}
              >
                {isOwnMessage ? "Tu" : message.sender_full_name}
              </AppText>
              <AppText
                variant="bodySm"
                color={isOwnMessage ? "inverse" : "primary"}
              >
                {message.body}
              </AppText>
              <AppText
                variant="caption"
                color={isOwnMessage ? "inverseMuted" : "muted"}
              >
                {formatTimestamp(message.sent_at)}
              </AppText>
            </View>
          );
        })}

        <Card style={styles.composerCard}>
          <Input
            multiline
            onChangeText={setDraft}
            placeholder="Scrivi un messaggio professionale e diretto"
            style={styles.composerInput}
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
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[16],
  },
  header: {
    gap: spacing[10],
    padding: spacing[20],
    borderRadius: radius[8],
    backgroundColor: colors.surfaceInverse,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  statusCard: {
    borderRadius: radius[8],
  },
  contactCardWrapper: {
    maxWidth: "82%",
  },
  alignEnd: {
    alignSelf: "flex-end",
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    maxWidth: "82%",
    gap: spacing[6],
    padding: spacing[14],
    borderRadius: radius[8],
    borderColor: colors.border,
  },
  ownBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accent,
  },
  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  composerCard: {
    gap: spacing[12],
  },
  composerInput: {
    minHeight: sizes.messageComposerMinHeight,
  },
});
