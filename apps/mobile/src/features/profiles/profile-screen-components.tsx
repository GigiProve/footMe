import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { withDefaultProfileAvatar } from "./profile-avatar";
import { ProfileHeroHeader } from "./master/ProfileHeroHeader";
import {
  ProfileQuickFacts,
  type ProfileQuickFact,
} from "./master/ProfileQuickFacts";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Button, Input } from "../../ui";

type ProfileHeaderProps = {
  avatarUrl: string | null | undefined;
  badges?: string[];
  clubLogoUrl?: string | null;
  clubMode?: boolean;
  fullName: string;
  isEditing?: boolean;
  onEditPress?: () => void;
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

/**
 * Header del Master Profile Calciatore (REV-PROF-01 §7–§9).
 *
 * La composizione vive in `master/ProfileHeroHeader` e
 * `master/ProfileQuickFacts`: qui restano solo il mapping dei dati del
 * Calciatore e le azioni, che sono l'unica differenza fra Owner e Visitor.
 */
type PlayerProfileHeaderProps = {
  /** Riga discreta di disponibilità: "Disponibile al trasferimento · Sotto contratto". */
  availabilityLabel?: string;
  avatarUrl: string | null | undefined;
  clubLabel?: string;
  coverImageUrl?: string | null;
  fullName: string;
  locationLabel?: string;
  mode: PlayerProfileHeaderMode;
  onContactPress?: () => void;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  onSharePress?: () => void;
  isFollowed?: boolean;
  isMessaging?: boolean;
  isSaved?: boolean;
  onSavePress?: () => void;
  isShortlisted?: boolean;
  onShortlistPress?: () => void;
  primaryRole: string;
  quickFacts?: readonly ProfileQuickFact[];
  secondaryRole?: string;
};

/**
 * Header dei Master Profile a incarichi (REV-PROF-03 Allenatore, REV-PROF-06
 * Staff tecnico).
 *
 * È la stessa composizione del Calciatore — `ProfileHeroHeader` più
 * `ProfileQuickFacts` — con i dati della tipologia. Qui non c'è nessuna
 * matita su copertina e avatar, nessuna sezione Licenze e nessuna riga social:
 * l'header si ferma alle informazioni rapide, poi cominciano le tab.
 *
 * Allenatore e Staff tecnico lo usano identico: cambia solo cosa il chiamante
 * mette in `primaryRole`, `clubLabel`, `availabilityLabel` e `quickFacts`.
 */
type MasterProfileHeaderProps = {
  /** Riga discreta: "Disponibile per una nuova squadra". */
  availabilityLabel?: string;
  avatarUrl: string | null | undefined;
  /** "Torino FC · Prima Squadra", derivato dall'incarico in corso. */
  clubLabel?: string;
  coverImageUrl?: string | null;
  fullName: string;
  isFollowed?: boolean;
  isMessaging?: boolean;
  isVerified?: boolean;
  locationLabel?: string;
  mode: PlayerProfileHeaderMode;
  onEditProfilePress?: () => void;
  onFollowPress?: () => void;
  /** "Messaggio", mai "Contatta": è la stessa azione, con un nome solo. */
  onMessagePress?: () => void;
  onMorePress?: () => void;
  onSharePress?: () => void;
  primaryRole: string;
  quickFacts?: readonly ProfileQuickFact[];
  /** Prefisso dei testID: "coach-profile-header", "staff-quick-facts", ... */
  testIDPrefix: string;
};

export function PlayerProfileHeader({
  availabilityLabel,
  avatarUrl,
  clubLabel,
  coverImageUrl,
  fullName,
  locationLabel,
  mode,
  onContactPress,
  onEditProfilePress,
  onFollowPress,
  onSharePress,
  isFollowed,
  isMessaging,
  isSaved,
  onSavePress,
  isShortlisted,
  onShortlistPress,
  primaryRole,
  quickFacts = [],
  secondaryRole,
}: PlayerProfileHeaderProps) {
  const metaRows = [
    clubLabel ? { key: "club", text: clubLabel } : null,
    locationLabel
      ? { icon: "location-outline" as const, key: "location", text: locationLabel }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <View style={styles.playerHeaderSurface}>
      <ProfileHeroHeader
        actions={
          <>
            {/*
              Le azioni cambiano con il viewer, non la struttura: l'Owner non
              vede mai Segui o Messaggio verso sé stesso (§6).
            */}
            {mode === "owner" ? (
              <HeaderActionButton
                icon="create-outline"
                label="Modifica profilo"
                onPress={onEditProfilePress}
                variant="primary"
              />
            ) : (
              <VisitorHeaderActions
                isContactPending={isMessaging}
                isFollowed={isFollowed}
                isSaved={isSaved}
                isShortlisted={isShortlisted}
                onContactPress={onContactPress}
                onFollowPress={onFollowPress}
                onSavePress={onSavePress}
                onShortlistPress={onShortlistPress}
              />
            )}
            {onSharePress ? (
              <Pressable
                accessibilityLabel="Condividi profilo"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onSharePress}
                style={({ pressed }) => [
                  styles.headerSaveButton,
                  pressed ? styles.headerSavePressed : null,
                ]}
              >
                <Ionicons
                  color={colors.textSecondary}
                  name="share-outline"
                  size={20}
                />
              </Pressable>
            ) : null}
          </>
        }
        availabilityLabel={availabilityLabel}
        avatarUrl={withDefaultProfileAvatar(avatarUrl)}
        coverImageUrl={coverImageUrl}
        fullName={fullName}
        metaRows={metaRows}
        primaryRole={primaryRole}
        secondaryRole={secondaryRole}
        testID="player-profile-header"
      />

      <ProfileQuickFacts facts={quickFacts} testID="player-quick-facts" />
    </View>
  );
}

