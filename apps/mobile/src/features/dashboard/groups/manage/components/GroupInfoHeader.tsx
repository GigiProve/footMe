/**
 * Intestazione di Info gruppo (DAS-REV-33 §9, §10; PNG 01-05).
 *
 * Immagine, nome, Società/Squadra e «N persone · M amministratori». Nome e
 * avatar si modificano **dove compaiono** (§6): nessuna card Informazioni,
 * nessuna pagina per rinominare, nessuna riga «Foto gruppo». Le affordance
 * (matita, badge fotocamera) esistono solo se il server concede la capability
 * (§5): un MEMBER vede gli stessi dati senza nulla di toccabile.
 *
 * L'editing del nome è inline con Salva/Annulla compatti. Durante la richiesta
 * il testo resta, il doppio invio è impedito e l'errore compare vicino al campo
 * (§10, QA-020).
 */
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Input } from "../../../../../ui";
import { GroupAvatar } from "../../components/GroupAvatar";
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "../../groups-copy";
import { headerContextOf, peopleLineOf } from "../../groups-manage-presentation";
import type { GroupManagement } from "../../groups-types";

type Props = {
  avatarBusy: boolean;
  avatarEditable: boolean;
  draft: string;
  editing: boolean;
  management: GroupManagement;
  nameEditable: boolean;
  nameError: string | null;
  onCancelName: () => void;
  onChangeDraft: (value: string) => void;
  onEditAvatar: () => void;
  onSaveName: () => void;
  onStartName: () => void;
  saving: boolean;
};

export function GroupInfoHeader({
  avatarBusy,
  avatarEditable,
  draft,
  editing,
  management,
  nameEditable,
  nameError,
  onCancelName,
  onChangeDraft,
  onEditAvatar,
  onSaveName,
  onStartName,
  saving,
}: Props) {
  const avatar = <GroupAvatar name={management.name} path={management.avatarPath} size="lg" />;
  const context = headerContextOf(management);

  return (
    <View style={styles.hero}>
      {avatarEditable ? (
        <Pressable
          accessibilityLabel={C.editImage}
          accessibilityRole="button"
          accessibilityState={{ busy: avatarBusy, disabled: avatarBusy }}
          disabled={avatarBusy}
          onPress={onEditAvatar}
          style={({ pressed }) => [styles.avatarWrap, pressed ? styles.pressed : null]}
          testID="group-info-avatar"
        >
          {avatar}
          <View style={styles.cameraBadge}>
            {avatarBusy ? (
              <ActivityIndicator color={colors.inkInvert} size="small" />
            ) : (
              <Ionicons color={colors.inkInvert} name="camera" size={13} />
            )}
          </View>
        </Pressable>
      ) : (
        <View style={styles.avatarWrap}>{avatar}</View>
      )}

      <View style={styles.text}>
        {editing ? (
          /* Salva/Annulla accanto al campo (PNG 04); se non ci stanno scendono
             sotto, e l'errore resta sotto il campo in ogni caso. */
          <View style={styles.editor}>
            <View style={styles.inputColumn}>
              <Input
                accessibilityLabel={C.editName}
                autoCapitalize="sentences"
                autoFocus
                disabled={saving}
                error={nameError !== null}
                helperText={nameError ?? undefined}
                onChangeText={onChangeDraft}
                onSubmitEditing={onSaveName}
                returnKeyType="done"
                style={styles.nameInput}
                testID="group-name-input"
                value={draft}
              />
            </View>
            <View style={styles.editorActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: saving, disabled: saving }}
                disabled={saving}
                hitSlop={8}
                onPress={onSaveName}
                style={styles.editorAction}
                testID="group-name-save"
              >
                {saving ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <AppText color="accent" variant="actionLabel">
                    {C.save}
                  </AppText>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                hitSlop={8}
                onPress={onCancelName}
                style={styles.editorAction}
                testID="group-name-cancel"
              >
                <AppText color="accent" variant="actionLabel">
                  {C.cancel}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <AppText accessibilityRole="header" color="neutral" style={styles.name} variant="headingSm">
              {management.name}
            </AppText>
            {nameEditable ? (
              <Pressable
                accessibilityLabel={C.editName}
                accessibilityRole="button"
                hitSlop={10}
                onPress={onStartName}
                style={({ pressed }) => [styles.pencil, pressed ? styles.pressed : null]}
                testID="group-name-edit"
              >
                <Ionicons color={colors.textNeutralMuted} name="pencil" size={16} />
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.clubRow}>
          <AppText color="neutralMuted" numberOfLines={2} style={styles.clubName} variant="bodySm">
            {context.clubName}
          </AppText>
          {context.clubVerified ? (
            <Ionicons accessibilityLabel={GROUPS_COPY.societyVerified} color={colors.accent} name="checkmark-circle" size={15} />
          ) : null}
        </View>
        {context.teamName ? (
          <AppText color="neutralMuted" variant="bodySm">
            {context.teamName}
          </AppText>
        ) : null}
        <AppText color="neutralMuted" variant="meta">
          {peopleLineOf(management)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignSelf: "flex-start",
  },
  clubName: {
    flexShrink: 1,
  },
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  cameraBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    bottom: -2,
    height: 24,
    justifyContent: "center",
    left: -2,
    position: "absolute",
    width: 24,
  },
  editor: {
    alignItems: "flex-start",
    columnGap: spacing[8],
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing[4],
  },
  editorAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  editorActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 44,
  },
  inputColumn: {
    flex: 1,
    minWidth: 120,
  },
  hero: {
    flexDirection: "row",
    gap: spacing[16],
    paddingBottom: spacing[16],
    paddingTop: spacing[8],
  },
  name: {
    flexShrink: 1,
  },
  nameInput: {
    minHeight: 44,
    paddingVertical: spacing[8],
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  pencil: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
