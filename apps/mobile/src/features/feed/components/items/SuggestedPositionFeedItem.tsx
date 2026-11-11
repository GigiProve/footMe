/**
 * Posizione suggerita nel Feed (HOM-01.1 §14–§16, §76).
 *
 * Molto più leggera di HOM-01: un kicker testuale "Per te · In base al tuo
 * profilo" e sotto un solo contenitore a bordo leggero e radius moderato
 * (§62), con logo Società, ruolo (il dato principale), Team · Società,
 * categoria · località e la CTA testuale "Apri posizione →" — mai un bottone
 * pieno (§15). L'intero blocco apre la posizione.
 *
 * Il kicker basta a dire perché il blocco è lì: la barra blu laterale di
 * HOM-01 non compare nel visual master e il §61 chiede che la tipologia
 * emerga da testo e struttura, non da un segno colorato.
 *
 * NON mostra scadenza, Candidati, requisiti, descrizione, score o
 * compatibilità (§16): `FeedPositionPayload` non porta nemmeno quei campi.
 * Righe e formato sono quelli dell'anteprima di Cerca (CER-04, §74). La
 * distanza non è nel payload del Feed, quindi non si mostra (§14: "se
 * disponibile").
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import {
  FEED_POSITION_CTA,
  FEED_POSITION_HELPER,
  FEED_POSITION_OVERLINE,
  positionHeadline,
  positionLocationLine,
  positionTeamLine,
} from "../../feed-labels";
import type { FeedPositionItem } from "../../feed-types";
import { FeedItemFrame } from "./FeedItemFrame";

type SuggestedPositionFeedItemProps = {
  item: FeedPositionItem;
  onPress: () => void;
};

export function SuggestedPositionFeedItem({
  item,
  onPress,
}: SuggestedPositionFeedItemProps) {
  const { payload } = item;
  const role = positionHeadline(payload, null);
  const team = positionTeamLine(payload);
  const location = positionLocationLine(payload);

  return (
    <FeedItemFrame testID="feed-suggested-position">
      <AppText color="muted" style={styles.kicker} variant="feedMeta">
        <AppText color="secondary" style={styles.kickerLead} variant="feedMeta">
          {FEED_POSITION_OVERLINE}
        </AppText>
        {` · ${FEED_POSITION_HELPER}`}
      </AppText>

      <Pressable
        accessibilityHint={FEED_POSITION_CTA}
        accessibilityLabel={[role, team, location].filter(Boolean).join(", ")}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.box, pressed ? styles.pressed : null]}
      >
        <View style={styles.row}>
          <Avatar
            name={payload.clubName ?? ""}
            size="md"
            square
            uri={payload.clubLogoUrl ?? undefined}
          />
          <View style={styles.body}>
            <AppText numberOfLines={2} variant="titleMd">
              {role}
            </AppText>
            {team ? (
              <AppText color="secondary" numberOfLines={1} variant="feedMeta">
                {team}
              </AppText>
            ) : null}
            {location ? (
              <AppText color="muted" numberOfLines={1} variant="feedMeta">
                {location}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.cta}>
          <AppText color="accent" variant="feedMeta">
            {FEED_POSITION_CTA}
          </AppText>
          <Ionicons color={colors.accent} name="arrow-forward" size={14} />
        </View>
      </Pressable>
    </FeedItemFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[14],
  },
  cta: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: spacing[4],
  },
  kicker: {
    marginBottom: spacing[10],
  },
  kickerLead: {
    fontWeight: typography.fontWeight.semibold,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
});
