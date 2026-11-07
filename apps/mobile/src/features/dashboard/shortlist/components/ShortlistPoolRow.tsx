/**
 * Riga del pool misto (DAS-REV-25 §12, screen 02, 04, 13).
 *
 * «avatar, nome e cognome; tipo/ruolo professionale e contesto corrente
 * essenziale; stato di valutazione; priorità soltanto se non nulla;
 * informazione autorizzata sull'origine o sulla candidatura; eventuale
 * anteprima della nota in una sola riga; chevron decorativo, con intera riga
 * tappabile.»
 *
 * E l'elenco di ciò che **non** entra qui, che è altrettanto vincolante:
 * «Non portare nella riga carriera completa, statistiche, altezza/piede,
 * testo integrale della nota, added_by/data o una serie di pulsanti
 * edit/remove/messaggio.»
 *
 * Le due origini convivono in un elenco solo: §12 — «Non creare tab
 * Candidati/Scouting, Da candidatura/Dal profilo o tab per stato.»
 *
 * Tutto ciò che si può sbagliare in un `if` dentro il render — quale
 * dicitura di origine è lecita, quando la priorità si omette — sta in
 * `poolRowLines`, dove i test lo raggiungono.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import { formatRole } from "../../../profiles/profile-display-helpers";
import { getPlayerPositionLabel } from "../../../profiles/player-sports";
import { poolRowLines } from "../shortlist-presentation";
import type { ShortlistPoolRow as Row } from "../shortlist-types";

type Props = {
  focused?: boolean;
  onPress: () => void;
  row: Row;
  showDivider?: boolean;
};

/**
 * «Calciatore · Centrocampista» (§12).
 *
 * Senza posizione resta la sola tipologia, e senza nemmeno quella la riga
 * non mostra un segnaposto: §12 — «I dati non disponibili non vengono
 * sostituiti con valori demo o stringhe null.»
 */
export function identityLine(row: {
  primaryPosition: string | null;
  role: string | null;
}): string {
  return [
    row.role ? formatRole(row.role) : null,
    row.primaryPosition ? getPlayerPositionLabel(row.primaryPosition, "") : null,
  ]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");
}

export function ShortlistPoolRowView({
  focused = false,
  onPress,
  row,
  showDivider = false,
}: Props) {
  const identity = identityLine(row);
  const lines = poolRowLines(row);

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        /* §31: «La riga di persona è un solo target coerente, con chevron
           decorativo.» Una sola etichetta annunciata, nell'ordine in cui si
           legge. */
        accessibilityLabel={[
          row.name,
          identity,
          row.situation,
          lines.evaluation,
          lines.origin,
          lines.note,
        ]
          .filter((part): part is string => !!part && part.length > 0)
          .join(". ")}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          /* §24: «Un'evidenziazione transitoria neutra e il focus
             accessibile possono indicare la persona raggiunta.» Neutra: non
             un colore che dica «selezionato». */
          focused ? styles.focused : null,
          pressed ? styles.pressed : null,
        ]}
        testID={`shortlist-pool-${row.personId}`}
      >
        <Avatar name={row.name} size="md" uri={row.avatarUrl ?? undefined} />

        <View style={styles.body}>
          <AppText color="neutral" numberOfLines={1} variant="titleMd">
            {row.name}
          </AppText>

          {identity ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {identity}
            </AppText>
          ) : null}

          {row.situation ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {row.situation}
            </AppText>
          ) : null}

          {/* §4: «priorità, valutazioni … testo neutro, senza colori che
              suggeriscano un giudizio automatico.» */}
          <AppText color="neutral" numberOfLines={1} variant="meta">
            {lines.evaluation}
          </AppText>

          {lines.origin ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {lines.origin}
            </AppText>
          ) : null}

          {/* §12: «La sola anteprima della nota nella lista può essere
              troncata a una riga.» Il troncamento vero lo fa il server; qui
              c'è solo il vincolo di layout. */}
          {lines.note ? (
            <AppText color="neutralMuted" numberOfLines={1} variant="meta">
              {lines.note}
            </AppText>
          ) : null}
        </View>

        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: 2,
  },
  focused: {
    backgroundColor: colors.surfaceNeutral,
  },
  pressed: {
    opacity: 0.6,
  },
});
