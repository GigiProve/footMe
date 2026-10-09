/**
 * Tab Posizioni del Master Profile Società (REV-PROF-17 §"TAB 2").
 *
 * È una vetrina, non un secondo dominio Annunci: la card porta al dettaglio
 * posizione già sviluppato e l'owner trova qui solo un collegamento compatto
 * alla gestione, che vive nella Dashboard.
 *
 * Nessun badge verde "Aperta": una posizione che compare qui è pubblicata,
 * attiva e non scaduta — lo stato lo ha già applicato il backend, ripeterlo
 * con un badge decorativo non aggiunge informazione.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import { ProfileFilterChips } from "../../profiles/master/ProfileFilterChips";
import { ProfileSectionError } from "../../profiles/master/ProfileSectionBlock";
import { formatPosition } from "../../profiles/profile-display-helpers";
import {
  POSITION_FILTERS,
  filterPositions,
  formatOpportunitiesCount,
  formatPublishedAgo,
  type PositionFilter,
} from "./society-profile-model";
import type { SocietyPosition, SocietyViewer } from "./society-profile-types";

type SocietyPositionsTabProps = {
  activeFilter: PositionFilter;
  hasError?: boolean;
  onFilterChange: (filter: PositionFilter) => void;
  onManagePositions: () => void;
  onOpenPosition: (positionId: string) => void;
  onRetry?: () => void;
  positions: readonly SocietyPosition[];
  viewer: SocietyViewer;
};

export function SocietyPositionsTab({
  activeFilter,
  hasError = false,
  onFilterChange,
  onManagePositions,
  onOpenPosition,
  onRetry,
  positions,
  viewer,
}: SocietyPositionsTabProps) {
  const visiblePositions = filterPositions(positions, activeFilter);

  return (
    <View style={styles.container} testID="society-positions-tab">
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="titleMd">
          Posizioni aperte
        </AppText>
        <AppText color="muted" testID="society-positions-count" variant="meta">
          {formatOpportunitiesCount(visiblePositions.length)}
        </AppText>
      </View>

      <ProfileFilterChips
        accessibilityLabel="Filtro posizioni"
        onChange={onFilterChange}
        options={POSITION_FILTERS}
        testID="society-positions-filter"
        value={activeFilter}
      />

      {/*
        L'owner vede la stessa lista pubblica: l'accesso alla gestione è un
        collegamento, non un pannello che si apre qui dentro.
      */}
      {viewer.canManagePositions ? (
        <Button
          label="Gestisci posizioni"
          onPress={onManagePositions}
          size="sm"
          testID="society-manage-positions"
          variant="secondary"
        />
      ) : null}

      {hasError ? (
        <ProfileSectionError
          message="Non è stato possibile caricare le posizioni. Riprova."
          onRetry={onRetry}
          testID="society-positions-error"
        />
      ) : visiblePositions.length > 0 ? (
        <View style={styles.list}>
          {visiblePositions.map((position) => (
            <PositionCard
              key={position.id}
              onPress={() => onOpenPosition(position.id)}
              position={position}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          description="Al momento il club non ha opportunità pubblicate."
          icon="briefcase-outline"
          title="Nessuna posizione aperta"
        />
      )}
    </View>
  );
}

function PositionCard({
  onPress,
  position,
}: {
  onPress: () => void;
  position: SocietyPosition;
}) {
  const metaLines = [
    position.teamName,
    position.category,
    /*
      Il ruolo ricercato è il dato per cui si apre un annuncio: era già
      mappato dal servizio ma non arrivava mai a schermo, quindi la card
      diceva dove e in che categoria, non chi si cerca.
    */
    position.roleRequired ? formatPosition(position.roleRequired) : null,
    [position.city, position.region].filter(Boolean).join(", ") || null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  const publishedLabel = formatPublishedAgo(position.publishedAt);

  return (
    <Pressable
      accessibilityLabel={`${position.title}. Vedi posizione`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      testID={`society-position-card-${position.id}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIcon}>
          <Ionicons color={colors.accent} name="person-add-outline" size={20} />
        </View>
        <View style={styles.cardText}>
          <AppText numberOfLines={2} variant="titleSm">
            {position.title}
          </AppText>
          {metaLines.map((line) => (
            <AppText color="muted" key={line} numberOfLines={1} variant="meta">
              {line}
            </AppText>
          ))}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <AppText color="muted" variant="meta">
          {publishedLabel ?? ""}
        </AppText>
        <View style={styles.cardCta}>
          <AppText color="accent" variant="metaStrong">
            Vedi posizione
          </AppText>
          <Ionicons color={colors.accent} name="chevron-forward" size={16} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    padding: spacing[16],
  },
  cardCta: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  cardFooter: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingTop: spacing[10],
  },
  cardIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  cardTop: {
    flexDirection: "row",
    gap: spacing[12],
  },
  container: {
    backgroundColor: colors.surface,
    gap: spacing[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  header: {
    gap: spacing[4],
  },
  list: {
    gap: spacing[12],
  },
});
