/**
 * Azioni sulla singola membership (DAS-REV-26 §15 — screen 05, 12).
 *
 * «Mantieni la destinazione scelta esplicita: titolo lista/Position,
 * Team/scope, persona, stato e priorità autorizzati.» Tre azioni al
 * massimo, ciascuna soltanto se consentita: nello screen 12 resta la sola
 * Vedi nella shortlist, «senza spazi di controlli nascosti, pulsanti
 * bloccati o CTA per richiedere permessi».
 *
 * Nessun «Rimuovi da tutte le liste» e nessun editor dentro lo sheet: la
 * modifica apre l'editor condiviso della 25.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import {
  PROFILE_SHORTLIST_COPY,
  membershipActions,
  membershipLines,
} from "../profile-shortlist-presentation";
import type { ProfileMembership, ProfileShortlistPerson } from "../profile-shortlist-types";

type Props = {
  membership: ProfileMembership;
  onEdit: () => void;
  onRemove: () => void;
  onSee: () => void;
  person: ProfileShortlistPerson;
};

function Action({
  destructive = false,
  label,
  onPress,
  testID,
}: {
  destructive?: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText color={destructive ? "danger" : "neutral"} style={styles.actionLabel} variant="bodyLg">
        {label}
      </AppText>
      {destructive ? null : (
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      )}
    </Pressable>
  );
}

export function ProfileShortlistActions({ membership, onEdit, onRemove, onSee, person }: Props) {
  const lines = membershipLines(membership);
  const actions = membershipActions(membership);

  return (
    <View>
      <View style={styles.person}>
        <Avatar name={person.fullName} size="md" uri={person.avatarUrl} />
        <View style={styles.personText}>
          <AppText color="neutral" variant="bodyLg">
            {person.fullName}
          </AppText>
          <AppText color="neutralMuted" variant="meta">
            {lines.evaluation}
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <Action
          label={PROFILE_SHORTLIST_COPY.seeInShortlist}
          onPress={onSee}
          testID="profile-shortlist-see"
        />
        {actions.canEdit ? (
          <Action
            label={PROFILE_SHORTLIST_COPY.editEvaluation}
            onPress={onEdit}
            testID="profile-shortlist-edit"
          />
        ) : null}
        {actions.canRemove ? (
          <Action
            destructive
            label={PROFILE_SHORTLIST_COPY.removeFromList}
            onPress={onRemove}
            testID="profile-shortlist-remove"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  personText: {
    flex: 1,
    gap: spacing[4],
  },
  actions: {
    paddingTop: spacing[4],
  },
  action: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[10],
  },
  actionLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
