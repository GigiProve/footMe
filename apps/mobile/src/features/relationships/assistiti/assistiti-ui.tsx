/**
 * Componenti condivisi della gestione assistiti (REV-PROF-14).
 *
 * Stanno qui e non dentro le route perché le stesse card, gli stessi chip e lo
 * stesso selettore di rapporto compaiono in cinque schermate diverse: una sola
 * definizione è anche l'unico modo perché restino identiche.
 */
import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText, Avatar, Badge, Button } from "../../../ui";
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import {
  type AssistitiCounts,
  type AssistitiFilter,
  type AssistitoRow,
  type RelationshipType,
  type RepresentationVisibility,
  ASSISTITI_FILTERS,
  RELATIONSHIP_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  getInviteStatusLabel,
  getRelationshipShortLabel,
} from "./assistiti-model";

/** Pulsante "indietro" dell'app bar: 44×44, identico in tutte le schermate. */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Indietro"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
    </Pressable>
  );
}

/**
 * I tre conteggi in testa all'hub. I valori arrivano dal backend: la lista a
 * schermo è filtrata e paginabile, quindi contarla darebbe numeri diversi.
 */
export function PortfolioCounts({
  counts,
  isLoading,
}: {
  counts: AssistitiCounts;
  isLoading?: boolean;
}) {
  const cells: { label: string; value: number }[] = [
    { label: "Attivi", value: counts.active_count },
    { label: "In attesa", value: counts.pending_count },
    { label: "Privati", value: counts.private_count },
  ];

  return (
    <View style={styles.countsRow} testID="assistiti-counts">
      {cells.map((cell) => (
        <View key={cell.label} style={styles.countCell}>
          {isLoading ? (
            <View style={styles.countSkeleton} />
          ) : (
            <AppText variant="statValue">{String(cell.value)}</AppText>
          )}
          <AppText color="muted" variant="caption">
            {cell.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Chip di filtro dell'hub. Sono filtri, non tab: restano pillole. */
export function AssistitiFilterChips({
  onChange,
  value,
}: {
  onChange: (next: AssistitiFilter) => void;
  value: AssistitiFilter;
}) {
  return (
    <View style={styles.chipRow}>
      {ASSISTITI_FILTERS.map((filter) => (
        <Button
          accessibilityLabel={`Filtro ${filter.label}`}
          key={filter.value}
          label={filter.label}
          onPress={() => onChange(filter.value)}
          selected={value === filter.value}
          testID={`assistiti-filter-${filter.value}`}
          variant="chipAction"
        />
      ))}
    </View>
  );
}

function buildMetaLine(row: AssistitoRow): string {
  return [
    row.primary_position ? getPlayerPositionLabel(row.primary_position) : null,
    row.team_label,
  ]
    .filter(Boolean)
    .join(" · ");
}

type StateBadge = {
  icon: "globe-outline" | "lock-closed-outline" | "time-outline" | "mail-outline";
  label: string;
};

/**
 * Lo stato non è mai comunicato solo dal colore o solo da un'icona: ogni badge
 * porta anche il proprio testo.
 */
export function describeRowState(row: AssistitoRow): StateBadge {
  if (row.kind === "manual") {
    return { icon: "mail-outline", label: getInviteStatusLabel(row.invite_status) };
  }

  if (row.status === "pending") {
    return { icon: "time-outline", label: "In attesa" };
  }

  if (row.visibility === "public") {
    return { icon: "globe-outline", label: "Pubblico" };
  }

  return { icon: "lock-closed-outline", label: "Privato" };
}

/**
 * Card dell'assistito. Nessuna icona cestino: l'eliminazione vive nel
 * dettaglio, dietro una conferma, non a un pollice di distanza dallo scroll.
 */
export function AssistitoCard({
  onPress,
  row,
}: {
  onPress: () => void;
  row: AssistitoRow;
}) {
  const name = row.full_name ?? "Assistito";
  const meta = buildMetaLine(row);
  const relation = getRelationshipShortLabel(row.relationship_type);
  const state = describeRowState(row);

  return (
    <Pressable
      accessibilityHint="Apri la gestione del rapporto"
      accessibilityLabel={`${name}${meta ? `, ${meta}` : ""}, ${relation}, ${state.label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID={`assistito-card-${row.id}`}
    >
      <Avatar name={name} size="md" uri={row.avatar_url ?? undefined} />
      <View style={styles.cardBody}>
        <AppText numberOfLines={1} variant="titleSm">
          {name}
        </AppText>
        {meta ? (
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            {meta}
          </AppText>
        ) : null}
        <View style={styles.cardTags}>
          <Badge label={relation} size="sm" />
          <View style={styles.stateTag}>
            <Ionicons color={colors.textMuted} name={state.icon} size={12} />
            <AppText color="muted" numberOfLines={1} variant="caption">
              {state.label}
            </AppText>
          </View>
        </View>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

/** Scelta del tipo di rapporto: radio con descrizione, come nel mockup. */
export function RelationshipTypeChoice({
  onChange,
  value,
}: {
  onChange: (next: RelationshipType) => void;
  value: RelationshipType | null;
}) {
  return (
    <View style={styles.optionList}>
      {RELATIONSHIP_TYPE_OPTIONS.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityLabel={`${option.label}. ${option.description}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
            testID={`relationship-type-${option.value}`}
          >
            <View style={[styles.radio, selected ? styles.radioSelected : null]} />
            <View style={styles.optionText}>
              <AppText variant="titleSm">{option.label}</AppText>
              <AppText color="secondary" variant="bodySm">
                {option.description}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Visibilità: due pillole affiancate, con il lucchetto su "Privato". */
export function VisibilityChoice({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (next: RepresentationVisibility) => void;
  value: RepresentationVisibility | null;
}) {
  return (
    <View style={styles.visibilityRow}>
      {VISIBILITY_OPTIONS.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityLabel={`${option.label}. ${option.description}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.visibilityCard,
              selected ? styles.optionCardSelected : null,
              disabled ? styles.disabled : null,
            ]}
            testID={`visibility-${option.value}`}
          >
            <View style={[styles.radio, selected ? styles.radioSelected : null]} />
            <AppText numberOfLines={1} variant="titleSm">
              {option.label}
            </AppText>
            {option.value === "private" ? (
              <Ionicons
                color={colors.textMuted}
                name="lock-closed-outline"
                size={14}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Riquadro informativo con icona (i): usato per le regole, non per gli errori. */
export function InfoCallout({
  children,
  testID,
  tone = "neutral",
}: {
  children: ReactNode;
  testID?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <View
      style={[styles.callout, tone === "accent" ? styles.calloutAccent : null]}
      testID={testID}
    >
      <Ionicons
        color={tone === "accent" ? colors.accent : colors.textMuted}
        name="information-circle-outline"
        size={18}
      />
      <View style={styles.calloutBody}>{children}</View>
    </View>
  );
}

/** Scheletri: stessa forma della card, così il salto al caricato è minimo. */
export function AssistitiSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonList} testID="assistiti-skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

/** Errore locale di sezione: la struttura della pagina resta in piedi. */
export function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.sectionError}>
      <AppText color="secondary" variant="bodySm">
        {message}
      </AppText>
      <Button label="Riprova" onPress={onRetry} size="sm" variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[12],
  },
  calloutAccent: {
    backgroundColor: colors.accentSoft,
  },
  calloutBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 72,
    padding: spacing[12],
  },
  cardBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  cardTags: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  countCell: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flex: 1,
    gap: spacing[4],
    paddingVertical: spacing[12],
  },
  countSkeleton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 24,
    width: 32,
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  disabled: {
    opacity: 0.6,
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  optionCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    padding: spacing[12],
  },
  optionCardSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionList: {
    gap: spacing[8],
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  radio: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    width: 22,
  },
  radioSelected: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  sectionError: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
  skeletonCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    height: 72,
  },
  skeletonList: {
    gap: spacing[8],
  },
  stateTag: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  visibilityCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 48,
    paddingHorizontal: spacing[12],
  },
  visibilityRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
});
