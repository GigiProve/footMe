import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { AppText, Avatar, Badge, SectionCard } from "../../ui";
import { colors, spacing } from "../../theme/tokens";
import {
  getRelationshipTypeLabel,
  type RelationshipType,
  type RepresentationVisibility,
} from "./agent-representation-service";

type RepresentationRow = {
  agent_avatar_url: string | null;
  agent_full_name: string | null;
  agent_profile_id: string;
  id: string;
  relationship_type: RelationshipType;
  status: string;
  visibility: RepresentationVisibility;
};

type RepresentationSectionProps = {
  isOwner: boolean;
  representations: RepresentationRow[];
};

export function RepresentationSection({
  isOwner,
  representations,
}: RepresentationSectionProps) {
  const router = useRouter();

  if (representations.length === 0) return null;

  const hasPrivate = representations.some((r) => r.visibility === "private");
  const title =
    isOwner && hasPrivate ? "Collegamenti professionali" : "Rappresentanza";

  return (
    <SectionCard title={title} variant="flat">
      {representations.map((rep, index) => {
        const isLast = index === representations.length - 1;
        const agentName = rep.agent_full_name ?? "Agente";
        const typeLabel = getRelationshipTypeLabel(rep.relationship_type);

        if (isOwner) {
          return (
            <Pressable
              key={rep.id}
              accessibilityLabel={`Gestisci collegamento con ${agentName}`}
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  `/representation/manage/${rep.id}` as never,
                )
              }
              style={({ pressed }) => [
                styles.row,
                isLast ? null : styles.rowBorder,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <Avatar name={agentName} uri={rep.agent_avatar_url} size="sm" />
              <View style={styles.rowBody}>
                <AppText variant="titleSm" numberOfLines={1}>
                  {agentName}
                </AppText>
                <AppText variant="bodySm" color="secondary" numberOfLines={1}>
                  {typeLabel}
                </AppText>
              </View>
              <View style={styles.rowTrailing}>
                <Badge
                  label={rep.visibility === "public" ? "Pubblico" : "Privato"}
                  variant={rep.visibility === "public" ? "success" : "default"}
                />
                <Ionicons
                  color={colors.textSecondary}
                  name="chevron-forward"
                  size={14}
                />
              </View>
            </Pressable>
          );
        }

        // Visitor view — only public rows (RLS already filters, but guard anyway)
        if (rep.visibility !== "public") return null;

        return (
          <Pressable
            key={rep.id}
            accessibilityLabel={`Apri profilo di ${agentName}`}
            accessibilityRole="button"
            onPress={() =>
              router.push(`/profile/${rep.agent_profile_id}` as never)
            }
            style={({ pressed }) => [
              styles.row,
              isLast ? null : styles.rowBorder,
              pressed ? styles.rowPressed : null,
            ]}
          >
            <Avatar name={agentName} uri={rep.agent_avatar_url} size="sm" />
            <View style={styles.rowBody}>
              <AppText variant="titleSm" numberOfLines={1}>
                {agentName}
              </AppText>
              <AppText variant="bodySm" color="secondary" numberOfLines={1}>
                {typeLabel}
              </AppText>
            </View>
            <AppText variant="bodySm" color="accent">
              Contatta
            </AppText>
          </Pressable>
        );
      })}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  rowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowTrailing: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
});
