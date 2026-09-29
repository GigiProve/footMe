/**
 * Card di un gruppo di esperienze (REV-PROF-04, schermate 1 e 7).
 *
 * Una sola card per due usi: nell'hub mostra il riassunto ("3 stagioni · 2
 * ruoli"), nel riepilogo apre anche il dettaglio stagione per stagione. Non
 * sono due componenti perché non sono due oggetti: è lo stesso gruppo con più
 * o meno dettaglio.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { CoachExperienceGroup } from "./coach-assignment-model";

type CoachExperienceGroupCardProps = {
  group: CoachExperienceGroup;
  onEdit: () => void;
  /** Righe stagione visibili: è la differenza fra hub e riepilogo. */
  showSeasons?: boolean;
  testID?: string;
};

export function CoachExperienceGroupCard({
  group,
  onEdit,
  showSeasons = false,
  testID,
}: CoachExperienceGroupCardProps) {
  const summary = `${group.countLabel} · ${group.roleCountLabel}`;

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <ClubLogo logoUrl={group.logoUrl} />

        <View style={styles.headerText}>
          <AppText numberOfLines={2} variant="titleMd">
            {group.teamName}
          </AppText>
          <AppText color="secondary" variant="bodySm">
            {group.periodLabel}
          </AppText>
          <AppText color="muted" variant="meta">
            {summary}
          </AppText>
        </View>

        <Pressable
          accessibilityHint={`${group.teamName}, ${group.periodLabel}, ${summary}`}
          accessibilityLabel="Modifica esperienza"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,
            pressed ? styles.editButtonPressed : null,
          ]}
          testID={testID ? `${testID}-edit` : undefined}
        >
          <Ionicons color={colors.accent} name="pencil" size={16} />
        </Pressable>
      </View>

      {showSeasons ? (
        <View style={styles.seasons}>
          {group.rows.map((row) => (
            <View
              accessible
              accessibilityLabel={[row.label, row.role, row.category]
                .filter(Boolean)
                .join(", ")}
              key={row.assignmentId}
              style={styles.seasonRow}
            >
              <AppText style={styles.seasonLabel} variant="metaStrong">
                {row.label}
              </AppText>
              <AppText
                color="secondary"
                numberOfLines={1}
                style={styles.seasonRole}
                variant="bodySm"
              >
                {row.role || "Ruolo da indicare"}
              </AppText>
              <AppText
                color="muted"
                numberOfLines={1}
                style={styles.seasonCategory}
                variant="bodySm"
              >
                {row.category || "—"}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Logo assente: il placeholder del design system, mai un'immagine rotta. */
function ClubLogo({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return (
      <View style={styles.logo}>
        <Image source={{ uri: logoUrl }} style={styles.logoImage} />
      </View>
    );
  }

  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <Ionicons color={colors.accent} name="shield-outline" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[16],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  logo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 40,
    overflow: "hidden",
    width: 40,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  editButton: {
    alignItems: "center",
    borderRadius: radius.full,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  editButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  seasons: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[8],
  },
  seasonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 32,
  },
  seasonLabel: {
    minWidth: 62,
  },
  seasonRole: {
    flexShrink: 1,
    minWidth: 0,
    width: "38%",
  },
  seasonCategory: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
  },
});
