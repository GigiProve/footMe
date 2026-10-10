import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import {
  teamDetailClassification,
  teamHeaderAccessibilityLabel,
  teamParentLine,
  teamPlaceSeasonLine,
} from "../team-detail-presentation";
import type { TeamDetailPayload } from "../team-detail-service";

/**
 * Header del dettaglio (§8).
 *
 * Stemma a sinistra, informazioni a destra, **una volta sola**: §8 vieta
 * esplicitamente di ripetere Tipo, Livello, città e stagione in un blocco
 * "Informazioni squadra" a fondo pagina.
 *
 * Tre cose che è facile sbagliare e che qui sono vincolate:
 *
 *   1. il check di verifica sta accanto alla **Società**, non al nome della
 *      squadra: la verifica appartiene alla parent e non si eredita;
 *   2. nessun metadato è tappabile — niente chevron su città, campionato o
 *      stagione: si modificano dal form di DAS-REV-08;
 *   3. lo stemma è quello già risolto dal backend (override o ereditato); un
 *      errore di caricamento dell'immagine non cambia l'ereditarietà, e
 *      `Avatar` ricade sulle iniziali senza che nulla venga salvato.
 *
 * L'intero blocco è un solo elemento per lo screen reader: quattro righe
 * separate produrrebbero quattro annunci dove la task ne chiede uno
 * contestuale (§29).
 */
export function TeamDetailHeader({ team }: { team: TeamDetailPayload }) {
  const classification = teamDetailClassification(team);
  const parent = teamParentLine(team.clubName);
  const placeSeason = teamPlaceSeasonLine(team);

  return (
    <View
      accessibilityLabel={teamHeaderAccessibilityLabel(team)}
      accessibilityRole="header"
      style={styles.root}
      testID="team-detail-header"
    >
      <Avatar
        name={team.name}
        size="md"
        square
        tone="ink"
        uri={team.crestUrl ?? undefined}
      />

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.body}>
        {/*
          Mulish 900: il design riserva questo peso a numeri, statistiche,
          titoli di schermata e **nomi in hero**. Il nome della squadra in
          testa alla pagina appartiene a quest ultima categoria, ed è la
          ragione per cui nel mockup stacca dai titoli dei moduli.
        */}
        <AppText numberOfLines={2} variant="heroName">
          {team.name}
        </AppText>

        {classification ? (
          <AppText color="secondary" numberOfLines={2} variant="meta">
            {classification}
          </AppText>
        ) : null}

        {parent ? (
          <View style={styles.parentRow}>
            <AppText color="secondary" numberOfLines={2} style={styles.parent} variant="meta">
              {parent}
            </AppText>

            {team.clubIsVerified ? (
              <Ionicons
                color={colors.accent}
                name="checkmark-circle"
                size={15}
                style={styles.verified}
              />
            ) : null}
          </View>
        ) : null}

        {placeSeason ? (
          <AppText color="muted" numberOfLines={1} variant="meta">
            {placeSeason}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  // Il check segue il nome della Società e va a capo con esso invece di
  // restare ancorato al bordo destro, dove sembrerebbe riferito alla riga.
  parentRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4],
  },
  parent: {
    flexShrink: 1,
  },
  verified: {
    marginTop: 1,
  },
});
