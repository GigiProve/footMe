import { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../theme/tokens";
import { AppText } from "../AppText/AppText";

export type BottomSheetProps = {
  children: ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
  /**
   * Il contenuto scorre se supera il 90% dello schermo (font grandi su schermi
   * piccoli, HOM-09 §235, §335). Assente = foglio ad altezza del contenuto, come prima.
   */
  scrollable?: boolean;
  /** Maniglia in cima al foglio (HOM-09 §12). Assente = foglio senza maniglia, come prima. */
  showHandle?: boolean;
  title?: string;
  visible: boolean;
};

export function BottomSheet({
  children,
  onClose,
  onDismiss,
  scrollable = false,
  showHandle = false,
  title,
  visible,
}: BottomSheetProps) {
  // Il Modal resta montato anche quando non visibile (come ActionSheet):
  // smontarlo impedirebbe la consegna di onDismiss su iOS, su cui si
  // appoggiano gli handoff sheet -> modal full-screen.
  return (
    <Modal
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi"
        onPress={onClose}
        style={styles.overlay}
      >
        <Pressable style={[styles.sheet, scrollable ? styles.sheetScrollable : null]}>
          {showHandle ? <View style={styles.handle} testID="bottom-sheet-handle" /> : null}
          {title ? (
            <View style={styles.header}>
              <AppText
                numberOfLines={1}
                style={styles.title}
                variant="titleMd"
              >
                {title}
              </AppText>
              <Pressable
                accessibilityLabel="Chiudi"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons color={colors.textPrimary} name="close" size={22} />
              </Pressable>
            </View>
          ) : null}
          {scrollable ? (
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              style={styles.scroll}
              testID="bottom-sheet-scroll"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.body}>{children}</View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 16, 37, 0.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
    paddingBottom: spacing[32],
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: radius.full,
    height: sizes.sheetHandleHeight,
    marginBottom: spacing[16],
    marginTop: -spacing[8],
    width: sizes.sheetHandleWidth,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  title: {
    flex: 1,
  },
  closeButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  pressed: {
    opacity: 0.6,
  },
  body: {
    gap: spacing[4],
  },
  // Il percentuale si risolve sull'overlay (altezza piena): oltre il tetto il
  // contenuto scorre invece di uscire dallo schermo.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollable: {
    maxHeight: sizes.sheetMaxHeight,
  },
});
