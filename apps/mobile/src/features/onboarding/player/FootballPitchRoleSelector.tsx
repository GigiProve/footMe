import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";

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
  PITCH_SLOTS,
  getPitchSlotAccessibilityLabel,
  getPitchSlotState,
  type PitchSlotState,
} from "./player-pitch-positions";

/**
 * Colori del manto erboso. Non sono token del Design System: descrivono un
 * oggetto reale — il campo — e vivono solo qui (§M). Tutto il resto della
 * schermata usa la palette ProLink.
 */
const PITCH_GRASS = "#2F7D4F";
const PITCH_GRASS_BAND = "#2A7248";
const PITCH_LINE = "rgba(255,255,255,0.55)";
/** Pastiglia di un ruolo non scelto: inchiostro velato sull'erba. */
const PITCH_NODE_IDLE = "rgba(12,27,42,0.42)";
const PITCH_NODE_OUTLINE = "rgba(255,255,255,0.55)";

/** Metà campo FIFA in metri: il rettangolo resta proporzionato (§M). */
const PITCH_VIEWBOX_WIDTH = 68;
const PITCH_VIEWBOX_HEIGHT = 105;
const PITCH_ASPECT_RATIO = PITCH_VIEWBOX_WIDTH / PITCH_VIEWBOX_HEIGHT;

const NODE_SIZE = 42;
const PITCH_MAX_WIDTH = 264;
/** Margine interno fra la linea laterale e il centro di un nodo. */
const NODE_INSET = NODE_SIZE / 2 + 4;

type FootballPitchRoleSelectorProps = {
  primaryPosition: PlayerPosition | "";
  secondaryPosition: PlayerPosition | "";
  onSelectPrimary: (position: PlayerPosition) => void;
  errorMessage?: string;
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
        style={styles.pitch}
        testID={testID ? `${testID}-surface` : undefined}
      >
        <PitchMarkings />

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

/** Linee del campo: laterali, fondo, metà campo, cerchio, aree, porte (§M). */
function PitchMarkings() {
  return (
    <Svg
      height="100%"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${PITCH_VIEWBOX_WIDTH} ${PITCH_VIEWBOX_HEIGHT}`}
      width="100%"
    >
      {/* Fasce di taglio dell'erba: due toni, nessun gradiente. */}
      {[0, 2, 4, 6, 8].map((band) => (
        <Rect
          fill={PITCH_GRASS_BAND}
          height={PITCH_VIEWBOX_HEIGHT / 10}
          key={band}
          width={PITCH_VIEWBOX_WIDTH}
          x={0}
          y={(band * PITCH_VIEWBOX_HEIGHT) / 10}
        />
      ))}

      {/* Perimetro: linee laterali e linee di fondo. */}
      <Rect
        fill="none"
        height={PITCH_VIEWBOX_HEIGHT - 4}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        width={PITCH_VIEWBOX_WIDTH - 4}
        x={2}
        y={2}
      />

      {/* Metà campo e cerchio di centrocampo. */}
      <Line
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        x1={2}
        x2={PITCH_VIEWBOX_WIDTH - 2}
        y1={PITCH_VIEWBOX_HEIGHT / 2}
        y2={PITCH_VIEWBOX_HEIGHT / 2}
      />
      <Circle
        cx={PITCH_VIEWBOX_WIDTH / 2}
        cy={PITCH_VIEWBOX_HEIGHT / 2}
        fill="none"
        r={9.15}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
      />
      <Circle
        cx={PITCH_VIEWBOX_WIDTH / 2}
        cy={PITCH_VIEWBOX_HEIGHT / 2}
        fill={PITCH_LINE}
        r={0.7}
      />

      {/* Aree di rigore e aree piccole, in alto e in basso. */}
      <Rect
        fill="none"
        height={16.5}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        width={40.3}
        x={13.85}
        y={2}
      />
      <Rect
        fill="none"
        height={5.5}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        width={18.3}
        x={24.85}
        y={2}
      />
      <Rect
        fill="none"
        height={16.5}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        width={40.3}
        x={13.85}
        y={PITCH_VIEWBOX_HEIGHT - 18.5}
      />
      <Rect
        fill="none"
        height={5.5}
        stroke={PITCH_LINE}
        strokeWidth={0.7}
        width={18.3}
        x={24.85}
        y={PITCH_VIEWBOX_HEIGHT - 7.5}
      />

      {/* Dischetti del rigore. */}
      <Circle cx={PITCH_VIEWBOX_WIDTH / 2} cy={13} fill={PITCH_LINE} r={0.7} />
      <Circle
        cx={PITCH_VIEWBOX_WIDTH / 2}
        cy={PITCH_VIEWBOX_HEIGHT - 13}
        fill={PITCH_LINE}
        r={0.7}
      />

      {/* Porte, appoggiate alla linea di fondo. */}
      <Rect
        fill="rgba(255,255,255,0.28)"
        height={2}
        stroke={PITCH_LINE}
        strokeWidth={0.5}
        width={12}
        x={PITCH_VIEWBOX_WIDTH / 2 - 6}
        y={0.2}
      />
      <Rect
        fill="rgba(255,255,255,0.28)"
        height={2}
        stroke={PITCH_LINE}
        strokeWidth={0.5}
        width={12}
        x={PITCH_VIEWBOX_WIDTH / 2 - 6}
        y={PITCH_VIEWBOX_HEIGHT - 2.2}
      />
    </Svg>
  );
}

function PitchNode({
  abbreviation,
  left,
  onPress,
  position,
  state,
  testID,
  top,
}: {
  abbreviation: string;
  left: number;
  onPress: () => void;
  position: PlayerPosition;
  state: PitchSlotState;
  testID: string;
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
        color={isSecondary ? "primary" : "inverse"}
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
