import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  children: ReactNode;
  /** Barra di azione ancorata in fondo, fuori dallo scroll. */
  footer?: ReactNode;
  onBack: () => void;
  /** Identità del club sotto la barra, quando la pagina la mostra. */
  subheader?: ReactNode;
  testID?: string;
  title: string | null;
};

/**
 * Shell dei flussi focalizzati (§6).
 *
 * «Form, riepiloghi, dettagli focalizzati, esiti e conferme usano la shell
 * focalizzata con back e safe area, senza nuova bottom navigation.»
 *
 * Una sola implementazione per le quindici schermate che la usano: due
 * scaffold diversi divergerebbero in altezza della barra, safe area e
 * padding, ed è esattamente ciò che §54 misura confrontando le schermate.
 *
 * Il contenuto scorre, il footer no: §49 chiede che «la tastiera non copra
 * il campo Specifica il ruolo o la CTA», e una CTA dentro lo scroll finisce
 * sotto la tastiera proprio mentre si scrive.
 */
export function RoleLinkScaffold({
  children,
  footer,
  onBack,
  subheader,
  testID,
  title,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.navWrap}>
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
            testID="role-link-back"
          >
            <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
          </Pressable>

          {title ? (
            <AppText
              accessibilityRole="header"
              color="neutral"
              numberOfLines={2}
              style={styles.title}
              variant="titleMd"
            >
              {title}
            </AppText>
          ) : null}
        </View>

        {subheader}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + (footer ? 0 : insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: spacing[12] + insets.bottom }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
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
  title: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
});
