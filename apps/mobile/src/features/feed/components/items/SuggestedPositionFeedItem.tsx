/**
 * Contenitore base "Posizione per te" (§9), nella forma del modulo standard
 * (§1a del design "ProLink UI Upgrade").
 *
 * Mostra: eyebrow "Per te" con nota "In base al tuo profilo", logo società,
 * ruolo cercato, squadra, località e l'azione "Apri posizione" nel rail. Il tap
 * sull'intero componente o sull'azione apre il dettaglio posizione esistente.
 *
 * Porta la barra blu di personalizzazione: è contenuto scelto per l'utente, il
 * solo caso in cui quel segno è ammesso.
 *
 * NON mostra, per esplicito divieto del §9: candidatura diretta, requisiti
 * completi, descrizioni lunghe, scadenza, percentuali di compatibilità. Il tipo
 * `FeedPositionPayload` non porta nemmeno quei campi, quindi non c'è modo di
 * mostrarli per distrazione.
 */

import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Badge, ContentModule } from "../../../../ui";
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
    <ContentModule
      actions={[{ label: FEED_POSITION_CTA, onPress }]}
      eyebrow={FEED_POSITION_OVERLINE}
      eyebrowNote={FEED_POSITION_HELPER}
      onPress={onPress}
      personalized
      testID="feed-suggested-position"
    >
      <View style={styles.row}>
        <Avatar
          name={payload.clubName ?? ""}
          size="md"
          square
          tone="ink"
          uri={payload.clubLogoUrl ?? undefined}
        />
        <View style={styles.body}>
          <AppText numberOfLines={1} variant="titleMd">
            {positionHeadline(payload, null)}
          </AppText>
          {team ? (
            <AppText color="secondary" numberOfLines={1} variant="meta">
              {team}
            </AppText>
          ) : null}
        </View>
      </View>

      {location ? (
        <View style={styles.chips}>
          <Badge label={location} />
        </View>
      ) : null}
    </ContentModule>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    marginTop: spacing[10],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
