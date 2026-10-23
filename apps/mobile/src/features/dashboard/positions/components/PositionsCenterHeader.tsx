import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  onBack: () => void;
  title: string;
};

/**
 * Testata del Centro (§7, screen 01).
 *
 * «App bar compatta con back, logo Society, nome e verifica soltanto quando
 * reale. Sotto mostra il titolo Posizioni aperte.» Due righe, non tre: §7
 * vieta di «aggiungere contemporaneamente i titoli Dashboard, AC Como,
 * Centro Posizioni e Posizioni aperte», quindi la barra di navigazione **non**
 * ripete il titolo accanto al back.
 *
 * Il titolo usa `screenTitle` — Mulish 900, la sola famiglia che il design
 * system riserva a titoli di schermata, nomi hero e numeri. Non un
 * `fontFamily` grezzo.
 *
 * L'identità non è tappabile: §7 vieta un selector di Società aggiuntivo in
 * questa pagina.
 */
export function PositionsCenterHeader({
  isVerified,
  logoUrl,
  name,
  onBack,
  title,
}: Props) {
  return (
    <View>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.back,
            pressed ? styles.pressed : null,
          ]}
          testID="positions-center-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>

        <Avatar
          name={name}
          size="sm"
          square
          tone="ink"
          uri={logoUrl ?? undefined}
        />

        <AppText
          color="neutral"
          numberOfLines={1}
          style={styles.name}
          variant="titleSm"
        >
          {name}
        </AppText>

        {/* §7: il check compare solo per una verifica reale. */}
        {isVerified ? (
          <Ionicons
            accessibilityLabel="Società verificata"
            color={colors.accent}
            name="checkmark-circle"
            size={16}
          />
        ) : null}
      </View>

      <AppText
        accessibilityRole="header"
        color="neutral"
        style={styles.title}
        variant="screenTitle"
      >
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  name: {
    flexShrink: 1,
    fontWeight: "600",
  },
  title: {
    paddingBottom: spacing[12],
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
});
