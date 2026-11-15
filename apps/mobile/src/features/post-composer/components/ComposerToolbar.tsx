/**
 * Toolbar del composer: solo «Foto/video» e «Tagga» (HOM-06.1 §35–37, §154,
 * §196, mockup screen 1–7).
 *
 * Nessuna azione extra (§36). In Modifica `showMedia` è false (§154): resta
 * solo «Tagga». Un'unica azione per i media, senza separare foto e video (§41).
 *
 * Posizione: pensata per stare sticky sopra la tastiera (§37). Il chiamante la
 * mette in fondo alla schermata dentro `KeyboardAvoidingView` e aggiunge
 * l'inset inferiore (home indicator) quando la tastiera è chiusa; il
 * componente aggiunge solo la hairline `border` in alto.
 *
 * `mediaDisabled` è per stati davvero bloccanti (pubblicazione in corso). Al
 * limite media (§62) conviene lasciare l'azione attiva e mostrare il messaggio
 * in `ComposerStatusBanner` al tap, così l'utente capisce perché non succede nulla.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ComposerToolbarProps = {
  /** false in Modifica: i media pubblicati non si aggiungono (§154). */
  showMedia: boolean;
  mediaDisabled?: boolean;
  tagDisabled?: boolean;
  onPressMedia: () => void;
  onPressTag: () => void;
  /**
   * HOM-10 §17–§18, §92–§96, §308–§309: nel composer Repost la toolbar è ristretta a «@»
   * e «link» — niente Foto/video, niente Tagga. Con questa prop le due azioni normali
   * non esistono, non sono solo disabilitate.
   */
  repost?: {
    disabled?: boolean;
    onPressLink: () => void;
    onPressMention: () => void;
  };
};

type ToolbarActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
};

function ToolbarAction({
  icon,
  label,
  accessibilityLabel,
  disabled,
  onPress,
  testID,
}: ToolbarActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={22} />
      <AppText variant="feedMeta">{label}</AppText>
    </Pressable>
  );
}

export function ComposerToolbar({
  showMedia,
  mediaDisabled = false,
  tagDisabled = false,
  onPressMedia,
  onPressTag,
  repost,
}: ComposerToolbarProps) {
  if (repost) {
    const disabled = repost.disabled ?? false;

    return (
      <View style={[styles.container, styles.repostContainer]}>
        <Pressable
          accessibilityLabel="Menziona una persona o una società"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={repost.onPressMention}
          style={({ pressed }) => [styles.iconAction, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
          testID="composer-toolbar-mention"
        >
          <Ionicons color={colors.textPrimary} name="at-outline" size={22} />
        </Pressable>
        <Pressable
          accessibilityLabel="Inserisci un link"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={repost.onPressLink}
          style={({ pressed }) => [styles.iconAction, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
          testID="composer-toolbar-link"
        >
          <Ionicons color={colors.textPrimary} name="link-outline" size={22} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showMedia ? (
        <ToolbarAction
          accessibilityLabel="Aggiungi foto o video"
          disabled={mediaDisabled}
          icon="image-outline"
          label="Foto/video"
          onPress={onPressMedia}
          testID="composer-toolbar-media"
        />
      ) : null}
      <ToolbarAction
        accessibilityLabel="Tagga persone o società"
        disabled={tagDisabled}
        icon="person-add-outline"
        label="Tagga"
        onPress={onPressTag}
        testID="composer-toolbar-tag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: 48,
  },
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[16],
  },
  disabled: {
    opacity: 0.4,
  },
  iconAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 44,
  },
  pressed: {
    opacity: 0.6,
  },
  repostContainer: {
    gap: spacing[8],
  },
});
