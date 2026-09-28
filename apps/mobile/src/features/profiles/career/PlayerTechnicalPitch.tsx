/**
 * Profilo tecnico: campo read-only con i ruoli (REV-PROF-01 §27).
 *
 * Il disegno è lo stesso dell'onboarding — `PitchMarkings`, geometria FIFA —
 * nella variante chiara dello Screen Master. Il ruolo principale è in blu
 * PROLINK scuro, il secondario in blu più chiaro e più piccolo: la differenza
 * non è affidata al solo colore, perché passa anche dalla misura del marker e
 * dalle semantics.
 *
 * Il campo non è modificabile: si cambia ruolo solo da Modifica profilo.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  PITCH_ASPECT_RATIO,
  PITCH_LIGHT_SURFACE,
  PitchMarkings,
} from "../../onboarding/player/PitchMarkings";
import { PITCH_SLOTS } from "../../onboarding/player/player-pitch-positions";
import { colors, radius, spacing } from "../../../theme/tokens";
import { getPlayerPositionLabel, type PlayerPosition } from "../player-sports";

const PITCH_WIDTH = 116;
const PRIMARY_MARKER = 14;
const SECONDARY_MARKER = 11;
const MARKER_INSET = PRIMARY_MARKER / 2 + 6;

type PlayerTechnicalPitchProps = {
  primaryPosition: PlayerPosition | null;
  secondaryPosition: PlayerPosition | null;
};

export function PlayerTechnicalPitch({
  primaryPosition,
  secondaryPosition,
}: PlayerTechnicalPitchProps) {
  const [size, setSize] = useState({ height: 0, width: 0 });

  const usableWidth = Math.max(size.width - MARKER_INSET * 2, 0);
  const usableHeight = Math.max(size.height - MARKER_INSET * 2, 0);

  const markers = PITCH_SLOTS.filter(
    (slot) =>
      slot.position === primaryPosition || slot.position === secondaryPosition,
  );

  return (
    <View
      accessibilityLabel={buildPitchAccessibilityLabel(
        primaryPosition,
        secondaryPosition,
      )}
      accessibilityRole="image"
      accessible
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setSize({ height, width });
      }}
      style={styles.pitch}
      testID="player-technical-pitch"
    >
      <PitchMarkings tone="light" />

      {size.width > 0
        ? markers.map((slot) => {
            const isPrimary = slot.position === primaryPosition;
            const markerSize = isPrimary ? PRIMARY_MARKER : SECONDARY_MARKER;

            return (
              <View
                key={slot.position}
                style={[
                  styles.marker,
                  isPrimary ? styles.markerPrimary : styles.markerSecondary,
                  {
                    height: markerSize,
                    left: MARKER_INSET + slot.x * usableWidth - markerSize / 2,
                    top: MARKER_INSET + slot.y * usableHeight - markerSize / 2,
                    width: markerSize,
                  },
                ]}
              />
            );
          })
        : null}
    </View>
  );
}

function buildPitchAccessibilityLabel(
  primaryPosition: PlayerPosition | null,
  secondaryPosition: PlayerPosition | null,
): string {
  const parts = [
    primaryPosition
      ? `${getPlayerPositionLabel(primaryPosition)}, ruolo principale`
      : null,
    secondaryPosition
      ? `${getPlayerPositionLabel(secondaryPosition)}, ruolo secondario`
      : null,
  ].filter(Boolean);

  return parts.length > 0
    ? `Posizione in campo. ${parts.join(". ")}`
    : "Posizione in campo non indicata";
}

const styles = StyleSheet.create({
  marker: {
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 2,
    position: "absolute",
  },
  markerPrimary: {
    backgroundColor: colors.accentStrong,
  },
  markerSecondary: {
    backgroundColor: colors.accentOnInverse,
  },
  pitch: {
    aspectRatio: PITCH_ASPECT_RATIO,
    backgroundColor: PITCH_LIGHT_SURFACE,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing[16],
    overflow: "hidden",
    width: PITCH_WIDTH,
  },
});
