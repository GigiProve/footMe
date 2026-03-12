import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { withDefaultProfileAvatar } from "./profile-avatar";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui";

type ProfileHeaderProps = {
  avatarUrl: string | null | undefined;
  badges?: string[];
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
  fullName,
  isEditing = false,
  onEditPress,
  primaryMeta,
  secondaryMeta,
}: ProfileHeaderProps) {
  const actionLabel = isEditing ? "Esci dalla modifica profilo" : "Modifica profilo";

  return (
    <View style={styles.headerCard}>
      <View style={styles.coverArea}>
        <View pointerEvents="none" style={styles.coverStripe} />
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          accessibilityState={{ selected: isEditing }}
          hitSlop={12}
          onPress={onEditPress}
          style={({ pressed }) => [styles.editButton, pressed ? styles.pressed : null]}
        >
          <Ionicons
            color={colors.accentStrong}
            name={isEditing ? "close-outline" : "create-outline"}
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.identityBlock}>
        <Image
          accessibilityLabel="Foto profilo"
          source={{ uri: withDefaultProfileAvatar(avatarUrl) }}
          style={styles.avatar}
        />
        <View style={styles.identityCopy}>
          <Text style={styles.fullName}>{fullName}</Text>
          <Text style={styles.primaryMeta}>{primaryMeta}</Text>
          {secondaryMeta ? <Text style={styles.secondaryMeta}>{secondaryMeta}</Text> : null}
          {badges.length > 0 ? (
            <View style={styles.badgesRow}>
              {badges.map((badge) => (
                <View key={badge} style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ProfileSection({ children, description, title }: ProfileSectionProps) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      <View style={styles.sectionDivider} />
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

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

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
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
        <View style={styles.readonlySurface}>
          <Text style={styles.readonlyValue}>{value.trim() ? value : "Da completare"}</Text>
        </View>
      )}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
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
  badge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    color: colors.accentStrong,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize[12],
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  coverArea: {
    minHeight: 132,
    borderRadius: radius[24],
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
  editButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldContainer: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.md,
  },
  fullName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[30],
    lineHeight: typography.lineHeight[34],
    fontWeight: typography.fontWeight.heavy,
  },
  headerCard: {
    gap: spacing[12],
  },
  helperText: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  identityBlock: {
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[8],
    gap: spacing[14],
  },
  identityCopy: {
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.82,
  },
  primaryMeta: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[17],
    lineHeight: typography.lineHeight[24],
    fontWeight: typography.fontWeight.bold,
  },
  readonlySurface: {
    borderRadius: radius[18],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  readonlyValue: {
    color: colors.textPrimary,
    lineHeight: typography.lineHeight[22],
  },
  secondaryMeta: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  sectionCard: {
    gap: spacing[12],
    padding: spacing[18],
    borderRadius: radius[24],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionContent: {
    gap: spacing[14],
  },
  sectionDescription: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    gap: spacing[4],
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.heavy,
  },
});
