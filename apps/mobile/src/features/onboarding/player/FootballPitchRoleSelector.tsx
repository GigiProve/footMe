import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, typography } from "../../../styles";
import { AppText } from "../../../ui";
import type { PlayerPosition } from "../../profiles/player-sports";
import { InlineError } from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import {
  PITCH_ASPECT_RATIO,
  PITCH_GRASS,
  PITCH_LIGHT_SURFACE,
  PitchMarkings,
  type PitchTone,
} from "./PitchMarkings";
import {
  PITCH_SLOTS,
  getPitchSlotAccessibilityLabel,
  getPitchSlotState,
  type PitchSlotState,
} from "./player-pitch-positions";

/** Pastiglia di un ruolo non scelto: inchiostro velato sull'erba. */
const PITCH_NODE_IDLE = "rgba(12,27,42,0.42)";
const PITCH_NODE_OUTLINE = "rgba(255,255,255,0.55)";
/*
  Sul campo chiaro l'inchiostro velato sparirebbe: il nodo inattivo diventa
  bianco con cornice e sigla scure, mantenendo lo stesso contrasto che ha
  sull'erba.
*/
const PITCH_LIGHT_NODE_IDLE = "#FFFFFF";
const PITCH_LIGHT_NODE_OUTLINE = "#C9D2DE";

const NODE_SIZE = 42;
const PITCH_MAX_WIDTH = 264;
/** Margine interno fra la linea laterale e il centro di un nodo. */
const NODE_INSET = NODE_SIZE / 2 + 4;

type FootballPitchRoleSelectorProps = {
  primaryPosition: PlayerPosition | "";
  secondaryPosition: PlayerPosition | "";
  onSelectPrimary: (position: PlayerPosition) => void;
  errorMessage?: string;
  /**
   * `grass` è il campo dell'onboarding. `light` è la resa su fondo bianco
   * usata dall'editor profilo: stesso disegno e stessi marker, non un secondo
   * campo.
   */
  tone?: PitchTone;
  testID?: string;
};

/**
 * Campo da calcio verticale interattivo per la scelta del ruolo (§L–§R).
 *
 * Il tap su un nodo imposta sempre il **ruolo principale**: il secondario si
 * sceglie dal selector sotto al campo e qui viene solo mostrato, con una
 * tonalità di blu più chiara e un badge numerico — così lo stato non è
 * affidato al solo colore (§BW).
 */
export function FootballPitchRoleSelector({
  errorMessage,
  onSelectPrimary,
  primaryPosition,
  secondaryPosition,
  testID,
  tone = "grass",
}: FootballPitchRoleSelectorProps) {
  const [pitchSize, setPitchSize] = useState({ height: 0, width: 0 });

  const usableWidth = Math.max(pitchSize.width - NODE_INSET * 2, 0);
  const usableHeight = Math.max(pitchSize.height - NODE_INSET * 2, 0);

  return (
    <View style={styles.container} testID={testID}>
      <View
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;
          setPitchSize({ height, width });
        }}
        style={[
          styles.pitch,
          tone === "light" ? styles.pitchLight : null,
        ]}
        testID={testID ? `${testID}-surface` : undefined}
      >
        <PitchMarkings tone={tone} />

        {pitchSize.width > 0
          ? PITCH_SLOTS.map((slot) => {
              const state = getPitchSlotState(
                slot.position,
                primaryPosition,
                secondaryPosition,
              );

              return (
                <PitchNode
                  abbreviation={slot.abbreviation}
                  key={slot.position}
                  left={NODE_INSET + slot.x * usableWidth}
                  onPress={() => onSelectPrimary(slot.position)}
                  position={slot.position}
                  state={state}
                  testID={`pitch-role-${slot.position}`}
                  tone={tone}
                  top={NODE_INSET + slot.y * usableHeight}
                />
              );
            })
          : null}
      </View>

      {errorMessage ? <InlineError message={errorMessage} /> : null}
    </View>
  );
}

function PitchNode({
  abbreviation,
  left,
  onPress,
  position,
  state,
  testID,
  tone,
  top,
}: {
  abbreviation: string;
  left: number;
  onPress: () => void;
  position: PlayerPosition;
  state: PitchSlotState;
  testID: string;
  tone: PitchTone;
  top: number;
}) {
  const isPrimary = state === "primary";
  const isSecondary = state === "secondary";

  return (
    <Pressable
      accessibilityLabel={getPitchSlotAccessibilityLabel(position, state)}
      accessibilityRole="radio"
      accessibilityState={{ checked: isPrimary, selected: isPrimary || isSecondary }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.node,
        {
          left: left - NODE_SIZE / 2,
          top: top - NODE_SIZE / 2,
        },
        tone === "light" && !isPrimary && !isSecondary
          ? styles.nodeIdleLight
          : null,
        isPrimary ? styles.nodePrimary : null,
        isSecondary ? styles.nodeSecondary : null,
        pressed ? styles.nodePressed : null,
      ]}
      testID={testID}
    >
      {/*
        Il secondario è un blu più chiaro (§P): su quel fondo la sigla passa a
        inchiostro scuro, così resta leggibile e i due stati si distinguono
        anche senza percepire il colore (§BW).
      */}
      <AppText
        color={
          isSecondary || (tone === "light" && !isPrimary) ? "primary" : "inverse"
        }
        variant="chipLabel"
      >
        {abbreviation}
      </AppText>

      {isPrimary || isSecondary ? (
        <View style={styles.rankBadge}>
          <AppText color="accent" variant="numeric" style={styles.rankBadgeText}>
            {isPrimary ? "1" : "2"}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.s,
  },
  pitch: {
    alignSelf: "center",
    aspectRatio: PITCH_ASPECT_RATIO,
    backgroundColor: PITCH_GRASS,
    borderRadius: onboardingRadius.card,
    maxWidth: PITCH_MAX_WIDTH,
    overflow: "hidden",
    width: "80%",
  },
  node: {
    alignItems: "center",
    backgroundColor: PITCH_NODE_IDLE,
    borderColor: PITCH_NODE_OUTLINE,
    borderRadius: onboardingRadius.pill,
    borderWidth: onboardingBorderWidth.selected,
    height: NODE_SIZE,
    justifyContent: "center",
    position: "absolute",
    width: NODE_SIZE,
  },
  pitchLight: {
    backgroundColor: PITCH_LIGHT_SURFACE,
    borderColor: "#E3E8EF",
    borderWidth: 1,
  },
  nodeIdleLight: {
    backgroundColor: PITCH_LIGHT_NODE_IDLE,
    borderColor: PITCH_LIGHT_NODE_OUTLINE,
  },
  nodePrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.inkInvert,
    borderWidth: 2.5,
  },
  nodeSecondary: {
    backgroundColor: colors.accentOnInverse,
    borderColor: colors.inkInvert,
    borderWidth: 2.5,
  },
  nodePressed: {
    opacity: 0.75,
  },
  rankBadge: {
    alignItems: "center",
    backgroundColor: colors.inkInvert,
    borderRadius: onboardingRadius.pill,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: -3,
    top: -3,
    width: 16,
  },
  rankBadgeText: {
    fontSize: typography.fontSize[11],
    lineHeight: typography.lineHeight[14],
  },
});
