import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius } from "../../../theme/tokens";
import { SectionCard } from "../../../ui";
import { PublicBioBlock } from "../bio-section";
import { ContactSection } from "../contact-section";
import {
  PlayerCharacteristicsSection,
} from "../player-sports-section";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  sortPlayerExperiencesBySeason,
  toPlayerExperienceForm,
} from "../player-sports";
import {
  formatBirthDateInputValue,
  formatOptionalSummary,
  getOptionLabel,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
} from "../profile-form-utils";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { ProfileField as Field } from "../profile-screen-components";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import type { GroupedExperience } from "./career-grouping";
import { CareerTabContent } from "./CareerTabContent";
import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";
import { getPlayerMediaTagMeta } from "../player-media";

type ProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onAddExperience: () => void;
  onDeleteExperience: (group: GroupedExperience) => void;
  onEdit: (section: EditSection) => void;
  onManageMedia: () => void;
};

export function ProfileTabView({
  completeProfile,
  isOwner,
  onAddExperience,
  onDeleteExperience,
  onEdit,
  onManageMedia,
}: ProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  const playerExperienceEntries = useMemo(
    () =>
      sortPlayerExperiencesBySeason(
        (completeProfile.playerCareerEntries ?? []).map((entry) =>
          toPlayerExperienceForm(entry),
        ),
      ),
    [completeProfile.playerCareerEntries],
  );

  return (
    <View style={styles.container}>
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "career" ? (
        <CareerTabContent
          entries={playerExperienceEntries}
          isOwner={isOwner}
          onAdd={onAddExperience}
          onDelete={onDeleteExperience}
          onEdit={onAddExperience}
        />
      ) : activeTab === "media" ? (
        <MediaTab
          completeProfile={completeProfile}
          isOwner={isOwner}
          onManageMedia={onManageMedia}
        />
      ) : (
        <InfoTab completeProfile={completeProfile} onEdit={onEdit} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Media tab
// ---------------------------------------------------------------------------

function MediaTab({
  completeProfile,
  isOwner,
  onManageMedia,
}: {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onManageMedia: () => void;
}) {
  const mediaItems = useMemo<MediaContentItem[]>(() => {
    const profileMediaItems = completeProfile.playerProfile?.media_items ?? [];

    if (profileMediaItems.length > 0) {
      return profileMediaItems.map((item) => {
        const tagMeta = getPlayerMediaTagMeta(item.tag);

        return {
          commentCount: 0,
          comments: [],
          description: item.description ?? "",
          id: item.id,
          isFeatured: item.is_featured,
          isLiked: false,
          isSaved: false,
          likeCount: 0,
          tag: { icon: tagMeta.icon, label: tagMeta.label },
          thumbnailUrl:
            item.thumbnail_url ??
            withDefaultProfileAvatar(completeProfile.profile.avatar_url),
          type: item.type,
          videoUrl: item.type === "video" ? item.url : undefined,
        } satisfies MediaContentItem;
      });
    }

    const highlightVideoUrl = completeProfile.playerProfile?.highlight_video_url;

    return highlightVideoUrl
      ? [
          {
            commentCount: 0,
            comments: [],
            description: "Video highlights del profilo.",
            id: "profile-highlight-video",
            isFeatured: false,
            isLiked: false,
            isSaved: false,
            likeCount: 0,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: withDefaultProfileAvatar(completeProfile.profile.avatar_url),
            type: "video",
            videoUrl: highlightVideoUrl,
          },
        ]
      : [];
  }, [
    completeProfile.playerProfile?.media_items,
    completeProfile.playerProfile?.highlight_video_url,
    completeProfile.profile.avatar_url,
  ]);

  return (
    <MediaTabContent
      authorName={completeProfile.profile.full_name}
      initialItems={mediaItems}
      mode={isOwner ? "owner" : "visitor"}
      onAddContentPress={isOwner ? onManageMedia : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Info tab
// ---------------------------------------------------------------------------

function InfoTab({
  completeProfile,
  onEdit,
}: {
  completeProfile: CompleteProfessionalProfile;
  onEdit: (section: EditSection) => void;
}) {
  return (
    <View style={styles.tabContent}>
      <SectionCard
        onEdit={() => onEdit("personalInfo")}
        title="Informazioni personali"
        variant="flat"
      >
        <Field
          label="Nome e cognome"
          value={completeProfile.profile.full_name}
          variant="plain"
        />
        <Field
          label="Data di nascita"
          value={formatBirthDateInputValue(completeProfile.profile.birth_date)}
          variant="plain"
        />
        <Field
          label="Nazionalità"
          value={
            completeProfile.profile.nationality
              ? getOptionLabel(NATIONALITY_OPTIONS, completeProfile.profile.nationality)
              : ""
          }
          variant="plain"
        />
        <Field
          label="Città"
          value={formatOptionalSummary(completeProfile.profile.city)}
          variant="plain"
        />
        <Field
          label="Regione"
          value={
            completeProfile.profile.region
              ? getOptionLabel(REGION_OPTIONS, completeProfile.profile.region)
              : ""
          }
          variant="plain"
        />
        {completeProfile.profile.languages.length > 0 ? (
          <Field
            label="Lingue parlate"
            value={completeProfile.profile.languages
              .map((code) => getOptionLabel(LANGUAGE_OPTIONS, code))
              .join(", ")}
            variant="plain"
          />
        ) : null}
      </SectionCard>

      <SectionCard
        description="Disponibilità e descrizione pubblica del profilo"
        onEdit={() => onEdit("bio")}
        title="Presentazione"
        variant="flat"
      >
        <PublicBioBlock bio={completeProfile.profile.bio} variant="plain" />
      </SectionCard>

      <SectionCard
        description="Ruolo e piede preferito leggibili rapidamente anche in consultazione."
        onEdit={() => onEdit("playerSports")}
        title="Profilo sportivo"
        variant="flat"
      >
        <PlayerCharacteristicsSection
          preferredFoot={completeProfile.playerProfile?.preferred_foot ?? ""}
          primaryPosition={
            completeProfile.playerProfile?.primary_position ??
            DEFAULT_PLAYER_PRIMARY_POSITION
          }
          secondaryPositions={
            completeProfile.playerProfile?.secondary_positions ?? []
          }
        />
      </SectionCard>

      <ContactSectionWithEdit
        completeProfile={completeProfile}
        onEdit={() => onEdit("contact")}
      />
    </View>
  );
}

function ContactSectionWithEdit({
  completeProfile,
  onEdit,
}: {
  completeProfile: CompleteProfessionalProfile;
  onEdit: () => void;
}) {
  return (
    <View>
      <ContactSection contacts={completeProfile.userContacts} variant="flat" />
      <Pressable
        accessibilityLabel="Modifica contatti"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={styles.editButton}
      >
        <Ionicons color={colors.textSecondary} name="pencil" size={16} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 18,
    width: 32,
  },
  tabContent: {
    flex: 1,
  },
});
