/**
 * Riga persona dell'elenco "Persone collegate" (DAS-REV-20, screen 18).
 *
 * Avatar + nome + ruolo + data di collegamento + chevron: l'intera riga è il
 * target, non è un elenco di azioni. Nessuna azione inline qui — la rimozione
 * vive solo nel dettaglio della persona (screen 19/20), perché questo non è
 * un CRM.
 */
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, Avatar } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { formatConnectedDate, JOIN_LINKS_COPY } from "../join-links-presentation";
import type { JoinLinkPerson } from "../join-links-types";

type JoinLinkPersonRowProps = {
  /** Squadra del link: serve a dire se il contesto attuale è cambiato (§39). */
  linkTeamName?: string | null;
  onPress: () => void;
  person: JoinLinkPerson;
  showDivider: boolean;
};

export function JoinLinkPersonRow({
  linkTeamName,
  onPress,
  person,
  showDivider,
}: JoinLinkPersonRowProps) {
  const connectedOn = formatConnectedDate(person.connectedAt);
  /*
   * DAS-REV-21 §39: il contesto compare solo quando è **diverso** da quello
   * del link. Ripeterlo su ogni riga di una lista che è già filtrata per
   * squadra sarebbe rumore; ometterlo quando la persona si è spostata
   * sarebbe la bugia che §39 vieta.
   */
  const movedTo =
    person.contextLabel && person.contextLabel !== linkTeamName
      ? person.contextLabel
      : null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.container, showDivider ? styles.divider : null]}
      testID={`join-link-person-${person.assignmentId}`}
    >
      <Avatar name={person.personName} size="md" uri={person.avatarUrl} />

      <View style={styles.text}>
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {person.personName}
        </AppText>
        <AppText color="neutralMuted" numberOfLines={1} variant="bodySm">
          {movedTo ? `${person.roleLabel} · ${movedTo}` : person.roleLabel}
        </AppText>
        {connectedOn ? (
          <AppText color="neutralSoft" variant="meta">
            {`${JOIN_LINKS_COPY.connectedOnField} ${connectedOn}`}
          </AppText>
        ) : null}
      </View>

      <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  divider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: spacing[8],
  },
});
