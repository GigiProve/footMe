/**
 * Anteprima del campo e slot dei moduli tattici del Tifoso.
 *
 * Unico renderer del dominio Formazione lato profilo: la card compatta della
 * Tribuna, il dettaglio contenuto e il composer disegnano lo stesso campo e
 * leggono gli stessi slot. Nessun secondo modello tattico.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";
import type {
  FanTribunaFormation,
  FanTribunaLineupPlayer,
} from "../fan-tribuna-service";

export type FormationSlot = {
  key: string;
  label: string;
  order: number;
  shortLabel: string;
  x: number;
  y: number;
};

export const FORMATION_SLOTS: Record<FanTribunaFormation, FormationSlot[]> = {
  "3-5-2": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "center_back_left", label: "Braccetto sinistro", order: 1, shortLabel: "DC", x: 28, y: 70 },
    { key: "center_back", label: "Difensore centrale", order: 2, shortLabel: "DC", x: 50, y: 72 },
    { key: "center_back_right", label: "Braccetto destro", order: 3, shortLabel: "DC", x: 72, y: 70 },
    { key: "left_wingback", label: "Esterno sinistro", order: 4, shortLabel: "ES", x: 15, y: 48 },
    { key: "midfield_left", label: "Mezzala sinistra", order: 5, shortLabel: "CC", x: 36, y: 50 },
    { key: "midfield_center", label: "Regista", order: 6, shortLabel: "CC", x: 50, y: 56 },
    { key: "midfield_right", label: "Mezzala destra", order: 7, shortLabel: "CC", x: 64, y: 50 },
    { key: "right_wingback", label: "Esterno destro", order: 8, shortLabel: "ED", x: 85, y: 48 },
    { key: "striker_left", label: "Punta sinistra", order: 9, shortLabel: "ATT", x: 40, y: 22 },
    { key: "striker_right", label: "Punta destra", order: 10, shortLabel: "ATT", x: 60, y: 22 },
  ],
  "4-2-3-1": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "pivot_left", label: "Mediano sinistro", order: 5, shortLabel: "MED", x: 40, y: 54 },
    { key: "pivot_right", label: "Mediano destro", order: 6, shortLabel: "MED", x: 60, y: 54 },
    { key: "left_winger", label: "Esterno sinistro", order: 7, shortLabel: "AS", x: 22, y: 34 },
    { key: "attacking_midfielder", label: "Trequartista", order: 8, shortLabel: "TRQ", x: 50, y: 36 },
    { key: "right_winger", label: "Esterno destro", order: 9, shortLabel: "AD", x: 78, y: 34 },
    { key: "striker", label: "Attaccante", order: 10, shortLabel: "ATT", x: 50, y: 18 },
  ],
  "4-3-3": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "midfield_left", label: "Mezzala sinistra", order: 5, shortLabel: "CC", x: 34, y: 50 },
    { key: "midfield_center", label: "Regista", order: 6, shortLabel: "CC", x: 50, y: 56 },
    { key: "midfield_right", label: "Mezzala destra", order: 7, shortLabel: "CC", x: 66, y: 50 },
    { key: "left_winger", label: "Ala sinistra", order: 8, shortLabel: "AS", x: 24, y: 24 },
    { key: "striker", label: "Attaccante", order: 9, shortLabel: "ATT", x: 50, y: 18 },
    { key: "right_winger", label: "Ala destra", order: 10, shortLabel: "AD", x: 76, y: 24 },
  ],
  "4-4-2": [
    { key: "goalkeeper", label: "Portiere", order: 0, shortLabel: "POR", x: 50, y: 88 },
    { key: "left_back", label: "Terzino sinistro", order: 1, shortLabel: "TS", x: 18, y: 68 },
    { key: "center_back_left", label: "Centrale sinistro", order: 2, shortLabel: "DC", x: 40, y: 72 },
    { key: "center_back_right", label: "Centrale destro", order: 3, shortLabel: "DC", x: 60, y: 72 },
    { key: "right_back", label: "Terzino destro", order: 4, shortLabel: "TD", x: 82, y: 68 },
    { key: "left_midfielder", label: "Esterno sinistro", order: 5, shortLabel: "ES", x: 20, y: 46 },
    { key: "midfield_left", label: "Centrale sinistro", order: 6, shortLabel: "CC", x: 42, y: 50 },
    { key: "midfield_right", label: "Centrale destro", order: 7, shortLabel: "CC", x: 58, y: 50 },
    { key: "right_midfielder", label: "Esterno destro", order: 8, shortLabel: "ED", x: 80, y: 46 },
    { key: "striker_left", label: "Punta sinistra", order: 9, shortLabel: "ATT", x: 40, y: 22 },
    { key: "striker_right", label: "Punta destra", order: 10, shortLabel: "ATT", x: 60, y: 22 },
  ],
};

export function getFormationSlots(formation: FanTribunaFormation) {
  return FORMATION_SLOTS[formation] ?? FORMATION_SLOTS["4-3-3"];
}

export function FootballPitchPreview({
  formation,
  players,
}: {
  formation: FanTribunaFormation;
  players: FanTribunaLineupPlayer[];
}) {
  const slots = getFormationSlots(formation);
  const playerBySlot = new Map(players.map((player) => [player.slot_key, player]));

  return (
    <View style={styles.pitch} testID="fan-formation-pitch">
      <View style={styles.pitchHalfLine} />
      <View style={styles.pitchCenterCircle} />
      <View style={styles.pitchBoxTop} />
      <View style={styles.pitchBoxBottom} />
      {slots.map((slot) => {
        const player = playerBySlot.get(slot.key);

        return (
          <View
            key={slot.key}
            style={[
              styles.pitchMarkerWrap,
              {
                left: `${slot.x}%`,
                top: `${slot.y}%`,
              },
            ]}
            testID={`fan-formation-slot-${slot.key}`}
          >
            {player ? (
              <View style={styles.pitchMarker}>
                <Avatar name={player.display_name} size="sm" uri={player.avatar_url} />
                <AppText
                  align="center"
                  color="inverse"
                  numberOfLines={1}
                  style={styles.pitchMarkerName}
                  variant="caption"
                >
                  {player.display_name}
                </AppText>
              </View>
            ) : (
              <View style={styles.pitchPlaceholder}>
                <AppText color="inverse" style={styles.pitchPlaceholderText} variant="caption">
                  {slot.shortLabel}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pitch: {
    aspectRatio: 0.72,
    backgroundColor: colors.pitchSurface,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: radius[8],
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  pitchBoxBottom: {
    alignSelf: "center",
    borderColor: "rgba(255,255,255,0.32)",
    borderTopWidth: 1,
    bottom: 0,
    height: "17%",
    position: "absolute",
    width: "52%",
  },
  pitchBoxTop: {
    alignSelf: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    height: "17%",
    position: "absolute",
    top: 0,
    width: "52%",
  },
  pitchCenterCircle: {
    alignSelf: "center",
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    marginTop: -42,
    position: "absolute",
    top: "50%",
    width: 84,
  },
  pitchHalfLine: {
    backgroundColor: "rgba(255,255,255,0.32)",
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: "50%",
  },
  pitchMarker: {
    alignItems: "center",
    gap: spacing[4],
    width: 70,
  },
  pitchMarkerName: {
    fontSize: typography.fontSize[10],
    fontWeight: typography.fontWeight.bold,
    lineHeight: 12,
    textShadowColor: "rgba(0,0,0,0.42)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
  },
  pitchMarkerWrap: {
    alignItems: "center",
    marginLeft: -35,
    marginTop: -22,
    position: "absolute",
    width: 70,
  },
  pitchPlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: radius.full,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pitchPlaceholderText: {
    fontSize: typography.fontSize[9],
    fontWeight: typography.fontWeight.bold,
    lineHeight: 11,
  },
});
