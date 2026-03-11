import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { Screen } from "../../src/components/ui/screen";
import {
  getConversationSummaries,
  type ConversationSummary,
} from "../../src/features/messaging/messaging-service";
import {
  getNetworkOverview,
  startDirectConversation,
  type NetworkOverviewItem,
} from "../../src/features/networking/networking-service";
import { colors } from "../../src/theme/tokens";

const roleLabels: Record<string, string> = {
  club_admin: "Societa'",
  coach: "Allenatore",
  player: "Calciatore",
  staff: "Staff",
};

const positionLabels: Record<string, string> = {
  defender: "Difensore",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
};

function formatRole(value: string | null) {
  if (!value) {
    return "Ruolo non definito";
  }

  return roleLabels[value] ?? value;
}

function formatPosition(value: string | null) {
  if (!value) {
    return "Posizione non definita";
  }

  return positionLabels[value] ?? value;
}

function formatLocation(city: string | null, region: string | null) {
  return [city, region].filter(Boolean).join(" · ") || "Localita' non definita";
}

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [connections, setConnections] = useState<NetworkOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unread_count, 0),
    [summaries],
  );
  const existingConversationProfiles = useMemo(
    () => new Set(summaries.map((summary) => summary.other_profile_id)),
    [summaries],
  );
  const connectedWithoutConversation = useMemo(() => {
    return connections.filter(
      (entry) =>
        entry.status === "accepted" &&
        !existingConversationProfiles.has(entry.other_profile_id),
    );
  }, [connections, existingConversationProfiles]);

  const loadInbox = useCallback(async () => {
    if (!session?.user) {
      setSummaries([]);
      setConnections([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [nextSummaries, nextConnections] = await Promise.all([
        getConversationSummaries(),
        getNetworkOverview(),
      ]);
      setSummaries(nextSummaries);
      setConnections(nextConnections);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento della messaggistica.";
      Alert.alert("Inbox non disponibile", message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function handleOpenConversation(profileId: string, otherName: string) {
    try {
      setActionProfileId(profileId);
      const conversationId = await startDirectConversation(profileId);
      router.push({
        pathname: "/messages/[conversationId]",
        params: { conversationId, otherName },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura della chat.";
      Alert.alert("Chat non disponibile", message);
    } finally {
      setActionProfileId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <View
          style={{
            gap: 10,
            padding: 22,
            borderRadius: 26,
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: 12,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Messaging MVP
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 34,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            Inbox privata e primi contatti diretti
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: colors.textInverseMuted,
            }}
          >
            Le connessioni accettate possono trasformarsi in conversazioni 1:1.
            Da qui controlli le chat, i messaggi non letti e chi è pronto per
            il primo contatto.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Conversazioni
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: 24,
                fontWeight: "800",
              }}
            >
              {summaries.length}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 22,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              Non letti
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: 24,
                fontWeight: "800",
              }}
            >
              {unreadCount}
            </Text>
          </View>
        </View>

        <View
          style={{
            gap: 14,
            padding: 18,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>
              Pronti a scriverti
            </Text>
            <Pressable onPress={() => void loadInbox()}>
              <Text style={{ color: colors.accentStrong, fontWeight: "700" }}>
                Aggiorna
              </Text>
            </Pressable>
          </View>
          {isLoading ? (
            <Text style={{ color: colors.textSecondary }}>
              Caricamento inbox in corso...
            </Text>
          ) : null}
          {!isLoading && connectedWithoutConversation.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Nessuna connessione pronta per una nuova chat. Vai in Rete per
              ampliare il tuo network professionale.
            </Text>
          ) : null}
          {connectedWithoutConversation.slice(0, 3).map((entry) => (
            <View
              key={entry.connection_id}
              style={{
                gap: 8,
                padding: 16,
                borderRadius: 18,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }}>
                {entry.other_full_name}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatRole(entry.other_role)}
                {entry.other_role === "player"
                  ? ` · ${formatPosition(entry.other_primary_position)}`
                  : ""}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatLocation(entry.other_city, entry.other_region)}
              </Text>
              <Pressable
                disabled={actionProfileId === entry.other_profile_id}
                onPress={() =>
                  handleOpenConversation(entry.other_profile_id, entry.other_full_name)
                }
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: "center",
                  backgroundColor: colors.hero,
                }}
              >
                <Text style={{ color: colors.inkInvert, fontWeight: "700" }}>
                  {actionProfileId === entry.other_profile_id
                    ? "Apertura chat..."
                    : "Scrivi ora"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>
            Conversazioni recenti
          </Text>
          {!isLoading && summaries.length === 0 ? (
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
                La tua inbox è vuota. Accetta una connessione o avvia una chat
                dalla tab Rete.
              </Text>
            </View>
          ) : null}
          {summaries.map((summary) => (
            <Pressable
              key={summary.conversation_id}
              onPress={() =>
                router.push({
                  pathname: "/messages/[conversationId]",
                  params: {
                    conversationId: summary.conversation_id,
                    otherName: summary.other_full_name,
                  },
                })
              }
              style={{
                gap: 8,
                padding: 18,
                borderRadius: 22,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    {summary.other_full_name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {formatRole(summary.other_role)}
                    {summary.other_role === "player"
                      ? ` · ${formatPosition(summary.other_primary_position)}`
                      : ""}
                  </Text>
                </View>
                {summary.unread_count > 0 ? (
                  <View
                    style={{
                      minWidth: 28,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: colors.hero,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.inkInvert, fontWeight: "800" }}>
                      {summary.unread_count}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.textSecondary }}>
                {formatLocation(summary.other_city, summary.other_region)}
              </Text>
              <Text style={{ color: colors.textPrimary, lineHeight: 22 }}>
                {summary.last_message_body ??
                  "Nessun messaggio ancora inviato: apri la chat per iniziare."}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                {summary.last_message_sent_at
                  ? new Date(summary.last_message_sent_at).toLocaleString("it-IT")
                  : "Conversazione pronta"}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
