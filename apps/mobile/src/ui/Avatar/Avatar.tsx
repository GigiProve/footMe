import { Image, StyleSheet, Text, View } from "react-native";

import { colors, radius, typography } from "../../styles";

type AvatarSize = "sm" | "md" | "lg" | "xl";

/**
 * Tono del fallback a iniziali. `ink` è il fondo scuro che il design usa per
 * le società (§1b, §1c); `accent` è l'azzurro tenue usato per le persone.
 */
type AvatarTone = "accent" | "ink" | "muted";

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 104,
};

/** Raggio della variante quadrata: cresce con la misura, non è mai una pill. */
const squareRadiusMap: Record<AvatarSize, number> = {
  sm: radius[8],
  md: radius[11],
  lg: radius[16],
  xl: radius[26],
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: typography.fontSize[12],
  md: typography.fontSize[15],
  lg: typography.fontSize[20],
  xl: typography.fontSize[28],
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

type AvatarProps = {
  uri?: string | null;
  /**
   * Iniziali già risolte, quando chi chiama le conosce ma **non** deve
   * conoscere il nome. Il dettaglio Squadra riceve dal backend solo
   * `initials` per l'anteprima dell'Organico: ricavarle qui richiederebbe
   * un nome che la RPC non restituisce di proposito.
   */
  initials?: string;
  name?: string;
  size?: AvatarSize;
  square?: boolean;
  tone?: AvatarTone;
};

export function Avatar({
  uri,
  initials: providedInitials,
  name,
  size = "md",
  square = false,
  tone = "accent",
}: AvatarProps) {
  const dimension = sizeMap[size];
  const borderRadius = square ? squareRadiusMap[size] : dimension / 2;

  const containerStyle = {
    width: dimension,
    height: dimension,
    borderRadius,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle]}
        accessibilityLabel={name ?? "Avatar"}
      />
    );
  }

  const initials = providedInitials ?? (name ? getInitials(name) : "");

  return (
    <View
      style={[styles.fallback, toneStyles[tone], containerStyle]}
      accessibilityLabel={name ?? "Avatar"}
    >
      {initials ? (
        <Text
          style={[
            styles.initials,
            toneTextStyles[tone],
            { fontSize: fontSizeMap[size] },
          ]}
        >
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfacePlaceholder,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    // Le iniziali sono un "numero" come le statistiche: stessa famiglia (§1a).
    fontFamily: typography.fontFamily.display,
  },
});

const toneStyles = StyleSheet.create({
  accent: { backgroundColor: colors.accentSoft },
  ink: { backgroundColor: colors.hero },
  muted: { backgroundColor: colors.divider },
});

const toneTextStyles = StyleSheet.create({
  accent: { color: colors.accent },
  ink: { color: colors.inkInvert },
  muted: { color: colors.textMuted },
});

export type { AvatarProps, AvatarSize, AvatarTone };
