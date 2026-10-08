/**
 * Tab Info del Master Profile Tifoso (REV-PROF-19, Screen 5).
 *
 * Tre sezioni pubbliche — squadra del cuore, interessi calcistici, categorie
 * seguite — e nient'altro. Le aree geografiche scelte in onboarding servono a
 * personalizzare feed e ricerca: non sono informazioni di profilo e non
 * arrivano nemmeno nel payload da cui questa tab legge.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileCurrentClubRow } from "../master/ProfileCurrentClubRow";
import { ProfileIconChips } from "../master/ProfileIconChips";
import { ProfileSectionBlock, ProfileSectionError } from "../master/ProfileSectionBlock";
import type { FanInterestChip } from "./fan-master-profile";
import type { FanFavoriteClub } from "./fan-public-profile-service";

type FanInfoTabProps = {
  errorMessage?: string | null;
  favoriteClub: FanFavoriteClub | null;
  followedCategories: readonly FanInterestChip[];
  footballInterests: readonly FanInterestChip[];
  isLoading: boolean;
  isOwner: boolean;
  onEditProfilePress?: () => void;
  /**
   * Gestione della squadra del cuore, solo Owner. È l'editor che esiste già:
   * REV-PROF-19 non ne scrive uno nuovo e non mette un campo inline
   * nell'header.
   */
  onManageFavoriteClub?: () => void;
  onOpenFavoriteClub?: (clubId: string) => void;
  onRetry: () => void;
};

export function FanInfoTab({
  errorMessage,
  favoriteClub,
  followedCategories,
  footballInterests,
  isLoading,
  isOwner,
  onEditProfilePress,
  onManageFavoriteClub,
  onOpenFavoriteClub,
  onRetry,
}: FanInfoTabProps) {
  if (isLoading) {
    return (
      <View
        accessible
        accessibilityLabel="Caricamento delle informazioni in corso"
        accessibilityRole="progressbar"
        style={styles.container}
        testID="fan-info-skeleton"
      >
        <View style={styles.skeletonSection}>
          <View style={[styles.skeletonLine, styles.skeletonHeading]} />
          <View style={styles.skeletonCard} />
        </View>
        <View style={styles.skeletonSection}>
          <View style={[styles.skeletonLine, styles.skeletonHeading]} />
          <View style={styles.skeletonChips}>
            <View style={styles.skeletonChip} />
            <View style={styles.skeletonChip} />
          </View>
        </View>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.container}>
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="fan-info-error"
        />
      </View>
    );
  }

  const hasAnyInfo =
    favoriteClub !== null ||
    footballInterests.length > 0 ||
    followedCategories.length > 0;

  if (!hasAnyInfo) {
    return (
      <View style={styles.empty} testID="fan-info-empty">
        <AppText variant="titleSm">Informazioni non disponibili</AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {isOwner
            ? "Non hai ancora condiviso i tuoi interessi calcistici."
            : "Questo Tifoso non ha ancora condiviso i propri interessi calcistici."}
        </AppText>
        {/*
          All'Owner l'empty state deve restare un punto di partenza: da qui si
          arriva alla gestione, non a un vicolo cieco.
        */}
        {isOwner && onManageFavoriteClub ? (
          <Button
            label="Scegli la squadra del cuore"
            onPress={onManageFavoriteClub}
            size="sm"
            variant="secondary"
          />
        ) : null}
        {isOwner && onEditProfilePress ? (
          <Button
            label="Modifica profilo"
            onPress={onEditProfilePress}
            size="sm"
            variant="secondary"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="fan-info-tab">
      {favoriteClub ? (
        <ProfileSectionBlock testID="fan-favorite-club" title="Squadra del cuore">
          <ProfileCurrentClubRow
            category={favoriteClub.subtitle ?? ""}
            clubName={favoriteClub.name}
            logoUrl={favoriteClub.logoUrl ?? ""}
            onPress={
              onOpenFavoriteClub
                ? () => onOpenFavoriteClub(favoriteClub.id)
                : undefined
            }
            role=""
            testID="fan-favorite-club-row"
          />
        </ProfileSectionBlock>
      ) : isOwner ? (
        /*
          Richiamo sobrio, e solo qui: al Visitor la sezione non esiste affatto
          e non compare nessun "Da completare".
        */
        <ProfileSectionBlock title="Squadra del cuore">
          <View style={styles.ownerHint} testID="fan-favorite-club-owner-hint">
            <AppText color="secondary" variant="bodySm">
              Non hai ancora indicato la tua squadra del cuore.
            </AppText>
            {onManageFavoriteClub ? (
              <Button
                label="Scegli la squadra del cuore"
                onPress={onManageFavoriteClub}
                size="sm"
                variant="secondary"
              />
            ) : onEditProfilePress ? (
              <Button
                label="Modifica profilo"
                onPress={onEditProfilePress}
                size="sm"
                variant="secondary"
              />
            ) : null}
          </View>
        </ProfileSectionBlock>
      ) : null}

      {footballInterests.length > 0 ? (
        <ProfileSectionBlock title="Interessi calcistici">
          <ProfileIconChips
            chips={footballInterests.map((chip) => ({
              key: chip.key,
              label: chip.label,
            }))}
            testID="fan-football-interests"
          />
        </ProfileSectionBlock>
      ) : null}

      {followedCategories.length > 0 ? (
        <ProfileSectionBlock title="Categorie seguite">
          <ProfileIconChips
            chips={followedCategories.map((chip) => ({
              key: chip.key,
              label: chip.label,
            }))}
            testID="fan-followed-categories"
          />
        </ProfileSectionBlock>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[32],
  },
  ownerHint: {
    alignItems: "flex-start",
    gap: spacing[10],
  },
  skeletonCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    height: 72,
  },
  skeletonChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    flexGrow: 1,
    height: 38,
    minWidth: 150,
  },
  skeletonChips: {
    flexDirection: "row",
    gap: spacing[8],
  },
  skeletonHeading: {
    height: 18,
    width: 160,
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 14,
  },
  skeletonSection: {
    gap: spacing[12],
  },
});