function MasterProfileHeader({
  availabilityLabel,
  avatarUrl,
  clubLabel,
  coverImageUrl,
  fullName,
  isFollowed,
  isMessaging,
  isVerified,
  locationLabel,
  mode,
  onEditProfilePress,
  onFollowPress,
  onMessagePress,
  onMorePress,
  onSharePress,
  primaryRole,
  quickFacts = [],
  testIDPrefix,
}: MasterProfileHeaderProps) {
  const metaRows = [
    clubLabel ? { key: "club", text: clubLabel } : null,
    locationLabel
      ? { icon: "location-outline" as const, key: "location", text: locationLabel }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <View style={styles.playerHeaderSurface}>
      <ProfileHeroHeader
        actions={
          <>
            {/*
              Una sola action bar per volta: l'Owner non vede mai Segui o
              Messaggio verso sé stesso, il Visitor non vede mai Modifica.
            */}
            {mode === "owner" ? (
              <HeaderActionButton
                icon="create-outline"
                label="Modifica profilo"
                onPress={onEditProfilePress}
                variant="primary"
              />
            ) : (
              <>
                {onFollowPress ? (
                  <HeaderActionButton
                    icon={isFollowed ? "checkmark" : "person-add-outline"}
                    label={isFollowed ? "Seguito" : "Segui"}
                    onPress={onFollowPress}
                    variant={isFollowed ? "secondary" : "primary"}
                  />
                ) : null}
                {onMessagePress ? (
                  <HeaderActionButton
                    icon="chatbubble-ellipses-outline"
                    label="Messaggio"
                    loading={isMessaging}
                    onPress={onMessagePress}
                    variant="secondary"
                  />
                ) : null}
              </>
            )}
            {onSharePress ? (
              <HeaderIconButton
                icon="share-outline"
                label="Condividi profilo"
                onPress={onSharePress}
              />
            ) : null}
            {onMorePress ? (
              <HeaderIconButton
                icon="ellipsis-horizontal"
                label="Altre azioni"
                onPress={onMorePress}
              />
            ) : null}
          </>
        }
        availabilityLabel={availabilityLabel}
        avatarUrl={withDefaultProfileAvatar(avatarUrl)}
        coverImageUrl={coverImageUrl}
        fullName={fullName}
        isVerified={isVerified}
        metaRows={metaRows}
        primaryRole={primaryRole}
        testID={`${testIDPrefix}-profile-header`}
      />

      <ProfileQuickFacts
        facts={quickFacts}
        testID={`${testIDPrefix}-quick-facts`}
      />
    </View>
  );
}

/** Header del Master Profile Allenatore (REV-PROF-03). */
export function CoachProfileHeader(
  props: Omit<MasterProfileHeaderProps, "testIDPrefix">,
) {
  return <MasterProfileHeader {...props} testIDPrefix="coach" />;
}

/**
 * Header del Master Profile Staff tecnico (REV-PROF-06, Screen 1).
 *
 * Nessun header dedicato: è lo stesso dell'Allenatore, con ruolo principale,
 * società e categoria attuali, località e disponibilità dello Staff tecnico.
 */
