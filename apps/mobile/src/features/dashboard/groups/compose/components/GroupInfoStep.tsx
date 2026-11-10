/**
 * Step 1 — Informazioni (DAS-REV-32 §14, §15, §16; PNG 07-09).
 *
 * Ordine fisso: avatar facoltativo, Nome gruppo, Squadra. Niente descrizione,
 * cover, categoria o privacy (§14). L'errore di upload sta accanto all'avatar
 * con «Riprova» e «Rimuovi immagine»: non cancella mai gli altri campi (§16).
 */
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Input } from "../../../../../ui";
import { GroupAvatar } from "../../components/GroupAvatar";
import { GROUPS_COPY } from "../../groups-copy";
import type { TeamField } from "../../groups-presentation";

export type AvatarDraftView = {
  error: string | null;
  previewUri: string;
  status: "error" | "ready" | "uploading";
};

type Props = {
  avatar: AvatarDraftView | null;
  avatarNotice: string | null;
  nameError: string | null;
  nameValue: string;
  onAvatarPress: () => void;
  onAvatarRemove: () => void;
  onAvatarRetry: () => void;
  onNameBlur: () => void;
  onNameChange: (value: string) => void;
  onTeamPress: () => void;
  onTeamRetry: () => void;
  teamError: string | null;
  teamField: TeamField;
  teamLoadError: boolean;
  teamLoading: boolean;
  teamValue: string;
};

export function GroupInfoStep({
  avatar,
  avatarNotice,
  nameError,
  nameValue,
  onAvatarPress,
  onAvatarRemove,
  onAvatarRetry,
  onNameBlur,
  onNameChange,
  onTeamPress,
  onTeamRetry,
  teamError,
  teamField,
  teamLoadError,
  teamLoading,
  teamValue,
}: Props) {
  const uploading = avatar?.status === "uploading";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarBlock}>
        <Pressable
          accessibilityLabel={GROUPS_COPY.addImageA11y}
          accessibilityRole="button"
          accessibilityState={{ busy: uploading }}
          disabled={uploading}
          onPress={onAvatarPress}
          style={({ pressed }) => [styles.avatarButton, pressed ? styles.pressed : null]}
          testID="group-avatar-button"
        >
          {avatar ? (
            <GroupAvatar name="" path={null} previewUri={avatar.previewUri} size="xl" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons color={colors.textNeutralMuted} name="camera-outline" size={32} />
            </View>
          )}
          {uploading ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={colors.inkInvert} />
            </View>
          ) : null}
        </Pressable>

        <AppText color="neutralMuted" variant="meta">
          {GROUPS_COPY.imageOptional}
        </AppText>

        {uploading ? (
          <AppText accessibilityLiveRegion="polite" color="neutralMuted" variant="meta">
            {GROUPS_COPY.imageUploading}
          </AppText>
        ) : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAvatarPress}
            style={styles.link}
            testID="group-avatar-link"
          >
            <AppText color="accent" variant="actionLabel">
              {avatar ? GROUPS_COPY.changeImage : GROUPS_COPY.addImage}
            </AppText>
          </Pressable>
        )}

        {avatar?.status === "error" ? (
          <View style={styles.avatarError}>
            <AppText accessibilityLiveRegion="polite" align="center" color="danger" variant="bodySm">
              {avatar.error ?? GROUPS_COPY.imageError}
            </AppText>
            <View style={styles.avatarErrorActions}>
              <Pressable accessibilityRole="button" onPress={onAvatarRetry} style={styles.link} testID="group-avatar-retry">
                <AppText color="accent" variant="actionLabel">
                  {GROUPS_COPY.retry}
                </AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onAvatarRemove} style={styles.link} testID="group-avatar-remove">
                <AppText color="accent" variant="actionLabel">
                  {GROUPS_COPY.removeImage}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {avatarNotice ? (
          <AppText accessibilityLiveRegion="polite" align="center" color="danger" variant="bodySm">
            {avatarNotice}
          </AppText>
        ) : null}
      </View>

      <Input
        accessibilityLabel={GROUPS_COPY.nameLabel}
        autoCapitalize="sentences"
        error={nameError !== null}
        helperText={nameError ?? undefined}
        label={GROUPS_COPY.nameLabel}
        onBlur={onNameBlur}
        onChangeText={onNameChange}
        placeholder={GROUPS_COPY.namePlaceholder}
        returnKeyType="done"
        testID="group-name-input"
        value={nameValue}
      />

      <View style={styles.teamBlock}>
        <Pressable
          accessibilityHint={GROUPS_COPY.teamChoose}
          accessibilityLabel={`${teamField.label}, ${teamValue}`}
          accessibilityRole="button"
          disabled={teamLoading}
          onPress={onTeamPress}
          style={({ pressed }) => [styles.teamRow, pressed ? styles.pressed : null]}
          testID="group-team-row"
        >
          <AppText color="neutral" style={styles.teamLabel} variant="bodyLg">
            {teamField.label}
          </AppText>
          <AppText
            color={teamValue === GROUPS_COPY.teamChoose ? "neutralMuted" : "neutral"}
            numberOfLines={1}
            style={styles.teamValue}
            variant="bodyLg"
          >
            {teamLoading ? GROUPS_COPY.loading : teamValue}
          </AppText>
          <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
        </Pressable>

        {teamField.help ? (
          <AppText color="neutralMuted" variant="meta">
            {teamField.help}
          </AppText>
        ) : null}

        {teamError ? (
          <AppText accessibilityLiveRegion="polite" color="danger" variant="bodySm">
            {teamError}
          </AppText>
        ) : null}

        {teamLoadError ? (
          <View style={styles.loadError}>
            <AppText color="danger" variant="bodySm">
              {GROUPS_COPY.teamsLoadError}
            </AppText>
            <Pressable accessibilityRole="button" onPress={onTeamRetry} style={styles.link}>
              <AppText color="accent" variant="actionLabel">
                {GROUPS_COPY.retry}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: "center",
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  avatarButton: {
    borderRadius: 52,
    height: 104,
    width: 104,
  },
  avatarError: {
    alignItems: "center",
    gap: spacing[4],
  },
  avatarErrorActions: {
    flexDirection: "row",
    gap: spacing[20],
  },
  avatarOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(17, 17, 17, 0.45)",
    borderRadius: 52,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  avatarPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 52,
    borderWidth: 1,
    height: 104,
    justifyContent: "center",
    width: 104,
  },
  content: {
    gap: spacing[20],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  link: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
  },
  loadError: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  teamBlock: {
    gap: spacing[6],
  },
  teamLabel: {
    flexShrink: 0,
  },
  teamRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 52,
  },
  teamValue: {
    flex: 1,
    textAlign: "right",
  },
});
