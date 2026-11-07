/**
 * Riga del centro (§9, screen 02-06).
 *
 * Titolo, sottotitolo «ambito · N profili», eventuale «Posizione chiusa» e
 * chevron. Niente altro: §9 — «Non mostrare POSITION, ID, priorità, stati
 * valutazione, note, conteggi separati per provenienza o data dell'ultima
 * attività», e §35 — «le righe lista sono testuali pulite, senza icone di
 * ruolo inventate».
 *
 * Una Position chiusa resta una riga normale: §10 — «Non usare opacity da
 * disabled, badge rosso, lucchetto o messaggi che impediscano la gestione.»
 *
 * L'intera riga è un solo nodo accessibile che annuncia titolo, ambito,
 * conteggio ed eventuale chiusura (§31); il chevron è decorativo e non
 * riceve un secondo focus.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { SHORTLIST_COPY, profilesLabel } from "../shortlist-presentation";

type Props = {
  /** §10: metadato neutro su riga propria, come nel master 03. */
  isClosed?: boolean;
  onPress: () => void;
  profilesCount: number;
  scopeLabel: string | null;
  showDivider?: boolean;
  testID?: string;
  title: string;
};

export function ShortlistRow({
  isClosed = false,
  onPress,
  profilesCount,
  scopeLabel,
  showDivider = false,
  testID,
  title,
}: Props) {
  const counts = profilesLabel(profilesCount);
  const meta = scopeLabel ? `${scopeLabel} · ${counts}` : counts;
  const announced = isClosed
    ? `${title}. ${meta}. ${SHORTLIST_COPY.positionClosed}`
    : `${title}. ${meta}`;

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        accessibilityLabel={announced}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {/* §31: «titoli riga 15-17 px». `titleSm` sta a 14.5 e cadeva sotto
            la soglia; `titleMd` è il primo gradino dentro la finestra e
            resta un token condiviso, non una misura inventata qui. */}
        <View style={styles.body}>
          <AppText color="neutral" numberOfLines={2} variant="titleMd">
            {title}
          </AppText>

          <AppText color="neutralMuted" numberOfLines={2} variant="meta">
            {meta}
          </AppText>

          {isClosed ? (
            <AppText color="neutralMuted" variant="meta">
              {SHORTLIST_COPY.positionClosed}
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
    /* §31: target interattivi di almeno 44 pt, e l'altezza cresce con il
       testo dinamico invece di troncarlo. */
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
