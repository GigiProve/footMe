import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  cancelRequest,
  fetchAgentAssistiti,
  getRelationshipTypeLabel,
  type AgentAssistito,
  type RelationshipType,
  type RepresentationStatus,
} from "../../relationships/agent-representation-service";
import { getPlayerPositionLabel } from "../player-sports";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Badge, Button, EmptyState, ListItem } from "../../../ui";

type AssistitiSectionProps = {
  agentProfileId: string;
  isOwner: boolean;
};

type FilterChip = {
  label: string;
  value: string;
};

const FILTER_CHIPS: FilterChip[] = [
  { label: "Tutti", value: "all" },
  { label: "Procuratore", value: "procuratore" },
  { label: "Intermediario", value: "intermediario" },
  { label: "Referente sportivo", value: "referente_sportivo" },
  { label: "Attivi", value: "accepted" },
  { label: "In attesa", value: "pending" },
];

function buildSubtitleLine1(item: AgentAssistito): string {
  const position = getPlayerPositionLabel(item.primary_position);
  const team = item.current_team ?? "Svincolato";
  const birth = item.birth_year ? ` • Classe ${item.birth_year}` : "";

  return `${position} • ${team}${birth}`;
}

function buildSubtitleLine2(item: AgentAssistito, isPending: boolean): string {
  const typeLabel = getRelationshipTypeLabel(item.relationship_type);
  const visibilityLabel =
    isPending
      ? item.visibility === "public"
        ? "Pubblico proposto"
        : "Privato"
      : item.visibility === "public"
        ? "Pubblico"
        : "Privato";

  return `${typeLabel} • ${visibilityLabel}`;
}

function applyFilter(items: AgentAssistito[], activeFilter: string): AgentAssistito[] {
  if (activeFilter === "all") {
    return items;
  }

  if (activeFilter === "accepted" || activeFilter === "pending") {
    return items.filter((item) => item.status === (activeFilter as RepresentationStatus));
  }

  return items.filter(
    (item) => item.relationship_type === (activeFilter as RelationshipType),
  );
}

export function AssistitiSection({ agentProfileId, isOwner }: AssistitiSectionProps) {
  const router = useRouter();
  const [assistiti, setAssistiti] = useState<AgentAssistito[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadAssistiti = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAgentAssistiti(agentProfileId);
      setAssistiti(data);
    } catch {
      setAssistiti([]);
    } finally {
      setIsLoading(false);
    }
  }, [agentProfileId]);

  useEffect(() => {
    void loadAssistiti();
  }, [loadAssistiti]);

  function handleFilterPress(value: string) {
    setActiveFilter((current) => (current === value && value !== "all" ? "all" : value));
  }

  function handleCancelRequest(item: AgentAssistito) {
    Alert.alert(
      "Annulla richiesta",
      `Sei sicuro di voler annullare la richiesta per ${item.player_full_name ?? "questo giocatore"}?`,
      [
        { style: "cancel", text: "No" },
        {
          style: "destructive",
          text: "Annulla richiesta",
          onPress: async () => {
            try {
              setCancellingId(item.id);
              await cancelRequest(item.id);
              await loadAssistiti();
            } catch {
              Alert.alert("Errore", "Impossibile annullare la richiesta. Riprova.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  }

  const filtered = applyFilter(assistiti, activeFilter);
  const pendingRows = filtered.filter((item) => item.status === "pending");
  const activeRows = filtered.filter((item) => item.status === "accepted");
  const hasAny = pendingRows.length > 0 || activeRows.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="titleSm" style={styles.title}>
            Assistiti
          </AppText>
          <AppText color="secondary" variant="bodySm">
            Calciatori collegati al profilo professionale dell'agente.
          </AppText>
        </View>
        {isOwner ? (
          <Button
            label="+ Aggiungi assistito"
            onPress={() => router.push("/representation/add" as never)}
            size="sm"
            variant="outline"
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.filterRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.value;

          return (
            <Pressable
              accessibilityLabel={`Filtro ${chip.label}`}
              accessibilityRole="button"
              key={chip.value}
              onPress={() => handleFilterPress(chip.value)}
              style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
            >
              <AppText
                variant="bodySm"
                style={isActive ? styles.filterChipTextActive : null}
              >
                {chip.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <AppText color="secondary" variant="bodySm" style={styles.loadingText}>
          Caricamento assistiti...
        </AppText>
      ) : !hasAny ? (
        <EmptyState
          description="I calciatori collegati appariranno qui."
          icon="people-outline"
          title="Nessun assistito"
        />
      ) : (
        <View style={styles.groupsContainer}>
          {pendingRows.length > 0 ? (
            <View style={styles.group}>
              <AppText color="secondary" variant="caption" style={styles.groupLabel}>
                Richieste in attesa
              </AppText>
              {pendingRows.map((item, index) => (
                <ListItem
                  key={item.id}
                  left={
                    <Avatar
                      name={item.player_full_name ?? ""}
                      size="md"
                      uri={item.player_avatar_url}
                    />
                  }
                  right={
                    isOwner ? (
                      <Button
                        disabled={cancellingId === item.id}
                        label="Annulla richiesta"
                        onPress={() => handleCancelRequest(item)}
                        size="sm"
                        variant="outline"
                      />
                    ) : undefined
                  }
                  showDivider={index < pendingRows.length - 1}
                  subtitle={`${buildSubtitleLine1(item)}\n${buildSubtitleLine2(item, true)}`}
                  subtitleNumberOfLines={2}
                  title={item.player_full_name ?? "Giocatore"}
                  style={styles.listItem}
                />
              ))}
            </View>
          ) : null}

          {activeRows.length > 0 ? (
            <View style={styles.group}>
              <AppText color="secondary" variant="caption" style={styles.groupLabel}>
                Assistiti attivi
              </AppText>
              {activeRows.map((item, index) => (
                <ListItem
                  key={item.id}
                  left={
                    <Avatar
                      name={item.player_full_name ?? ""}
                      size="md"
                      uri={item.player_avatar_url}
                    />
                  }
                  onPress={
                    isOwner
                      ? () => router.push(`/representation/assistito/${item.id}` as never)
                      : undefined
                  }
                  right={<Badge label="Attivo" variant="success" />}
                  showDivider={index < activeRows.length - 1}
                  subtitle={`${buildSubtitleLine1(item)}\n${buildSubtitleLine2(item, false)}`}
                  subtitleNumberOfLines={2}
                  title={item.player_full_name ?? "Giocatore"}
                  style={styles.listItem}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  filterChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  filterChipTextActive: {
    fontWeight: "600",
  },
  filterRow: {
    gap: spacing[8],
    paddingBottom: spacing[4],
  },
  group: {
    gap: spacing[4],
  },
  groupLabel: {
    marginBottom: spacing[4],
  },
  groupsContainer: {
    gap: spacing[20],
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  listItem: {
    paddingHorizontal: spacing[4],
  },
  loadingText: {
    paddingVertical: spacing[16],
  },
  title: {
    fontWeight: "700",
  },
});
