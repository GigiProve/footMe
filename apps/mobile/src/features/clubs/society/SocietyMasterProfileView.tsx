/**
 * Master Profile Società (REV-PROF-17).
 *
 * Una sola superficie per Owner e Visitor. I dati pubblici sono gli stessi,
 * cambiano soltanto le azioni, e la modalità arriva dai permessi risolti dal
 * backend (`viewer.canManage`) — mai dal fatto che l'utente stia guardando il
 * proprio tab Profilo.
 *
 * Ordine della schermata, identico agli altri Master Profile: app bar (la
 * mette la route), cover, logo, identità, azioni, tab bar, contenuto. La tab
 * bar non sta sopra la cover.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, TabBar, type TabBarItem } from "../../../ui";
import { ClubMediaTabContent } from "../components/ClubMediaTabContent";
import type { PublicClubProfile } from "../club-service";
import { SocietyInfoTab } from "./SocietyInfoTab";
import { SocietyPositionsTab } from "./SocietyPositionsTab";
import { SocietyProfileHeader } from "./SocietyProfileHeader";
import { SocietyProfileTab } from "./SocietyProfileTab";
import {
  isOfficialPage,
  resolveClubCategory,
  type PositionFilter,
} from "./society-profile-model";
import type { SocietyMasterProfile } from "./society-profile-types";
import type { PublicContactType } from "../../profiles/profile-analytics";

export type SocietyTab = "profile" | "positions" | "media" | "info";

const TABS: readonly TabBarItem<SocietyTab>[] = [
  { label: "Profilo", value: "profile" },
  { label: "Posizioni", value: "positions" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

type SocietyMasterProfileViewProps = {
  activeTab: SocietyTab;
  /**
   * Il club nella forma attesa dal modulo Media condiviso. REV-PROF-17 non
   * tocca quel dominio: gli passa il club e basta.
   */
  mediaClub: PublicClubProfile;
  onContactPress: (type: PublicContactType) => void;
  onEditProfile: () => void;
  onFollowPress: () => void;
  onManagePositions: () => void;
  onMessagePress: () => void;
  onMorePress: () => void;
  onOpenAffiliate: (clubId: string) => void;
  onOpenPosition: (positionId: string) => void;
  onOpenProfile: (profileId: string) => void;
  onOpenTeam: (teamId: string) => void;
  onPositionFilterChange: (filter: PositionFilter) => void;
  onRetry?: () => void;
  onSeeAllTeams: () => void;
  onSharePress: () => void;
  onTabChange: (tab: SocietyTab) => void;
  positionFilter: PositionFilter;
  profile: SocietyMasterProfile;
  shouldOpenMediaComposer?: boolean;
};

