/**
 * Portfolio assistiti di un procuratore (REV-PROF-13, "Vedi tutti gli
 * assistiti").
 *
 * Non è un secondo elenco: legge la stessa `fetch_agent_public_assistiti` che
 * riempie gli assistiti in evidenza nella tab Carriera, quindi conteggio e
 * contenuto non possono divergere. Le regole di privacy sono quelle della RPC
 * — solo relazioni accettate, attive e pubbliche — e valgono identiche per
 * owner e visitor: è una consultazione pubblica.
 *
 * L'owner ha in più l'entry point alla gestione dedicata, che è l'unico posto
 * dove vivono richieste pendenti, relazioni private e azioni gestionali.
 */
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { AppText, Avatar, Button, EmptyState, ScreenHeader } from "../../../src/ui";
import {
  fetchAgentPublicAssistiti,
  getRelationshipTypeLabel,
  type AgentPublicAssistito,
} from "../../../src/features/relationships/agent-representation-service";
import { getPlayerPositionLabel } from "../../../src/features/profiles/player-sports";
import { useSession } from "../../../src/features/auth/use-session";
import { colors, radius, spacing } from "../../../src/theme/tokens";

export default function AgentPortfolioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useSession();
  const agentProfileId = typeof id === "string" ? id : "";
  const isOwner = Boolean(profile?.id) && profile?.id === agentProfileId;

  const [assistiti, setAssistiti] = useState<AgentPublicAssistito[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!agentProfileId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasFailed(false);

    try {
      setAssistiti(await fetchAgentPublicAssistiti(agentProfileId));
    } catch {
      setAssistiti([]);
      setHasFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [agentProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <ScreenHeader
        leading={
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed ? styles.rowPressed : null]}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
          </Pressable>
        }
        title="Assistiti"
      />

      {hasFailed ? (
        <View style={styles.state}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare il portfolio assistiti.
          </AppText>
          <Button label="Riprova" onPress={() => void load()} size="sm" variant="secondary" />
        </View>
      ) : isLoading ? (
        <View style={styles.state} testID="agent-portfolio-loading">
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.skeletonRow} />
          ))}
        </View>
      ) : assistiti.length === 0 ? (
        <EmptyState
          description={
            isOwner
              ? "Aggiungi o collega i tuoi assistiti per valorizzare il tuo profilo professionale."
              : "Questo Procuratore non ha ancora assistiti visibili nel portfolio."
          }
          icon="people-outline"
          title={isOwner ? "Il tuo portfolio è ancora vuoto" : "Nessun assistito pubblico"}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={assistiti}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const name = item.player_full_name ?? "Giocatore";
            const metaLine = [
              item.primary_position
                ? getPlayerPositionLabel(item.primary_position)
                : null,
              item.current_team,
            ]
              .filter(Boolean)
              .join(" · ");
            const relationLabel = getRelationshipTypeLabel(item.relationship_type);

            return (
              <Pressable
                accessibilityLabel={`${name}, ${relationLabel}${metaLine ? `, ${metaLine}` : ""}`}
                accessibilityRole="button"
                onPress={() => router.push(`/profile/${item.player_profile_id}` as never)}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
                testID={`agent-portfolio-${item.player_profile_id}`}
              >
                <Avatar name={name} size="md" uri={item.player_avatar_url ?? undefined} />
                <View style={styles.rowBody}>
                  <AppText numberOfLines={1} variant="titleSm">
                    {name}
                  </AppText>
                  {metaLine ? (
                    <AppText color="secondary" numberOfLines={1} variant="bodySm">
                      {metaLine}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.relationPill}>
                  <AppText color="secondary" numberOfLines={1} variant="caption">
                    {relationLabel}
                  </AppText>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Le azioni gestionali restano fuori dalla consultazione pubblica. */}
      {isOwner ? (
        <View style={styles.ownerActions}>
          <Button
            label="Gestisci assistiti"
            onPress={() =>
              router.push("/representation/hub?source=portfolio" as never)
            }
            variant="secondary"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  list: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[16],
  },
  ownerActions: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing[16],
  },
  relationPill: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius.full,
    maxWidth: 132,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingVertical: spacing[12],
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  rowPressed: {
    opacity: 0.6,
  },
  skeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[12],
    height: 56,
  },
  state: {
    gap: spacing[12],
    padding: spacing[16],
  },
});
