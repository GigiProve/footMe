/**
 * Geometria del campo da calcio verticale (REV-ONB-02 §M, REV-PROF-01 §27).
 *
 * Unica fonte del disegno: il selettore del ruolo in onboarding e il campo
 * read-only del Master Profile usano queste stesse linee, così non possono
 * divergere. Le misure sono quelle FIFA in metri, quindi il rettangolo resta
 * proporzionato a qualsiasi larghezza.
 *
 * `tone="grass"` è il campo verde dell'onboarding; `tone="light"` è la versione
 * chiara del Profilo tecnico, su fondo bianco con linee grigie.
 */
import { StyleSheet } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";

/**
 * Colori del manto erboso. Non sono token del Design System: descrivono un
 * oggetto reale — il campo — e vivono solo qui.
 */
export const PITCH_GRASS = "#2F7D4F";
const PITCH_GRASS_BAND = "#2A7248";
const PITCH_GRASS_LINE = "rgba(255,255,255,0.55)";
/** Versione chiara: superficie bianca, linee grigie sottili. */
export const PITCH_LIGHT_SURFACE = "#FFFFFF";
const PITCH_LIGHT_LINE = "#C9D2DE";

export const PITCH_VIEWBOX_WIDTH = 68;
export const PITCH_VIEWBOX_HEIGHT = 105;
export const PITCH_ASPECT_RATIO = PITCH_VIEWBOX_WIDTH / PITCH_VIEWBOX_HEIGHT;

export type PitchTone = "grass" | "light";

type PitchMarkingsProps = {
  tone?: PitchTone;
};

export function PitchMarkings({ tone = "grass" }: PitchMarkingsProps) {
  const isGrass = tone === "grass";
  const line = isGrass ? PITCH_GRASS_LINE : PITCH_LIGHT_LINE;
  const strokeWidth = isGrass ? 0.7 : 0.6;

  return (
    <Svg
      height="100%"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${PITCH_VIEWBOX_WIDTH} ${PITCH_VIEWBOX_HEIGHT}`}
      width="100%"
    >
      {/* Fasce di taglio dell'erba: due toni, nessun gradiente. */}
      {isGrass
        ? [0, 2, 4, 6, 8].map((band) => (
            <Rect
              fill={PITCH_GRASS_BAND}
              height={PITCH_VIEWBOX_HEIGHT / 10}
              key={band}
              width={PITCH_VIEWBOX_WIDTH}
              x={0}
              y={(band * PITCH_VIEWBOX_HEIGHT) / 10}
            />
          ))
        : null}

      {/* Perimetro: linee laterali e linee di fondo. */}
      <Rect
        fill="none"
        height={PITCH_VIEWBOX_HEIGHT - 4}
        stroke={line}
        strokeWidth={strokeWidth}
        width={PITCH_VIEWBOX_WIDTH - 4}
        x={2}
        y={2}
      />

      {/* Metà campo e cerchio di centrocampo. */}
      <Line
        stroke={line}
        strokeWidth={strokeWidth}
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
        stroke={line}
        strokeWidth={strokeWidth}
      />
      <Circle
        cx={PITCH_VIEWBOX_WIDTH / 2}
        cy={PITCH_VIEWBOX_HEIGHT / 2}
        fill={line}
        r={0.7}
      />

      {/* Aree di rigore e aree di porta, in alto e in basso. */}
      <Rect
        fill="none"
        height={16.5}
        stroke={line}
        strokeWidth={strokeWidth}
        width={40.3}
        x={13.85}
        y={2}
      />
      <Rect
        fill="none"
        height={5.5}
        stroke={line}
        strokeWidth={strokeWidth}
        width={18.3}
        x={24.85}
        y={2}
      />
      <Rect
        fill="none"
        height={16.5}
        stroke={line}
        strokeWidth={strokeWidth}
        width={40.3}
        x={13.85}
        y={PITCH_VIEWBOX_HEIGHT - 18.5}
      />
      <Rect
        fill="none"
        height={5.5}
        stroke={line}
        strokeWidth={strokeWidth}
        width={18.3}
        x={24.85}
        y={PITCH_VIEWBOX_HEIGHT - 7.5}
      />

      {/* Dischetti del rigore. */}
      <Circle cx={PITCH_VIEWBOX_WIDTH / 2} cy={13} fill={line} r={0.7} />
      <Circle
        cx={PITCH_VIEWBOX_WIDTH / 2}
        cy={PITCH_VIEWBOX_HEIGHT - 13}
        fill={line}
        r={0.7}
      />

      {/* Porte, appoggiate alla linea di fondo. */}
      <Rect
        fill={isGrass ? "rgba(255,255,255,0.28)" : "none"}
        height={2}
        stroke={line}
        strokeWidth={strokeWidth * 0.7}
        width={12}
        x={PITCH_VIEWBOX_WIDTH / 2 - 6}
        y={0.2}
      />
      <Rect
        fill={isGrass ? "rgba(255,255,255,0.28)" : "none"}
        height={2}
        stroke={line}
        strokeWidth={strokeWidth * 0.7}
        width={12}
        x={PITCH_VIEWBOX_WIDTH / 2 - 6}
        y={PITCH_VIEWBOX_HEIGHT - 2.2}
      />
    </Svg>
  );
}
