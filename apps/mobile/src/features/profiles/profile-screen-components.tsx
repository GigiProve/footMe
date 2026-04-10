import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { withDefaultProfileAvatar } from "./profile-avatar";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Avatar, Badge, Button, Divider, Input } from "../../ui";

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
  variant?: "card" | "flat";
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
  variant?: "default" | "plain";
};

export type PlayerProfileHeaderMode = "owner" | "visitor";

type PlayerProfileHeaderProps = {
  ageLabel: string;
  availabilityBadges?: string[];
  avatarUrl: string | null | undefined;
  bio?: string | null;
  categoryBadges?: string[];
  clubLabel?: string;
  coverImageUrl?: string | null;
  fullName: string;
  heightLabel: string;
  locationLabel?: string;
  mode: PlayerProfileHeaderMode;
  onAddContentPress?: () => void;
  onContactPress?: () => void;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  preferredFootLabel: string;
  primaryRole: string;
  regionBadges?: string[];
  secondaryRole?: string;
  statusBadge?: string;
  weightLabel: string;
};

type CoachProfileHeaderProps = {
  availabilityBadges?: string[];
  avatarUrl: string | null | undefined;
  bio?: string | null;
  categoryLabel?: string;
  coverImageUrl?: string | null;
  fullName: string;
  licenseBadges?: string[];
  locationLabel?: string;
  mode: PlayerProfileHeaderMode;
  onContactPress?: () => void;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  primaryRole: string;
  statusBadge?: string;
  teamLabel?: string;
};

const DEFAULT_PLAYER_COVER_URI =
  "https://storage.googleapis.com/banani-generated-images/generated-images/b339be2f-1f6e-4796-b76a-a714a1fe33d2.jpg";