export function StaffProfileHeader(
  props: Omit<MasterProfileHeaderProps, "testIDPrefix">,
) {
  return <MasterProfileHeader {...props} testIDPrefix="staff" />;
}

/**
 * Header del Master Profile Dirigente (REV-PROF-09, Screen 1).
 *
 * Nessun header esclusivo del Dirigente: è lo stesso degli altri Master
 * Profile a incarichi, con ruolo principale, società e categoria attuali,
 * località e disponibilità del Dirigente. Owner e Visitor condividono la
 * stessa composizione e differiscono soltanto per le azioni.
 */
export function DirectorProfileHeader(
  props: Omit<MasterProfileHeaderProps, "testIDPrefix">,
) {
  return <MasterProfileHeader {...props} testIDPrefix="director" />;
}

/** Azione secondaria a sola icona dell'action bar: 44x44 di area toccabile. */
function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerSaveButton,
        pressed ? styles.headerSavePressed : null,
      ]}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={20} />
    </Pressable>
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
          {onEditPress ? (
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
          ) : null}
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

function VisitorHeaderActions({
  isContactPending,
  isFollowed,
  isSaved,
  isShortlisted,
  onContactPress,
  onFollowPress,
  onSavePress,
  onShortlistPress,
}: {
  isContactPending?: boolean;
  isFollowed?: boolean;
  isSaved?: boolean;
  isShortlisted?: boolean;
  onContactPress?: () => void;
  onFollowPress?: () => void;
  onSavePress?: () => void;
  onShortlistPress?: () => void;
}) {
  if (!onFollowPress && !onContactPress && !onSavePress && !onShortlistPress) {
    return null;
  }

  return (
    <>
      {onFollowPress ? (
        <HeaderActionButton
          icon={isFollowed ? "checkmark" : "person-add-outline"}
          label={isFollowed ? "Seguito" : "Segui"}
          onPress={onFollowPress}
          variant={isFollowed ? "secondary" : "primary"}
        />
      ) : null}
      {onContactPress ? (
        <HeaderActionButton
          icon="chatbubble-ellipses-outline"
          label="Contatta"
          loading={isContactPending}
          onPress={onContactPress}
          variant="secondary"
        />
      ) : null}
      {onSavePress ? (
        <Pressable
          accessibilityLabel={isSaved ? "Rimuovi dai salvati" : "Salva profilo"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSavePress}
          style={({ pressed }) => [
            styles.headerSaveButton,
            pressed ? styles.headerSavePressed : null,
          ]}
        >
          <Ionicons
            color={isSaved ? colors.accent : colors.textMuted}
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={20}
          />
        </Pressable>
      ) : null}
      {onShortlistPress ? (
        <Pressable
          accessibilityLabel={isShortlisted ? "Gestisci shortlist" : "Aggiungi a shortlist"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onShortlistPress}
          style={({ pressed }) => [
            styles.headerSaveButton,
            pressed ? styles.headerSavePressed : null,
          ]}
        >
          <Ionicons
            color={isShortlisted ? colors.accent : colors.textMuted}
            name={isShortlisted ? "star" : "star-outline"}
            size={20}
          />
        </Pressable>
      ) : null}
    </>
  );
}

function HeaderActionButton({
  icon,
  label,
  loading,
  onPress,
  variant,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress?: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <Button
      disabled={!onPress || loading}
      label={label}
      leftIcon={
        loading ? undefined : (
          <Ionicons color={variant === "primary" ? colors.inkInvert : colors.accent} name={icon} size={18} />
        )
      }
      loading={loading}
      onPress={onPress}
      size="sm"
      style={styles.headerActionButton}
      variant={variant}
    />
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
  coverEditButton: {
    position: "absolute",
    right: spacing[12],
    top: spacing[12],
  },
  avatarEditButton: {
    position: "absolute",
    right: -2,
    bottom: -2,
  },
  imageEditButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachAvailabilityPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    backgroundColor: colors.successSoft,
  },
  coachAvailabilityDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[10],
  },
  mutualAvatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  mutualAvatarWrap: {
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  mutualAvatarOverlap: {
    marginLeft: -10,
  },
  mutualAvatarMore: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textSecondary,
  },
  mutualText: {
    flex: 1,
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
  headerSaveButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSavePressed: {
    opacity: 0.75,
  },
  playerChipSectionList: {
    gap: spacing[14],
  },
  playerHeaderSurface: {
    backgroundColor: colors.surface,
  },
  playerSecondaryRole: {
    fontWeight: typography.fontWeight.semibold,
  },
  playerStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[10],
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
