import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { withDefaultProfileAvatar } from "./profile-avatar";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Input } from "../../ui";

type ProfileHeaderProps = {
  avatarUrl: string | null | undefined;
  badges?: string[];
  clubLogoUrl?: string | null;
  clubMode?: boolean;
  fullName: string;
  isEditing?: boolean;
  onEditPress: () => void;
  primaryMeta: string;
  secondaryMeta?: string;
};

type ProfileSectionProps = {
  children: ReactNode;
  description?: string;
  title: string;
};

type ProfileFieldProps = {
  editable?: boolean;
  helperText?: string;
  label: string;
  multiline?: boolean;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  renderInput?: () => ReactNode;
  value: string;
};

export function ProfileHeader({
  avatarUrl,
  badges = [],
  clubLogoUrl,
  clubMode = false,
  fullName,
  isEditing = false,
  onEditPress,
  primaryMeta,
  secondaryMeta,
}: ProfileHeaderProps) {
  const actionLabel = isEditing
    ? "Esci dalla modifica profilo"
    : "Modifica profilo";
  const displayImageUrl =
    clubMode && clubLogoUrl ? clubLogoUrl : withDefaultProfileAvatar(avatarUrl);
  const imageLabel = clubMode ? "Logo club" : "Foto profilo";

  return (
    <View style={styles.headerCard}>
      <View style={styles.coverArea}>
        <View pointerEvents="none" style={styles.coverStripe} />
      </View>

      <View style={styles.identityBlock}>
        <View style={styles.identityTopRow}>
          {clubMode && !clubLogoUrl ? (
            <View style={[styles.avatar, styles.clubLogoPlaceholder]}>
              <Ionicons
                color={colors.textMuted}
                name="shield-outline"
                size={40}
              />
            </View>
          ) : (
            <Image
              accessibilityLabel={imageLabel}
              source={{ uri: displayImageUrl }}
              style={
                clubMode
                  ? [styles.avatar, styles.clubLogoAvatar]
                  : styles.avatar
              }
            />
          )}
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            accessibilityState={{ selected: isEditing }}
            hitSlop={12}
            onPress={onEditPress}
            style={({ pressed }) => [
              styles.editButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={colors.textSecondary}
              name={isEditing ? "close-outline" : "create-outline"}
              size={18}
            />
          </Pressable>
        </View>
        <View style={styles.identityCopy}>
          <AppText variant="headingLg">{fullName}</AppText>
          <AppText variant="titleSm">{primaryMeta}</AppText>
          {secondaryMeta ? (
            <AppText variant="bodySm" color="secondary">
              {secondaryMeta}
            </AppText>
          ) : null}
          {badges.length > 0 ? (
            <View style={styles.badgesRow}>
              {badges.map((badge) => (
                <View key={badge} style={styles.badge}>
                  <AppText variant="caption" color="accent">
                    {badge}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ProfileSection({
  children,
  description,
  title,
}: ProfileSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <AppText variant="headingSm">{title}</AppText>
        {description ? (
          <AppText variant="bodySm" color="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={styles.sectionDivider} />
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

export const ProfileSectionCard = ProfileSection;

export function ProfileField({
  editable = false,
  helperText,
  label,
  multiline,
  onChangeText,
  placeholder,
  renderInput,
  value,
}: ProfileFieldProps) {
  const isEditable = editable || Boolean(renderInput) || Boolean(onChangeText);
  const hasValue = value.trim().length > 0;

  return (
    <View style={styles.fieldContainer}>
      <AppText variant="overline">{label}</AppText>
      {isEditable ? (
        renderInput ? (
          renderInput()
        ) : (
          <Input
            multiline={multiline}
            onChangeText={onChangeText}
            placeholder={placeholder}
            value={value}
          />
        )
      ) : (
        <View
          style={[
            styles.readonlySurface,
            hasValue
              ? styles.completedReadonlySurface
              : styles.emptyReadonlySurface,
          ]}
        >
          <AppText variant="bodySm" color={hasValue ? "primary" : "secondary"}>
            {hasValue ? value : "Da completare"}
          </AppText>
        </View>
      )}
      {helperText ? (
        <AppText variant="bodySm" color="secondary">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 104,
    height: 104,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceMuted,
    marginTop: -52,
  },
  clubLogoAvatar: {
    borderRadius: radius[12],
  },
  clubLogoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius[12],
  },
  badge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  coverArea: {
    minHeight: 132,
    borderRadius: radius[12],
    backgroundColor: colors.backgroundStrong,
    overflow: "hidden",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: spacing[16],
  },
  coverStripe: {
    position: "absolute",
    right: spacing[28],
    top: 0,
    bottom: 0,
    width: 52,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  completedReadonlySurface: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  emptyReadonlySurface: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    marginTop: spacing[12],
  },
  fieldContainer: {
    gap: spacing[8],
  },
  headerCard: {
    gap: spacing[12],
  },
  identityBlock: {
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[8],
    gap: spacing[14],
  },
  identityTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  identityCopy: {
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.82,
  },
  readonlySurface: {
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  sectionCard: {
    gap: spacing[12],
    padding: spacing[18],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionContent: {
    gap: spacing[14],
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    gap: spacing[4],
  },
});
