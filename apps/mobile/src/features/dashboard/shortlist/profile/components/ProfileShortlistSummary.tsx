/**
 * Riepilogo «{Nome} è in shortlist» (DAS-REV-26 §14 — screen 03, 04, 08,
 * 10).
 *
 * «Usa lo stesso componente con una, due o più membership. Non aggiungere
 * gruppi vuoti decorativi.» Due gruppi, Per posizione e Liste
 * personalizzate, nella stessa superficie e senza tab (QA048).
 *
 * Ogni riga mostra destinazione, ambito, priorità se valorizzata e stato:
 * mai la nota, mai un conteggio globale, mai un badge di interesse (§14).
 * «+ Aggiungi ad altra lista» soltanto se l'actor può davvero aggiungere
 * altrove (§14, QA007).
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../../../ui";
import {
  PROFILE_SHORTLIST_COPY,
  groupMemberships,
  membershipAccessibilityLabel,
  membershipLines,
} from "../profile-shortlist-presentation";
import type { ProfileMembership } from "../profile-shortlist-types";
import { ShortlistFlowRow } from "./ShortlistFlowRow";

type Props = {
  canAddMore: boolean;
  error: boolean;
  items: ProfileMembership[] | null;
  onAddToOther: () => void;
  onOpen: (row: ProfileMembership) => void;
  onRetry: () => void;
};

function Group({
  items,
  onOpen,
  title,
}: {
  items: ProfileMembership[];
  onOpen: (row: ProfileMembership) => void;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.group}>
      <AppText color="neutral" style={styles.groupTitle} variant="titleSm">
        {title}
      </AppText>
      {items.map((row) => {
        const lines = membershipLines(row);

        return (
          <ShortlistFlowRow
            accessibilityLabel={membershipAccessibilityLabel(row)}
            key={row.entryId}
            lines={[lines.scope, lines.evaluation]}
            onPress={() => onOpen(row)}
            testID={`profile-shortlist-member-${row.entryId}`}
            title={lines.title}
          />
        );
      })}
    </View>
  );
}

export function ProfileShortlistSummary({
  canAddMore,
  error,
  items,
  onAddToOther,
  onOpen,
  onRetry,
}: Props) {
  /* §27: «Errore riepilogo … Conserva lo stato noto se ancora affidabile e
     autorizzato, senza inventare un riepilogo completo.» Con dati già noti
     l'errore di aggiornamento non li sostituisce. */
  if (!items && error) {
    return (
      <View style={styles.center}>
        <AppText align="center" color="neutral" variant="bodyLg">
          {PROFILE_SHORTLIST_COPY.summaryError}
        </AppText>
        <Button label={PROFILE_SHORTLIST_COPY.retry} onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  if (!items) {
    return (
      <View style={styles.skeleton}>
        <Skeleton.Row style={styles.skeletonTitle} />
        <Skeleton.Row />
        <Skeleton.Row style={styles.skeletonMeta} />
      </View>
    );
  }

  const groups = groupMemberships(items);

  return (
    <View>
      <Group items={groups.positions} onOpen={onOpen} title={PROFILE_SHORTLIST_COPY.positionsGroup} />
      <Group items={groups.custom} onOpen={onOpen} title={PROFILE_SHORTLIST_COPY.customGroup} />

      {canAddMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAddToOther}
          style={({ pressed }) => [styles.addRow, pressed ? styles.pressed : null]}
          testID="profile-shortlist-add-other"
        >
          <Ionicons color={colors.accent} name="add" size={18} />
          <AppText color="accent" variant="actionLabel">
            {PROFILE_SHORTLIST_COPY.addToOther}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[24],
  },
  group: {
    paddingBottom: spacing[12],
  },
  groupTitle: {
    paddingBottom: spacing[4],
    paddingTop: spacing[8],
  },
  addRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.6,
  },
  skeleton: {
    paddingVertical: spacing[12],
  },
  skeletonTitle: {
    width: "60%",
  },
  skeletonMeta: {
    height: 12,
    width: "40%",
  },
});
