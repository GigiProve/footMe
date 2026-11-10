/**
 * Righe e azioni di Info gruppo (DAS-REV-33 §9, §11; PNG 01-03, 14, 16, 19).
 *
 *  · `GroupInfoRow`: Squadra e Persone. Squadra mostra **solo il valore** senza
 *    la capability `can_edit_team`: nessun chevron, nessun campo disabled
 *    (§11). Persone è interattiva solo con `can_view_people` (§12).
 *  · `GroupInfoActions`: «Azioni gruppo» con righe leggere — non tre card — e
 *    al massimo una CTA primaria blu (§6). Rosso solo per Elimina. Le azioni
 *    arrivano già filtrate da `infoActionsOf`: qui non si decide nulla.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";
import { GROUP_MANAGE_COPY as C } from "../../groups-copy";
import type { GroupInfoAction, GroupInfoActionKey } from "../../groups-manage-presentation";

type RowProps = {
  label: string;
  onPress: (() => void) | null;
  testID?: string;
  value: string;
};

export function GroupInfoRow({ label, onPress, testID, value }: RowProps) {
  const content = (
    <>
      <AppText color="neutral" variant="bodyLg">
        {label}
      </AppText>
      <AppText color="neutralMuted" numberOfLines={1} style={styles.rowValue} variant="bodyLg">
        {value}
      </AppText>
      {onPress ? <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${label}, ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const ICONS: Record<GroupInfoActionKey, keyof typeof Ionicons.glyphMap> = {
  add_people: "person-add-outline",
  archive: "archive-outline",
  delete: "trash-outline",
  leave: "log-out-outline",
  manage_people: "people-outline",
  reactivate: "refresh-outline",
};

type ActionsProps = {
  actions: readonly GroupInfoAction[];
  /** Chiave del comando in corso: loading locale sulla CTA primaria (§22). */
  busyKey: GroupInfoActionKey | null;
  notice: string | null;
  onAction: (key: GroupInfoActionKey) => void;
};

export function GroupInfoActions({ actions, busyKey, notice, onAction }: ActionsProps) {
  if (actions.length === 0 && !notice) {
    return null;
  }

  const primary = actions.find((action) => action.tone === "primary") ?? null;
  const light = actions.filter((action) => action.tone !== "primary");

  return (
    <View style={styles.actions}>
      {actions.length > 0 ? (
        <AppText accessibilityRole="header" color="neutralMuted" variant="eyebrow">
          {C.actionsTitle}
        </AppText>
      ) : null}

      {notice ? (
        <AppText color="neutralMuted" testID="group-info-notice" variant="bodySm">
          {notice}
        </AppText>
      ) : null}

      {primary ? (
        <Button
          fullWidth
          label={primary.label}
          loading={busyKey === primary.key}
          onPress={() => onAction(primary.key)}
          testID={`group-action-${primary.key}`}
          variant="primary"
        />
      ) : null}

      <View style={styles.lightRows}>
        {light.map((action) => (
          <Pressable
            accessibilityRole="button"
            disabled={busyKey !== null}
            key={action.key}
            onPress={() => onAction(action.key)}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
            testID={`group-action-${action.key}`}
          >
            <Ionicons
              color={action.tone === "danger" ? colors.danger : colors.textNeutral}
              name={ICONS[action.key]}
              size={20}
            />
            <AppText color={action.tone === "danger" ? "danger" : "neutral"} variant="bodyLg">
              {action.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 48,
  },
  actions: {
    gap: spacing[12],
    paddingTop: spacing[20],
  },
  lightRows: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: 52,
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
  },
});