export function SocietyMasterProfileView({
  activeTab,
  mediaClub,
  onContactPress,
  onEditProfile,
  onFollowPress,
  onManagePositions,
  onMessagePress,
  onMorePress,
  onOpenAffiliate,
  onOpenPosition,
  onOpenProfile,
  onOpenTeam,
  onPositionFilterChange,
  onRetry,
  onSeeAllTeams,
  onSharePress,
  onTabChange,
  positionFilter,
  profile,
  shouldOpenMediaComposer = false,
}: SocietyMasterProfileViewProps) {
  const { affiliates, club, positions, teams, viewer } = profile;
  const isOwner = viewer.mode === "owner";

  const metaRows = [
    club.city
      ? {
          icon: "location-outline" as const,
          key: "city",
          text: [club.city, club.province].filter(Boolean).join(" · "),
        }
      : null,
    club.stadium
      ? { icon: "business-outline" as const, key: "stadium", text: club.stadium }
      : null,
    club.foundingYear
      ? {
          icon: "calendar-outline" as const,
          key: "founded",
          text: `Fondata nel ${club.foundingYear}`,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <View style={styles.container} testID="society-master-profile">
      <SocietyProfileHeader
        actions={
          <SocietyHeaderActions
            isFollowing={viewer.isFollowing}
            isOwner={isOwner}
            onEditProfile={onEditProfile}
            onFollowPress={onFollowPress}
            onMessagePress={onMessagePress}
            onMorePress={onMorePress}
            onSharePress={onSharePress}
          />
        }
        categoryLabel={resolveClubCategory(club, teams)}
        coverUrl={club.coverUrl}
        isOfficial={isOfficialPage(club)}
        logoUrl={club.logoUrl}
        metaRows={metaRows}
        name={club.name}
      />

      <TabBar
        active={activeTab}
        items={TABS}
        onChange={onTabChange}
        testID="society-tab-bar"
      />

      <View style={styles.tabBody}>
        {activeTab === "profile" ? (
          <SocietyProfileTab
            affiliates={affiliates}
            onOpenAffiliate={onOpenAffiliate}
            onOpenTeam={onOpenTeam}
            onRetry={onRetry}
            onSeeAllTeams={onSeeAllTeams}
            teams={teams}
            viewer={viewer}
          />
        ) : activeTab === "positions" ? (
          <SocietyPositionsTab
            activeFilter={positionFilter}
            onFilterChange={onPositionFilterChange}
            onManagePositions={onManagePositions}
            onOpenPosition={onOpenPosition}
            onRetry={onRetry}
            positions={positions}
            viewer={viewer}
          />
        ) : activeTab === "media" ? (
          /*
            Modulo Media condiviso, non una galleria della Società: la CTA di
            pubblicazione, i filtri e il dettaglio contenuto sono quelli già
            esistenti, con REV-PROF-12 che tiene il bookmark fuori dalle
            thumbnail.
          */
          <ClubMediaTabContent
            club={mediaClub}
            isOwner={viewer.canPublishMedia}
            onOpenProfile={onOpenProfile}
            shouldOpenComposer={shouldOpenMediaComposer}
            viewerProfileId={viewer.profileId}
          />
        ) : (
          <SocietyInfoTab
            club={club}
            onContactPress={onContactPress}
            onRetry={onRetry}
          />
        )}
      </View>
    </View>
  );
}

type SocietyHeaderActionsProps = {
  isFollowing: boolean;
  isOwner: boolean;
  onEditProfile: () => void;
  onFollowPress: () => void;
  onMessagePress: () => void;
  onMorePress: () => void;
  onSharePress: () => void;
};

/**
 * Una sola action bar per volta: l'Owner non vede Segui o Messaggio verso la
 * propria Società, il Visitor non vede Modifica profilo. Condividi e overflow
 * restano in entrambi i casi.
 */
function SocietyHeaderActions({
  isFollowing,
  isOwner,
  onEditProfile,
  onFollowPress,
  onMessagePress,
  onMorePress,
  onSharePress,
}: SocietyHeaderActionsProps) {
  return (
    <>
      {isOwner ? (
        <Button
          label="Modifica profilo"
          onPress={onEditProfile}
          size="sm"
          testID="society-edit-profile"
          variant="primary"
        />
      ) : (
        <>
          <Button
            // Lo stato non è affidato al solo colore: cambia anche l'etichetta.
            accessibilityState={{ selected: isFollowing }}
            label={isFollowing ? "Seguito" : "Segui"}
            onPress={onFollowPress}
            size="sm"
            testID="society-follow"
            variant={isFollowing ? "secondary" : "primary"}
          />
          <Button
            label="Messaggio"
            onPress={onMessagePress}
            size="sm"
            testID="society-message"
            variant="secondary"
          />
        </>
      )}
      <IconAction
        icon="share-outline"
        label="Condividi profilo"
        onPress={onSharePress}
        testID="society-share"
      />
      <IconAction
        icon="ellipsis-horizontal"
        label="Altre azioni"
        onPress={onMorePress}
        testID="society-more"
      />
    </>
  );
}

/**
 * Azione a sola icona dell'header: stessa forma del bottone icona degli
 * altri Master Profile. L'etichetta accessibile c'e' sempre, perche'
 * un'icona senza nome non e' un'azione per chi usa uno screen reader.
 */
function IconAction({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        pressed ? styles.iconActionPressed : null,
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={20} />
    </Pressable>
  );
}

/** Skeleton con la stessa struttura del contenuto, non uno spinner centrale. */
export function SocietyProfileSkeleton() {
  return (
    <View style={styles.container} testID="society-profile-skeleton">
      <View style={styles.skeletonCover} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLogo} />
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonMeta} />
        <View style={styles.skeletonMetaShort} />
        <View style={styles.skeletonActions} />
      </View>
      <View style={styles.skeletonTabs} />
      <View style={styles.skeletonSection}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.skeletonRow} />
        ))}
      </View>
      <AppText
        accessibilityLabel="Caricamento del profilo in corso"
        style={styles.visuallyHidden}
        variant="meta"
      >
        Caricamento
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  iconAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconActionPressed: {
    opacity: 0.6,
  },
  skeletonActions: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 999,
    height: 36,
    marginTop: spacing[8],
    width: "70%",
  },
  skeletonBody: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  skeletonCover: {
    backgroundColor: colors.backgroundStrong,
    height: 150,
    width: "100%",
  },
  skeletonLogo: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 16,
    height: 84,
    marginTop: -58,
    width: 84,
  },
  skeletonMeta: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 4,
    height: 12,
    width: "60%",
  },
  skeletonMetaShort: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 4,
    height: 12,
    width: "40%",
  },
  skeletonRow: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 10,
    height: 60,
  },
  skeletonSection: {
    backgroundColor: colors.surface,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  skeletonTabs: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    height: 44,
  },
  skeletonTitle: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: 6,
    height: 24,
    width: "65%",
  },
  tabBody: {
    flex: 1,
  },
  visuallyHidden: {
    height: 0,
    opacity: 0,
  },
});
