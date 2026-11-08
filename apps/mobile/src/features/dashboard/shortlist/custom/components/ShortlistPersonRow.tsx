/**
 * Riga persona dei form di governo (DAS-REV-27 §11, §13, §19 — screen 03,
 * 06, 13, 16).
 *
 * «Riga: avatar, nome, ruolo organizzativo, checkbox» per la condivisione;
 * una radio per il nuovo proprietario («Recovery usa radio singole, non
 * checkbox»); nessun controllo per il Proprietario, che «è una riga distinta
 * e non è una checkbox rimovibile». L'intera riga è il target (≥ 44pt) e
 * annuncia nome, ruolo e selezione (§27).
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import type { ShortlistPerson } from "../custom-shortlist-types";

type Props = {
  control: "checkbox" | "radio" | "none";
  disabled?: boolean;
  onPress?: () => void;
  person: ShortlistPerson;
  selected?: boolean;
  showDivider?: boolean;
  testID?: string;
};

export function ShortlistPersonRow({
  control,
  disabled = false,
  onPress,
  person,
  selected = false,
  showDivider = false,
  testID,
}: Props) {
  const label = [person.fullName, person.roleLabel].filter(Boolean).join(", ");
  const content = (
    <>
      {control === "radio" ? (
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : null}

      <Avatar name={person.fullName} size="sm" uri={person.avatarUrl ?? undefined} />

      <View style={styles.text}>
        <AppText color="neutral" numberOfLines={2} variant="bodySm" style={styles.name}>
          {person.fullName}
        </AppText>
        {person.roleLabel ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="meta">
            {person.roleLabel}
          </AppText>
        ) : null}
      </View>

      {control === "checkbox" ? (
        <View style={[styles.box, selected ? styles.boxOn : null]}>
          {selected ? <Ionicons color={colors.inkInvert} name="checkmark" size={16} /> : null}
        </View>
      ) : null}
    </>
  );

  if (control === "none" || !onPress) {
    return (
      <View
        accessibilityLabel={label}
        accessible
        style={[styles.row, showDivider ? styles.divider : null]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={control}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.divider : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[8],
  },
  divider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  name: {
    fontWeight: "600",
  },
  box: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radius[6],
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOn: {
    borderColor: colors.accent,
  },
  radioDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 12,
    width: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.5,
  },
});
