/**
 * Card di un gruppo di incarichi (REV-PROF-15, schermate 1 e 6).
 *
 * Una sola card per due usi: nell'hub riassume l'organizzazione — periodo,
 * ruolo più recente, numero di incarichi — e nel riepilogo apre la timeline
 * degli incarichi. Non sono due componenti perché non sono due oggetti.
 *
 * L'attività indipendente non ha un logo da mostrare: al suo posto c'è l'icona
 * professionale del design system, non lo stemma di un'agenzia che non esiste.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Badge } from "../../../ui";
import type { AgentExperienceGroup } from "./agent-assignment-model";

type AgentExperienceGroupCardProps = {
  group: AgentExperienceGroup;
  onEdit: () => void;
  /** Timeline degli incarichi: è la differenza fra hub e riepilogo. */
  showTimeline?: boolean;
  testID?: string;
};

export function AgentExperienceGroupCard({
  group,
  onEdit,
  showTimeline = false,
  testID,
}: AgentExperienceGroupCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <OrganizationLogo
          isIndependent={group.organizationMode === "independent"}
          logoUrl={group.logoUrl}
          name={group.organizationName}
        />

        <View style={styles.headerText}>
          <AppText numberOfLines={2} variant="titleMd">
            {group.organizationName}
          </AppText>
          {group.periodLabel ? (
            <AppText color="secondary" variant="bodySm">
              {group.periodLabel}
            </AppText>
          ) : null}
          {/* Nell'hub il ruolo sta qui; nel riepilogo lo porta ogni riga. */}
          {!showTimeline && group.primaryRoleLabel ? (
            <AppText color="secondary" variant="bodySm">
              {group.primaryRoleLabel}
            </AppText>
          ) : null}
          <AppText color="muted" variant="meta">
            {group.countLabel}
          </AppText>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityHint={`${group.organizationName}, ${group.periodLabel}, ${group.countLabel}`}
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
          {/*
            "Attuale" marca il gruppo che contiene l'esperienza principale: è
            la stessa che l'header del profilo mostra, quindi i due non possono
            raccontare due storie diverse.
          */}
          {showTimeline && group.hasPrimary ? (
            <Badge label="Attuale" size="sm" variant="accent" />
          ) : null}
        </View>
      </View>

      {showTimeline ? (
        <View style={styles.timeline}>
          {group.rows.map((row, index) => (
            <View
              accessible
              accessibilityLabel={[row.periodLabel, row.role]
                .filter(Boolean)
                .join(", ")}
              key={row.assignmentId}
              style={styles.timelineRow}
            >
              {/*
                La riga resta leggibile anche senza la resa grafica: pallino e
                asta sono decorativi, il significato sta nel testo.
              */}
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < group.rows.length - 1 ? (
                  <View style={styles.timelineLine} />
                ) : null}
              </View>

              <View style={styles.timelineBody}>
                <AppText variant="metaStrong">{row.periodLabel}</AppText>
                <AppText color="secondary" numberOfLines={2} variant="bodySm">
                  {row.role || "Ruolo da indicare"}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Logo dell'organizzazione, iniziali quando manca, icona professionale per
 * l'attività indipendente. Mai un'immagine rotta, mai uno stemma inventato.
 */
function OrganizationLogo({
  isIndependent,
  logoUrl,
  name,
}: {
  isIndependent: boolean;
  logoUrl: string;
  name: string;
}) {
  if (isIndependent) {
    return (
      <View style={[styles.logo, styles.logoFallback]}>
        <Ionicons color={colors.accent} name="briefcase-outline" size={18} />
      </View>
    );
  }

  if (logoUrl) {
    return (
      <View style={styles.logo}>
        {/* Il nome è già scritto accanto: l'immagine è decorativa. */}
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no"
          source={{ uri: logoUrl }}
          style={styles.logoImage}
        />
      </View>
    );
  }

  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <AppText color="accent" variant="metaStrong">
        {buildInitials(name)}
      </AppText>
    </View>
  );
}

function buildInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "—";
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
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  headerActions: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: spacing[4],
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
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  editButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  timeline: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[12],
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
  },
  timelineRail: {
    alignItems: "center",
    paddingTop: spacing[4],
    width: 12,
  },
  timelineDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  timelineLine: {
    backgroundColor: colors.accent,
    flex: 1,
    marginTop: spacing[4],
    width: 2,
  },
  timelineBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
    paddingBottom: spacing[12],
  },
});
