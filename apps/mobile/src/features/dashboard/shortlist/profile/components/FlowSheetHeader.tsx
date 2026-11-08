/**
 * Testata delle viste del pannello Shortlist dal profilo (DAS-REV-26 §15,
 * §22).
 *
 * Un solo componente per selector, riepilogo, azioni e recupero: §22 —
 * «Back dalla subview azioni torna al riepilogo; … X/chiusura del flow
 * torna al profilo.» Il back compare soltanto nelle viste annidate; la X
 * c'è sempre e chiude l'intero flusso.
 *
 * Il contesto sotto il titolo (persona · Società, oppure la sola Società)
 * è compatto, come §11 chiede per il selector: «Mostra la persona e la
 * Society correnti in modo compatto».
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type Props = {
  contextLine?: string | null;
  logoUrl?: string | null;
  onBack?: () => void;
  onClose: () => void;
  subtitle?: string | null;
  title: string;
};

export function FlowSheetHeader({
  contextLine,
  logoUrl,
  onBack,
  onClose,
  subtitle,
  title,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.icon, pressed ? styles.pressed : null]}
            testID="profile-shortlist-back"
          >
            <Ionicons color={colors.textNeutral} name="chevron-back" size={22} />
          </Pressable>
        ) : null}

        <View style={styles.titles}>
          {/* Il recupero (screen 16) porta il proprio titolo nel corpo. */}
          {title ? (
            <AppText
              accessibilityRole="header"
              color="neutral"
              numberOfLines={2}
              variant="titleMd"
            >
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText color="neutralMuted" numberOfLines={2} variant="bodySm">
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel="Chiudi"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.icon, pressed ? styles.pressed : null]}
          testID="profile-shortlist-close"
        >
          <Ionicons color={colors.textNeutral} name="close" size={22} />
        </Pressable>
      </View>

      {contextLine ? (
        <View style={styles.context}>
          {logoUrl ? (
            <Image accessibilityIgnoresInvertColors source={{ uri: logoUrl }} style={styles.logo} />
          ) : (
            <Ionicons color={colors.textNeutralMuted} name="shield-outline" size={16} />
          )}
          <AppText color="neutralMuted" numberOfLines={1} style={styles.contextText} variant="meta">
            {contextLine}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[8],
    paddingBottom: spacing[12],
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
  titles: {
    flex: 1,
    gap: spacing[4],
    paddingTop: spacing[10],
  },
  icon: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.6,
  },
  context: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  contextText: {
    flex: 1,
  },
  logo: {
    borderRadius: 4,
    height: 18,
    width: 18,
  },
});
