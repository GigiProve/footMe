/**
 * Selezione dei destinatari (DAS-REV-30 §13–§15; screen 02, 03).
 *
 *   · CandidateRow — checkbox associata al nome (§30: «Checkbox/radio e
 *     stato non selezionabile associati al nome»). Una riga non
 *     selezionabile dice perché, in testo, senza colori allarmistici;
 *   · SourceSheet — «Mostra profili da»: Tutti i profili, Per posizione,
 *     Liste personalizzate. Solo liste che il server ha restituito come
 *     accessibili (§14): nessun nome o count di liste altrui.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Radio } from "../../../../../ui";
import { INVITE_COPY, candidateMeta, sourceKey, sourceLabel } from "../invite-presentation";
import type { InviteCandidate, InviteSource, InviteSourceList, InviteSources } from "../invite-types";

export function CandidateRow({
  checked,
  first,
  onToggle,
  row,
}: {
  checked: boolean;
  first: boolean;
  onToggle: () => void;
  row: InviteCandidate;
}) {
  const meta = candidateMeta(row);
  const disabled = !row.selectable && !checked;

  return (
    <Pressable
      accessibilityLabel={[row.fullName, meta].filter(Boolean).join(", ")}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, first ? null : styles.divider, pressed ? styles.pressed : null]}
      testID={`invite-candidate-${row.personId}`}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null, disabled ? styles.boxDisabled : null]}>
        {checked ? <Ionicons color={colors.inkInvert} name="checkmark" size={14} /> : null}
      </View>
      <Avatar name={row.fullName} size="md" uri={row.avatarUrl ?? undefined} />
      <View style={styles.text}>
        <AppText color={disabled ? "neutralMuted" : "neutral"} numberOfLines={1} variant="titleSm">
          {row.fullName}
        </AppText>
        {meta ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {meta}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SourceControl({ onPress, source }: { onPress: () => void; source: InviteSource }) {
  const label = sourceLabel(source);

  return (
    <Pressable
      accessibilityLabel={INVITE_COPY.sourceA11y(label)}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed ? styles.pressed : null]}
      testID="invite-source"
    >
      <AppText color="neutral" numberOfLines={1} style={styles.text} variant="bodySm">
        {label}
      </AppText>
      <Ionicons color={colors.textNeutral} name="chevron-down" size={18} />
    </Pressable>
  );
}

export function SourceSheet({
  current,
  onClose,
  onSelect,
  sources,
  visible,
}: {
  current: InviteSource;
  onClose: () => void;
  onSelect: (source: InviteSource) => void;
  sources: InviteSources | null;
  visible: boolean;
}) {
  const currentKey = sourceKey(current);
  const group = (title: string, lists: readonly InviteSourceList[], id: string) =>
    lists.length > 0 ? (
      <View style={styles.group} testID={`invite-source-group-${id}`}>
        <AppText color="neutralMuted" style={styles.groupTitle} variant="eyebrow">
          {title}
        </AppText>
        {lists.map((list) => (
          <Radio
            checked={currentKey === list.shortlistId}
            key={list.shortlistId}
            label={sourceLabel(list)}
            onPress={() => onSelect(list)}
            testID={`invite-source-${list.shortlistId}`}
            tone="neutral"
          />
        ))}
      </View>
    ) : null;

  return (
    <BottomSheet onClose={onClose} title={INVITE_COPY.sourceTitle} visible={visible}>
      <View accessibilityRole="radiogroup" style={styles.sheet} testID="invite-source-sheet">
        <Radio
          checked={current === null}
          label={INVITE_COPY.sourceAll}
          onPress={() => onSelect(null)}
          testID="invite-source-all"
          tone="neutral"
        />
        {group(INVITE_COPY.sourcePositions, sources?.positionLists ?? [], "position")}
        {group(INVITE_COPY.sourceCustom, sources?.customLists ?? [], "custom")}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  /* Stesso quadratino del Checkbox condiviso: qui la riga porta anche
     l'avatar, che il componente base non prevede. */
  box: {
    alignItems: "center",
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius[4],
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  boxDisabled: {
    backgroundColor: colors.surfaceNeutral,
    borderColor: colors.divider,
  },
  control: {
    alignItems: "center",
    borderColor: colors.borderNeutral,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
  divider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  group: {
    gap: spacing[4],
  },
  groupTitle: {
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
    paddingVertical: spacing[8],
  },
  sheet: {
    gap: spacing[8],
  },
  text: {
    flex: 1,
  },
});
