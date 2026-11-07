/**
 * Riga del Centro Candidature (§12, §13 — screen 01, 02, 04, 12, 13).
 *
 * «Ogni riga comprende: avatar; nome e cognome; profilo/ruolo e situazione
 * corrente attendibile; ruolo ricercato e squadra/ambito della candidatura;
 * stato operativo utile e tempo relativo; chevron verso il dettaglio.»
 *
 * Tre righe di testo e nient'altro: §12 vieta «età, peso, altezza, piede,
 * statistiche, tutta la carriera, pulsanti Messaggio/Shortlist o contatti
 * direttamente nella row».
 *
 * Un solo target tappabile. §12 — «L'avatar non deve innescare una diversa
 * navigazione accidentale rispetto alla riga; l'apertura intenzionale del
 * profilo completo avviene nel dettaglio»: l'avatar è quindi dentro il
 * `Pressable` della riga e non ne ha uno proprio, e il chevron è decorativo.
 *
 * Lo stato non è comunicato dal solo colore (§13, §31): il pallino blu
 * accompagna la parola «Nuova», e l'etichetta annunciata dal lettore di
 * schermo contiene la stessa informazione.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import {
  APPLICATIONS_COPY,
  formatSubmittedAgo,
  personLine,
  positionLine,
  rowAccessibilityLabel,
  rowStatusLabel,
} from "../applications-presentation";
import type { ApplicationRow } from "../applications-types";

type Props = {
  /** §23: nell'elenco di una Position il contesto è già nel titolo. */
  hidePositionLine?: boolean;
  now?: Date;
  onPress: () => void;
  row: ApplicationRow;
  showDivider: boolean;
};

export function ApplicationListRow({
  hidePositionLine = false,
  now,
  onPress,
  row,
  showDivider,
}: Props) {
  const status = rowStatusLabel(row);
  const ago = formatSubmittedAgo(row.latestSubmittedAt, now);
  const isNew = status === APPLICATIONS_COPY.newBadge;
  const person = personLine(row);
  const position = positionLine(row);

  return (
    <Pressable
      accessibilityLabel={rowAccessibilityLabel(row, now)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.divided : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`application-row-${row.id}`}
    >
      <Avatar
        name={row.personName}
        size="md"
        uri={row.personAvatarUrl ?? undefined}
      />

      <View style={styles.body}>
        <View style={styles.topLine}>
          {/*
            Il nome non si rimpicciolisce per far posto allo stato: §12 —
            «Se il nome è lungo, consenti espansione; non ridurre il font o
            sacrificare ruolo e destinazione.» Va a capo, e la riga cresce.
          */}
          <AppText
            color="neutral"
            numberOfLines={2}
            style={styles.name}
            variant="titleSm"
          >
            {row.personName}
          </AppText>

          <View style={styles.meta}>
            {status ? (
              <View style={styles.statusWrap}>
                {isNew ? <View style={styles.newDot} /> : null}
                <AppText
                  color={isNew ? "accent" : "neutralMuted"}
                  variant="meta"
                >
                  {status}
                </AppText>
              </View>
            ) : null}

            {ago ? (
              <AppText color="neutralMuted" variant="meta">
                {status ? `· ${ago}` : ago}
              </AppText>
            ) : null}
          </View>
        </View>

        {person ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="bodySm">
            {person}
          </AppText>
        ) : null}

        {!hidePositionLine && position ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="bodySm">
            {position}
          </AppText>
        ) : null}
      </View>

      <Ionicons
        color={colors.textNeutralSoft}
        name="chevron-forward"
        size={18}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  topLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
  },
  name: {
    flexShrink: 1,
  },
  meta: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing[4],
  },
  statusWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  newDot: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  pressed: {
    opacity: 0.6,
  },
});