export function PlayerProfileHeader({
  ageLabel,
  availabilityBadges = [],
  avatarUrl,
  bio,
  categoryBadges = [],
  clubLabel,
  coverImageUrl,
  fullName,
  heightLabel,
  locationLabel,
  mode,
  onAddContentPress,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  preferredFootLabel,
  primaryRole,
  regionBadges = [],
  secondaryRole,
  statusBadge,
  weightLabel,
}: PlayerProfileHeaderProps) {
  const resolvedAvatarUrl = withDefaultProfileAvatar(avatarUrl);
  const infoGroups = [
    {
      label: "Disponibilita'",
      values: availabilityBadges,
      variant: "success" as const,
    },
    {
      label: "Categorie",
      values: categoryBadges,
      variant: "default" as const,
    },
    {
      label: "Zone",
      values: regionBadges,
      variant: "default" as const,
    },
  ].filter((group) => group.values.length > 0);

  return (
    <View style={styles.playerHeaderSurface}>
      <View style={styles.playerHeroBlock}>
        <Image
          accessibilityLabel="Copertina profilo giocatore"
          source={{ uri: coverImageUrl || DEFAULT_PLAYER_COVER_URI }}
          style={styles.playerCoverImage}
        />
        <View pointerEvents="none" style={styles.playerCoverOverlay} />
        <View style={styles.playerAvatarShell}>
          <Avatar name={fullName} size="xl" uri={resolvedAvatarUrl} />
        </View>
        <View style={styles.playerHeroContent}>
          <View style={styles.playerIdentityStack}>
            <AppText variant="headingLg">{fullName}</AppText>
            <View style={styles.playerRoleRow}>
              <AppText color="accent" style={styles.playerPrimaryRole} variant="titleSm">
                {primaryRole}
              </AppText>
              {secondaryRole ? (
                <>
                  <AppText color="secondary" variant="titleSm">
                    /
                  </AppText>
                  <AppText color="secondary" style={styles.playerSecondaryRole} variant="titleSm">
                    {secondaryRole}
                  </AppText>
                </>
              ) : null}
            </View>
            {clubLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons
                  color={colors.textSecondary}
                  name="shield-outline"
                  size={15}
                />
                <AppText color="secondary" variant="bodySm">
                  {clubLabel}
                </AppText>
              </View>
            ) : null}
            {locationLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons
                  color={colors.textSecondary}
                  name="location-outline"
                  size={15}
                />
                <AppText color="secondary" variant="bodySm">
                  {locationLabel}
                </AppText>
              </View>
            ) : null}
          </View>

          {statusBadge ? (
            <View style={styles.playerStatusBadge}>
              <Ionicons
                color={colors.successForeground}
                name="checkmark-circle"
                size={16}
              />
              <AppText color="success" variant="caption">
                {statusBadge}
              </AppText>
            </View>
          ) : null}

          <View style={styles.playerActionsRow}>
            {mode === "owner" ? (
              <HeaderActionButton
                icon="create-outline"
                label="Modifica profilo"
                onPress={onEditProfilePress}
                variant="primary"
              />
            ) : (
              <>
                <HeaderActionButton
                  icon="person-add-outline"
                  label="Segui"
                  onPress={onFollowPress}
                  variant="primary"
                />
                <HeaderActionButton
                  icon="chatbubble-ellipses-outline"
                  label="Contatta"
                  onPress={onContactPress}
                  variant="secondary"
                />
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.playerSummarySection}>
        <View style={styles.playerStatsRow}>
          <StatItem label="Eta'" value={ageLabel} />
          <StatItem label="Altezza" value={heightLabel} />
          <StatItem label="Peso" value={weightLabel} />
          <StatItem label="Piede" value={preferredFootLabel} />
        </View>
      </View>

      {bio?.trim() || infoGroups.length > 0 ? (
        <>
          <Divider />
          <View style={styles.playerSummarySection}>
          {bio?.trim() ? (
            <View style={styles.playerInfoBlock}>
              <AppText color="secondary" variant="overline">
                Bio
              </AppText>
              <AppText numberOfLines={3} variant="bodySm">
                {bio.trim()}
              </AppText>
            </View>
          ) : null}

          {bio?.trim() && infoGroups.length > 0 ? <Divider /> : null}

          {infoGroups.length > 0 ? (
            <View style={styles.playerChipSectionList}>
              {infoGroups.map((group) => (
                <View key={group.label} style={styles.playerInfoBlock}>
                  <AppText color="secondary" variant="overline">
                    {group.label}
                  </AppText>
                  <View style={styles.playerChipWrap}>
                    {group.values.map((value) => (
                      <Badge key={`${group.label}-${value}`} label={value} variant={group.variant} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

export function CoachProfileHeader({
  availabilityBadges = [],
  avatarUrl,
  bio,
  categoryLabel,
  coverImageUrl,
  fullName,
  licenseBadges = [],
  locationLabel,
  mode,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  primaryRole,
  statusBadge,
  teamLabel,
}: CoachProfileHeaderProps) {
  const resolvedAvatarUrl = withDefaultProfileAvatar(avatarUrl);
  const infoGroups = [
    {
      label: "Disponibilita'",
      values: availabilityBadges,
      variant: "success" as const,
    },
    {
      label: "Licenze",
      values: licenseBadges,
      variant: "default" as const,
    },
  ].filter((group) => group.values.length > 0);

  return (
    <View style={styles.playerHeaderSurface}>
      <View style={styles.playerHeroBlock}>
        <Image
          accessibilityLabel="Copertina profilo allenatore"
          source={{ uri: coverImageUrl || DEFAULT_PLAYER_COVER_URI }}
          style={styles.playerCoverImage}
        />
        <View pointerEvents="none" style={styles.playerCoverOverlay} />
        <View style={styles.playerAvatarShell}>
          <Avatar name={fullName} size="xl" uri={resolvedAvatarUrl} />
        </View>
        <View style={styles.playerHeroContent}>
          <View style={styles.playerIdentityStack}>
            <AppText variant="headingLg">{fullName}</AppText>
            <View style={styles.playerRoleRow}>
              <AppText color="accent" style={styles.playerPrimaryRole} variant="titleSm">
                {primaryRole}
              </AppText>
            </View>
            {teamLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons color={colors.textSecondary} name="shield-outline" size={15} />
                <AppText color="secondary" variant="bodySm">
                  {teamLabel}
                </AppText>
              </View>
            ) : null}
            {categoryLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons color={colors.textSecondary} name="layers-outline" size={15} />
                <AppText color="secondary" variant="bodySm">
                  {categoryLabel}
                </AppText>
              </View>
            ) : null}
            {locationLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons color={colors.textSecondary} name="location-outline" size={15} />
                <AppText color="secondary" variant="bodySm">
                  {locationLabel}
                </AppText>
              </View>
            ) : null}
          </View>

          {statusBadge ? (
            <View style={styles.playerStatusBadge}>
              <Ionicons color={colors.successForeground} name="checkmark-circle" size={16} />
              <AppText color="success" variant="caption">
                {statusBadge}
              </AppText>
            </View>
          ) : null}

          <View style={styles.playerActionsRow}>
            {mode === "owner" ? (
              <HeaderActionButton
                icon="create-outline"
                label="Modifica profilo"
                onPress={onEditProfilePress}
                variant="primary"
              />
            ) : (
              <>
                <HeaderActionButton
                  icon="person-add-outline"
                  label="Segui"
                  onPress={onFollowPress}
                  variant="primary"
                />
                <HeaderActionButton
                  icon="chatbubble-ellipses-outline"
                  label="Contatta"
                  onPress={onContactPress}
                  variant="secondary"
                />
              </>
            )}
          </View>
        </View>
      </View>

      {bio?.trim() || infoGroups.length > 0 ? (
        <>
          <Divider />
          <View style={styles.playerSummarySection}>
            {bio?.trim() ? (
              <View style={styles.playerInfoBlock}>
                <AppText color="secondary" variant="overline">
                  Bio
                </AppText>
                <AppText numberOfLines={3} variant="bodySm">
                  {bio.trim()}
                </AppText>
              </View>
            ) : null}

            {bio?.trim() && infoGroups.length > 0 ? <Divider /> : null}

            {infoGroups.length > 0 ? (
              <View style={styles.playerChipSectionList}>
                {infoGroups.map((group) => (
                  <View key={group.label} style={styles.playerInfoBlock}>
                    <AppText color="secondary" variant="overline">
                      {group.label}
                    </AppText>
                    <View style={styles.playerChipWrap}>
                      {group.values.map((value) => (
                        <Badge key={`${group.label}-${value}`} label={value} variant={group.variant} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

type StaffProfileHeaderProps = {
  availabilityBadges?: string[];
  avatarUrl: string | null | undefined;
  bio?: string | null;
  coverImageUrl?: string | null;
  fullName: string;
  locationLabel?: string;
  mode: PlayerProfileHeaderMode;
  onContactPress?: () => void;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  primaryRole: string;
  statusBadge?: string;
};

export function StaffProfileHeader({
  availabilityBadges = [],
  avatarUrl,
  bio,
  coverImageUrl,
  fullName,
  locationLabel,
  mode,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  primaryRole,
  statusBadge,
}: StaffProfileHeaderProps) {
  const resolvedAvatarUrl = withDefaultProfileAvatar(avatarUrl);

  return (
    <View style={styles.playerHeaderSurface}>
      <View style={styles.playerHeroBlock}>
        <Image
          accessibilityLabel="Copertina profilo staff"
          source={{ uri: coverImageUrl || DEFAULT_PLAYER_COVER_URI }}
          style={styles.playerCoverImage}
        />
        <View pointerEvents="none" style={styles.playerCoverOverlay} />
        <View style={styles.playerAvatarShell}>
          <Avatar name={fullName} size="xl" uri={resolvedAvatarUrl} />
        </View>
        <View style={styles.playerHeroContent}>
          <View style={styles.playerIdentityStack}>
            <AppText variant="headingLg">{fullName}</AppText>
            <View style={styles.playerRoleRow}>
              <AppText color="accent" style={styles.playerPrimaryRole} variant="titleSm">
                {primaryRole}
              </AppText>
            </View>
            {locationLabel ? (
              <View style={styles.playerMetaRow}>
                <Ionicons color={colors.textSecondary} name="location-outline" size={15} />
                <AppText color="secondary" variant="bodySm">
                  {locationLabel}
                </AppText>
              </View>
            ) : null}
          </View>

          {statusBadge ? (
            <View style={styles.playerStatusBadge}>
              <Ionicons color={colors.successForeground} name="checkmark-circle" size={16} />
              <AppText color="success" variant="caption">
                {statusBadge}
              </AppText>
            </View>
          ) : null}

          <View style={styles.playerActionsRow}>
            {mode === "owner" ? (
              <HeaderActionButton
                icon="create-outline"
                label="Modifica profilo"
                onPress={onEditProfilePress}
                variant="primary"
              />
            ) : (
              <>
                <HeaderActionButton
                  icon="person-add-outline"
                  label="Segui"
                  onPress={onFollowPress}
                  variant="primary"
                />
                <HeaderActionButton
                  icon="chatbubble-ellipses-outline"
                  label="Contatta"
                  onPress={onContactPress}
                  variant="secondary"
                />
              </>
            )}
          </View>
        </View>
      </View>

      {bio?.trim() || availabilityBadges.length > 0 ? (
        <>
          <Divider />
          <View style={styles.playerSummarySection}>
            {bio?.trim() ? (
              <View style={styles.playerInfoBlock}>
                <AppText color="secondary" variant="overline">
                  Bio
                </AppText>
                <AppText numberOfLines={3} variant="bodySm">
                  {bio.trim()}
                </AppText>
              </View>
            ) : null}

            {bio?.trim() && availabilityBadges.length > 0 ? <Divider /> : null}

            {availabilityBadges.length > 0 ? (
              <View style={styles.playerInfoBlock}>
                <AppText color="secondary" variant="overline">
                  Disponibilita'
                </AppText>
                <View style={styles.playerChipWrap}>
                  {availabilityBadges.map((badge) => (
                    <Badge key={badge} label={badge} variant="success" />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

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
  variant = "card",
}: ProfileSectionProps) {
  return (
    <View style={[styles.sectionBase, variant === "flat" ? styles.sectionFlat : styles.sectionCard]}>
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
  variant = "default",
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
          style={
            variant === "plain"
              ? styles.readonlyPlain
              : [
                  styles.readonlySurface,
                  hasValue
                    ? styles.completedReadonlySurface
                    : styles.emptyReadonlySurface,
                ]
          }
        >
          <AppText
            variant="bodySm"
            color={hasValue ? "primary" : "secondary"}
            style={variant === "plain" ? styles.readonlyPlainText : undefined}
          >
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

function HeaderActionButton({
  icon,
  label,
  onPress,
  variant,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <Button
      disabled={!onPress}
      label={label}
      leftIcon={<Ionicons color={variant === "primary" ? colors.inkInvert : colors.accent} name={icon} size={18} />}
      onPress={onPress}
      size="sm"
      style={styles.headerActionButton}
      variant={variant}
    />
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.playerStatItem}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} style={styles.playerStatValue} variant="bodySm">
        {value}
      </AppText>
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
    backgroundColor: colors.surface,
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
  headerActionButton: {
    flex: 1,
    minWidth: 0,
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
  playerActionsRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  playerAvatarShell: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    padding: 4,
    marginTop: -52,
    marginLeft: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerChipSectionList: {
    gap: spacing[14],
  },
  playerChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  playerCoverImage: {
    width: "100%",
    height: 112,
    backgroundColor: colors.backgroundStrong,
  },
  playerCoverOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 112,
    left: 0,
    backgroundColor: "rgba(5, 52, 94, 0.2)",
  },
  playerHeaderSurface: {
    backgroundColor: colors.surface,
  },
  playerHeroBlock: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  playerHeroContent: {
    gap: spacing[14],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[16],
  },
  playerIdentityStack: {
    gap: spacing[4],
  },
  playerInfoBlock: {
    gap: spacing[8],
  },
  playerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
  },
  playerPrimaryRole: {
    fontWeight: typography.fontWeight.bold,
  },
  playerRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[6],
  },
  playerSecondaryRole: {
    fontWeight: typography.fontWeight.semibold,
  },
  playerStatItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: spacing[4],
  },
  playerStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[10],
  },
  playerStatValue: {
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
  playerStatusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    borderRadius: radius[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[8],
    backgroundColor: colors.successSoft,
  },
  playerSummarySection: {
    gap: spacing[14],
    padding: spacing[16],
    backgroundColor: colors.surface,
  },
  readonlySurface: {
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  readonlyPlain: {
    paddingVertical: spacing[4],
  },
  readonlyPlainText: {
    lineHeight: 20,
  },
  sectionBase: {
    gap: spacing[12],
  },
  sectionCard: {
    padding: spacing[18],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionFlat: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
    paddingBottom: spacing[18],
    backgroundColor: colors.surface,
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
