/**
 * Contenitore base "Posizione per te" (§9).
 *
 * Mostra: intestazione "Per te" con helper "In base al tuo profilo", logo
 * società, ruolo cercato, squadra, categoria, località e la CTA "Apri
 * posizione". Il tap sull'intero componente o sulla CTA apre il dettaglio
 * posizione già esistente.
 *
 * NON mostra, per esplicito divieto del §9: candidatura diretta, requisiti
 * completi, descrizioni lunghe, scadenza, percentuali di compatibilità. Il tipo
 * `FeedPositionPayload` non porta nemmeno quei campi, quindi non c'è modo di
 * mostrarli per distrazione.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import {
  FEED_POSITION_CTA,
  FEED_POSITION_HELPER,
  FEED_POSITION_OVERLINE,
  positionHeadline,
  positionLocationLine,
  positionTeamLine,
} from "../../feed-labels";
import type { FeedPositionItem } from "../../feed-types";

type SuggestedPositionFeedItemProps = {
  item: FeedPositionItem;
  onPress: () => void;
};

export function SuggestedPositionFeedItem({
  item,
  onPress,
}: SuggestedPositionFeedItemProps) {
  const { payload } = item;
  const team = positionTeamLine(payload);
  const location = positionLocationLine(payload);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="feed-suggested-position"
    >
      <View style={styles.heading}>
        <AppText color="muted" variant="overline">
          {FEED_POSITION_OVERLINE}
        </AppText>
        <AppText color="muted" variant="caption">
          {FEED_POSITION_HELPER}
        </AppText>
      </View>

      <View style={styles.row}>
        <Avatar
          name={payload.clubName ?? ""}
          size="md"
          square
          uri={payload.clubLogoUrl ?? undefined}
        />
        <View style={styles.body}>
          <AppText numberOfLines={1} variant="titleSm">
            {positionHeadline(payload, null)}
          </AppText>
          {team ? (
            <AppText color="secondary" numberOfLines={1} variant="bodySm">
              {team}
            </AppText>
          ) : null}
          {location ? (
            <AppText color="muted" numberOfLines={1} variant="bodySm">
              {location}
            </AppText>
          ) : null}
        </View>
      </View>

      <Button
        fullWidth
        label={FEED_POSITION_CTA}
        onPress={onPress}
        size="sm"
        variant="secondary"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[10],
    padding: spacing[14],
  },
  heading: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing[8],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
