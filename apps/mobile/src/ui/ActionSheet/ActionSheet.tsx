/**
 * Foglio di azioni dal basso.
 *
 * HOM-04 §12, §15, §28–29, §109, §111–115: il menu ••• dei contenuti usa questo
 * foglio invece di averne uno suo. Le estensioni sono tutte opzionali, quindi
 * gli altri chiamanti restano identici:
 *  • `id` stabile per azione, usato come chiave React (le etichette possono
 *    cambiare con il tipo di contenuto, gli id no);
 *  • `dividerBefore`: filetto prima di un gruppo (l'azione distruttiva). Mai in
 *    testa alla lista: un divisore senza azione sopra non si disegna (§29);
 *  • `accessibilityLabel`: annunciato all'apertura, con le azioni a seguire (§111);
 *  • `showGrabber`: maniglia che chiude con un gesto verso il basso (§109);
 *  • area di tocco minima del design system e label che vanno a capo con i
 *    font grandi (§114–115);
 *  • un'azione distruttiva dichiara «Azione distruttiva» ai lettori di schermo
 *    (§112).
 *
 * Il fondale è un fratello del foglio e non il suo genitore: un Pressable
 * accessibile che contiene le righe le nasconde a VoiceOver.
 */

import { useEffect } from "react";
import {
  AccessibilityInfo,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

export type ActionSheetAction = {
  /** Identità stabile dell'azione (HOM-04 §133). Senza, la chiave è l'etichetta. */
  id?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  destructive?: boolean;
  /** Filetto sopra l'azione, solo se non è la prima della lista. */
  dividerBefore?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
};

type ActionSheetProps = {
  actions: ActionSheetAction[];
  /** Annunciato dai lettori di schermo all'apertura (HOM-04 §111). */
  accessibilityLabel?: string;
  cancelLabel?: string;
  message?: string;
  onClose: () => void;
  /** Maniglia in testa al foglio: trascinarla verso il basso lo chiude. */
  showGrabber?: boolean;
  title?: string;
  visible: boolean;
};

/** Spostamento verso il basso oltre il quale il gesto chiude il foglio. */
const DISMISS_DISTANCE = 56;
const DISMISS_VELOCITY = 0.8;

export const DESTRUCTIVE_ACTION_HINT = "Azione distruttiva";

function SheetGrabber({ onDismiss }: { onDismiss: () => void }) {
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
        onDismiss();
      }
    },
    onStartShouldSetPanResponder: () => true,
  });

  return (
    <View style={styles.grabberArea} testID="action-sheet-grabber" {...pan.panHandlers}>
      <View style={styles.grabber} />
    </View>
  );
}

export function ActionSheet({
  actions,
  accessibilityLabel,
  cancelLabel = "Annulla",
  message,
  onClose,
  showGrabber = false,
  title,
  visible,
}: ActionSheetProps) {
  useEffect(() => {
    if (visible && accessibilityLabel) {
      AccessibilityInfo.announceForAccessibility(accessibilityLabel);
    }
  }, [accessibilityLabel, visible]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.overlay}>
        <Pressable
          accessibilityLabel="Chiudi menu"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View accessibilityLabel={accessibilityLabel} style={styles.sheet}>
          {showGrabber ? <SheetGrabber onDismiss={onClose} /> : null}
          {title ? (
            <AppText align="center" style={styles.title} variant="titleMd">
              {title}
            </AppText>
          ) : null}
          {message ? (
            <AppText
              align="center"
              color="muted"
              style={styles.message}
              variant="bodySm"
            >
              {message}
            </AppText>
          ) : null}
          {actions.map((action, index) => (
            <View key={action.id ?? action.label}>
              {action.dividerBefore && index > 0 ? (
                <View style={styles.divider} testID="action-sheet-divider" />
              ) : null}
              <Pressable
                accessibilityHint={
                  action.accessibilityHint ??
                  (action.destructive ? DESTRUCTIVE_ACTION_HINT : undefined)
                }
                accessibilityLabel={action.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed ? styles.pressed : null,
                ]}
                testID={action.id ? `action-sheet-${action.id}` : undefined}
              >
                {action.icon ? (
                  <Ionicons
                    color={action.destructive ? colors.danger : colors.textPrimary}
                    name={action.icon}
                    size={20}
                  />
                ) : null}
                <View style={styles.rowText}>
                  <AppText
                    color={action.destructive ? "danger" : "primary"}
                    variant="bodyLg"
                  >
                    {action.label}
                  </AppText>
                  {action.subtitle ? (
                    <AppText color="muted" variant="caption">
                      {action.subtitle}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppText variant="titleSm">{cancelLabel}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8, 16, 37, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
    paddingBottom: spacing[32],
    gap: spacing[4],
  },
  grabberArea: {
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: -spacing[12],
    paddingVertical: spacing[8],
  },
  grabber: {
    backgroundColor: colors.border,
    borderRadius: radius[16],
    height: 4,
    width: 36,
  },
  title: {
    marginBottom: spacing[8],
  },
  message: {
    marginBottom: spacing[16],
    paddingHorizontal: spacing[16],
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[4],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[14],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  cancel: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[14],
  },
});
