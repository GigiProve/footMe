import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { useSession } from "../../src/features/auth/use-session";
import {
  fetchPublicClubSquadraOverview,
  type PublicClubProfile,
  type PublicClubSquadraOverview,
} from "../../src/features/clubs/club-service";
import { getUnreadCount } from "../../src/features/clubs/notification-service";
import {
  SocietyMasterProfileView,
  SocietyProfileSkeleton,
  type SocietyTab,
} from "../../src/features/clubs/society/SocietyMasterProfileView";
import { fetchSocietyMasterProfile } from "../../src/features/clubs/society/society-profile-service";
import { buildClubShareMessage } from "../../src/features/clubs/society/society-profile-model";
import type { PositionFilter } from "../../src/features/clubs/society/society-profile-model";
import type { SocietyMasterProfile } from "../../src/features/clubs/society/society-profile-types";
import {
  fetchPendingMemberships,
  respondToMembership,
  type PendingMembership,
} from "../../src/features/clubs/membership-service";
import {
  fetchClubTeams,
  type ClubTeam,
} from "../../src/features/clubs/team-service";
import type { AppRole } from "../../src/features/onboarding/create-initial-profile";
import { EditBioModal } from "../../src/features/profiles/edit-modals/EditBioModal";
import { EditAgentMediaModal } from "../../src/features/profiles/edit-modals/EditAgentMediaModal";
import { EditClubSeasonsModal } from "../../src/features/profiles/edit-modals/EditClubSeasonsModal";
import { EditClubSportProfileModal } from "../../src/features/profiles/edit-modals/EditClubSportProfileModal";
import { EditClubAffiliationsModal } from "../../src/features/profiles/edit-modals/EditClubAffiliationsModal";
import { EditTeamsModal } from "../../src/features/profiles/edit-modals/EditTeamsModal";
import { EditCoachAchievementsModal } from "../../src/features/profiles/edit-modals/EditCoachAchievementsModal";
import { EditCoachInfoModal } from "../../src/features/profiles/edit-modals/EditCoachInfoModal";
import { EditCoachProfileModal } from "../../src/features/profiles/edit-modals/EditCoachProfileModal";
import { EditCoachMediaModal } from "../../src/features/profiles/edit-modals/EditCoachMediaModal";
import { EditContactModal } from "../../src/features/profiles/edit-modals/EditContactModal";
import { EditDirectorMediaModal } from "../../src/features/profiles/edit-modals/EditDirectorMediaModal";
import { EditPersonalInfoModal } from "../../src/features/profiles/edit-modals/EditPersonalInfoModal";
import { EditStaffInfoModal } from "../../src/features/profiles/edit-modals/EditStaffInfoModal";
import { EditStaffMediaModal } from "../../src/features/profiles/edit-modals/EditStaffMediaModal";
import { StaffProfileTabView } from "../../src/features/profiles/career/StaffProfileTabView";
import { AgentProfileTabView } from "../../src/features/profiles/career/AgentProfileTabView";
import { DirectorProfileTabView } from "../../src/features/profiles/career/DirectorProfileTabView";
import {
  buildFullUpdatePayload,
  buildAgentProfileHeaderDetails,
  buildHeaderDetails,
  buildInitialState,
  buildCoachProfileHeaderDetails,
  buildDirectorProfileHeaderDetails,
  buildPlayerProfileHeaderDetails,
  buildStaffProfileHeaderDetails,
} from "../../src/features/profiles/profile-edit-helpers";
import { validateBirthDateInput } from "../../src/features/profiles/profile-form-utils";
import {
  ProfileReadonlyView,
  type EditSection,
} from "../../src/features/profiles/ProfileReadonlyView";
import {
  AgentProfileHeader,
  CoachProfileHeader,
  DirectorProfileHeader,
  PlayerProfileHeader,
  ProfileHeader,
  StaffProfileHeader,
} from "../../src/features/profiles/profile-screen-components";
import { FanProfileView } from "../../src/features/profiles/FanProfileView";
import { MediaProfileView } from "../../src/features/profiles/MediaProfileView";
import {
  getCompleteProfessionalProfile,
  saveAgentProfileMedia,
  saveDirectorProfileMedia,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import { removeMediaFromStorage } from "../../src/features/profiles/media-upload-service";
import type { MediaLinkedTarget } from "../../src/features/profiles/career/MediaTabContent";
import { CoachProfileTabView } from "../../src/features/profiles/career/CoachProfileTabView";
import { ProfileTabView } from "../../src/features/profiles/career/ProfileTabView";
import { ProfileSkeleton } from "../../src/features/profiles/master/ProfileSkeleton";
import {
  trackPlayerProfileViewed,
  trackProfileViewed,
  trackProfileEvent,
} from "../../src/features/profiles/profile-analytics";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { ActionSheet, AppText, Button, HeaderBell, SectionCard } from "../../src/ui";

const emptyClubOverview: PublicClubSquadraOverview = {
  affiliations: [],
  parentAffiliation: null,
  positionPreview: [],
  positionsTotal: 0,
  seasonSummaries: [],
};

const MEMBER_ROLE_LABELS: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Giocatore",
  staff: "Staff",
};

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const router = useRouter();
  /**
   * `?compose=` è il punto d'ingresso del pulsante "+" della Home: la Home non
   * ospita un composer proprio, apre quello che già esiste in questa vista
   * (§2 della Home: implementare solo il punto di accesso).
   */
  const { compose, edit, tab } = useLocalSearchParams<{
    compose?: string;
    edit?: string;
    tab?: string;
  }>();
  const composeIntent =
    compose === "fan" || compose === "media" || compose === "club" ? compose : null;
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [clubTeams, setClubTeams] = useState<ClubTeam[]>([]);
  const [clubOverview, setClubOverview] =
    useState<PublicClubSquadraOverview>(emptyClubOverview);
  /*
    REV-PROF-17: il profilo pubblico della Società arriva dalla stessa RPC che
    serve la route /club/[id]. L'owner mode non viene dedotto dal fatto che
    siamo nel tab Profilo: lo decide `viewer.canManage` lato backend.
  */
  const [societyProfile, setSocietyProfile] =
    useState<SocietyMasterProfile | null>(null);
  const [activeClubTab, setActiveClubTab] = useState<SocietyTab>(
    // Arrivando dal "+" della Home la scheda contenuti è quella che ospita il
    // composer già esistente, quindi si apre direttamente su quella.
    // REV-PROF-18 usa lo stesso ingresso per la riga "Media e contenuti"
    // dell'hub, che apre il modulo Media condiviso invece di una galleria
    // specifica della Societa'.
    compose === "club" || tab === "media" ? "media" : "profile",
  );
  const [clubPositionFilter, setClubPositionFilter] =
    useState<PositionFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<EditSection | null>(null);
  const [pendingMemberships, setPendingMemberships] = useState<PendingMembership[]>([]);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [respondingMembershipId, setRespondingMembershipId] = useState<string | null>(null);
  const [agentMediaEditingItemId, setAgentMediaEditingItemId] = useState<string | null>(null);
  const [directorMediaEditingItemId, setDirectorMediaEditingItemId] = useState<string | null>(null);
  const profileId = profile?.id ?? "";
  const { data: unreadCount = 0 } = useQuery({
    enabled: !!profileId,
    queryFn: () => getUnreadCount(profileId),
    queryKey: ["notifications-unread", profileId],
  });
  const loadPendingMemberships = useCallback(async () => {
    if (!userId) {
      setPendingMemberships([]);
      return;
    }
    try {
      const data = await fetchPendingMemberships(userId);
      setPendingMemberships(data);
    } catch {
      setPendingMemberships([]);
    }
  }, [userId]);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setCompleteProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getCompleteProfessionalProfile(userId);
      setCompleteProfile(data);

      if (data.club?.id) {
        // `teams` e `overview` restano: li consumano gli editor Squadre e
        // Affiliate, che REV-PROF-17 non tocca.
        const [teams, overview, society] = await Promise.all([
          fetchClubTeams(data.club.id),
          fetchPublicClubSquadraOverview(data.club.id).catch(
            () => emptyClubOverview,
          ),
          fetchSocietyMasterProfile(data.club.id).catch(() => null),
        ]);

        setClubTeams(teams);
        setClubOverview(overview);
        setSocietyProfile(society);
      } else {
        setClubTeams([]);
        setClubOverview(emptyClubOverview);
        setSocietyProfile(null);
      }
    } catch {
      setClubTeams([]);
      setClubOverview(emptyClubOverview);
      setSocietyProfile(null);
      // Copy leggibile: niente messaggi tecnici del backend (§36).
      Alert.alert(
        "Profilo non disponibile",
        "Non è stato possibile caricare il profilo. Riprova.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
    void loadPendingMemberships();
  }, [loadProfile, loadPendingMemberships]);

  /*
    Rientro dall editor (REV-PROF-02 §P): le sezioni salvano su rotte proprie,
    quindi il Master Profile va riletto quando torna in primo piano. Il primo
    focus coincide con il mount, che ha gia caricato: saltarlo evita la doppia
    fetch all apertura della tab.
  */
  const hasLoadedOnFocus = useRef(false);
  const [profileRefreshToken, setProfileRefreshToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // REV-PROF-14: il portfolio assistiti vive dentro la tab del profilo e
      // non viene rimontato al ritorno dalla gestione. Il token lo costringe a
      // rileggere la proiezione pubblica, cosi' conteggi ed elenco non restano
      // indietro di un'operazione.
      setProfileRefreshToken((token) => token + 1);

      if (!hasLoadedOnFocus.current) {
        hasLoadedOnFocus.current = true;
        return;
      }

      void loadProfile();
    }, [loadProfile]),
  );

  async function handleRespondMembership(memberId: string, accept: boolean) {
    try {
      setRespondingMembershipId(memberId);
      await respondToMembership(memberId, accept);
      await loadPendingMemberships();
      await loadProfile();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Operazione non riuscita.";
      Alert.alert("Operazione non riuscita", message);
    } finally {
      setRespondingMembershipId(null);
    }
  }

  const headerDetails = useMemo(
    () => (completeProfile ? buildHeaderDetails(completeProfile) : null),
    [completeProfile],
  );
  const playerHeaderDetails = useMemo(
    () =>
      completeProfile ? buildPlayerProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const coachHeaderDetails = useMemo(
    () =>
      completeProfile ? buildCoachProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const agentHeaderDetails = useMemo(
    () =>
      completeProfile ? buildAgentProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const staffHeaderDetails = useMemo(
    () =>
      completeProfile ? buildStaffProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const directorHeaderDetails = useMemo(
    () =>
      completeProfile ? buildDirectorProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );

  // Una sola visualizzazione per profilo aperto (§42).
  const viewedProfilesRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || profile?.role !== "player") {
      return;
    }

    trackPlayerProfileViewed(userId, "owner", viewedProfilesRef.current);
  }, [profile?.role, userId]);

  useEffect(() => {
    const role = profile?.role;

    // REV-PROF-19: anche il Master Profile Tifoso conta un'apertura.
    if (!userId || (role !== "coach" && role !== "director" && role !== "fan")) {
      return;
    }

    trackProfileViewed(userId, {
      profileType: role,
      seen: viewedProfilesRef.current,
      source: "own_profile_tab",
      viewerMode: "owner",
    });
  }, [profile?.role, userId]);

  /*
    REV-PROF-18: l'editor della Societa' non e' piu' un modale dentro questa
    schermata, e' un hub con una rotta propria. Il deep link `?edit=clubInfo`
    — usato da "Modifica profilo" sulla rotta pubblica del proprio club —
    continua a funzionare: porta allo stesso hub invece di aprire un form che
    non esiste piu'.
  */
  const handleOpenSocietyEditor = useCallback(() => {
    router.push("/profile/society-edit" as never);
  }, [router]);

  /*
    Il parametro resta nell URL anche dopo l'apertura: senza questo segnale
    tornare indietro dall hub lo riaprirebbe in un ciclo.
  */
  const hasHandledEditParam = useRef(false);

  useEffect(() => {
    if (edit === "clubInfo" && !hasHandledEditParam.current) {
      hasHandledEditParam.current = true;
      handleOpenSocietyEditor();
    }
  }, [edit, handleOpenSocietyEditor]);

  /*
    La riga "Media e contenuti" dell hub torna su questa schermata, che di
    solito e' gia' montata: il parametro iniziale non basta a spostare la
    scheda, serve riallinearla a ogni focus.
  */
  const hasHandledTabParam = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (tab === "media" && !hasHandledTabParam.current) {
        hasHandledTabParam.current = true;
        setActiveClubTab("media");
      }
    }, [tab]),
  );

  if (!userId || !profile) {
    return null;
  }

  const role = profile.role as AppRole;

  function handleEdit(section: EditSection) {
    setActiveModal(section);
  }

  function handleCloseModal() {
    setActiveModal(null);
    setAgentMediaEditingItemId(null);
    setDirectorMediaEditingItemId(null);
  }

  async function handleSaved() {
    setActiveModal(null);
    setAgentMediaEditingItemId(null);
    setDirectorMediaEditingItemId(null);
    await Promise.all([loadProfile(), refreshProfile()]);
    Alert.alert(
      "Profilo aggiornato",
      "Le informazioni professionali sono state salvate.",
    );
  }

  function handleManageAgentMedia(itemId: string | null = null) {
    setAgentMediaEditingItemId(itemId);
    setActiveModal("agentMedia");
  }

  function handleManageDirectorMedia(itemId: string | null = null) {
    setDirectorMediaEditingItemId(itemId);
    setActiveModal("directorMedia");
  }

  /**
   * "Gestisci posizioni" apre il modulo Annunci e candidature gia' esistente
   * nella Dashboard: REV-PROF-17 fornisce il punto d'ingresso, non un secondo
   * editor.
   */
  function handleOpenClubPositions() {
    trackProfileEvent("society_manage_positions_tapped", {
      profileType: "society",
      viewerMode: "owner",
    });
    router.push("/(tabs)/announcements" as never);
  }

  function handleOpenClubTeam(teamId: string) {
    router.push(`/club/team/${teamId}` as never);
  }

  /**
   * Condivisione della propria Società: stesso payload della route pubblica —
   * nome e deep link canonico, nessun dato gestionale.
   */
  async function handleShareClub() {
    if (!societyProfile) {
      return;
    }

    trackProfileEvent("profile_share_tapped", {
      profileType: "society",
      viewerMode: societyProfile.viewer.mode,
    });

    try {
      await Share.share({
        message: buildClubShareMessage(societyProfile.club),
      });
    } catch {
      // Condivisione annullata dall'utente: non e' un errore da segnalare.
    }
  }

  function handleOpenAffiliateClub(clubId: string) {
    router.push(`/club/${clubId}` as never);
  }

  function handleOpenProfile(profileId: string) {
    router.push(`/profile/${profileId}` as never);
  }

  /** Dettaglio condiviso del contenuto: una rotta sola per ogni tipologia. */
  function handleOpenContent(ref: { contentType: string; postId: string }) {
    router.push(`/content/${ref.contentType}/${ref.postId}` as never);
  }

  function handleOpenDirectorLinkedTarget(target: MediaLinkedTarget) {
    if (target.target_type === "club") {
      router.push(`/club/${target.target_id}` as never);
      return;
    }

    router.push(`/profile/${target.target_id}` as never);
  }

  async function handleShareOwnProfile() {
    const name = completeProfile?.profile.full_name ?? "il mio profilo";

    try {
      await Share.share({
        message: `Dai un'occhiata al profilo di ${name} su ProLink.`,
      });
    } catch {
      // condivisione annullata o non disponibile: nessuna azione
    }
  }

  function handleDeleteAgentMedia(itemId: string) {
    if (!completeProfile?.agentProfile) {
      return;
    }

    if (!userId) {
      return;
    }

    const itemToDelete =
      completeProfile.agentProfile.media_items.find((item) => item.id === itemId) ?? null;

    if (!itemToDelete) {
      return;
    }

    Alert.alert(
      "Elimina contenuto",
      "Rimuovere questo contenuto dal portfolio media?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const nextItems = completeProfile.agentProfile?.media_items.filter(
                (item) => item.id !== itemId,
              ) ?? [];

              await saveAgentProfileMedia({
                agentProfile: completeProfile.agentProfile!,
                mediaItems: nextItems,
                profileId: userId,
              });

              await Promise.allSettled([removeMediaFromStorage(itemToDelete.url)]);
              await loadProfile();
              Alert.alert("Contenuto eliminato", "Il portfolio media è stato aggiornato.");
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Impossibile eliminare il contenuto.";
              Alert.alert("Errore", message);
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  function handleDeleteDirectorMedia(itemId: string) {
    if (!completeProfile?.directorProfile || !userId) {
      return;
    }

    const itemToDelete =
      completeProfile.directorProfile.media_items.find((item) => item.id === itemId) ?? null;

    if (!itemToDelete) {
      return;
    }

    Alert.alert(
      "Elimina contenuto",
      "Rimuovere questo contenuto dalla tab Media del dirigente?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const nextItems = completeProfile.directorProfile?.media_items.filter(
                (item) => item.id !== itemId,
              ) ?? [];

              await saveDirectorProfileMedia({
                directorProfile: completeProfile.directorProfile!,
                mediaItems: nextItems,
                profileId: userId,
              });

              await Promise.allSettled([removeMediaFromStorage(itemToDelete.url)]);
              await loadProfile();
              Alert.alert("Contenuto eliminato", "La tab Media e' stata aggiornata.");
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Impossibile eliminare il contenuto.";
              Alert.alert("Errore", message);
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  async function handleToggleDirectorMediaFeatured(itemId: string) {
    if (!completeProfile?.directorProfile || !userId) {
      return;
    }

    const nextItems = completeProfile.directorProfile.media_items.map((item) =>
      item.id === itemId ? { ...item, is_featured: !item.is_featured } : item,
    );

    try {
      await saveDirectorProfileMedia({
        directorProfile: completeProfile.directorProfile,
        mediaItems: nextItems,
        profileId: userId,
      });
      await loadProfile();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile aggiornare l'evidenza.";
      Alert.alert("Errore", message);
    }
  }

  return (
    // REV-PROF-09: il Dirigente non ha piu' una superficie propria. Usa la
    // stessa dei Master Profile gia' approvati, come ogni altra tipologia.
    <SafeAreaView style={styles.screen}>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileTopBar}>
          <HeaderBell
            count={unreadCount}
            onPress={() => router.push("/notifications" as never)}
          />
          <Pressable
            accessibilityLabel="Le tue raccolte: Salvati e Seguiti"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setMoreMenuVisible(true)}
            style={({ pressed }) => [
              styles.moreButton,
              pressed ? styles.moreButtonPressed : null,
            ]}
          >
            <Ionicons
              color={colors.textPrimary}
              name="ellipsis-horizontal"
              size={22}
            />
          </Pressable>
        </View>
        <ActionSheet
          actions={[
            /*
              REV-PROF-03: l'header dell'Allenatore non porta piu' la riga
              social, cosi' follower e connessioni restano raggiungibili da qui
              invece di sparire dal prodotto.
            */
            ...(role === "coach" && profileId
              ? [
                  {
                    icon: "people-circle-outline" as const,
                    label: "Follower e connessioni",
                    subtitle: "Chi ti segue e chi segui.",
                    onPress: () =>
                      router.push(
                        `/profile/connections?profileId=${profileId}&mode=followers` as never,
                      ),
                  },
                  /*
                    Il palmares non ha una sezione dentro "Modifica profilo" e
                    le matite nelle sezioni pubbliche sono state rimosse: il suo
                    editor esistente resta raggiungibile da qui finche' la
                    revisione del flusso di modifica non lo assorbe.
                  */
                  {
                    icon: "trophy-outline" as const,
                    label: "Gestisci palmares",
                    subtitle: "Titoli e riconoscimenti del tuo profilo.",
                    onPress: () => handleEdit("coachAchievements"),
                  },
                ]
              : []),
            /*
              REV-PROF-09: nemmeno l'header del Dirigente porta una riga
              social, quindi follower e connessioni restano raggiungibili da
              qui come per l'Allenatore.
            */
            ...(role === "director" && profileId
              ? [
                  {
                    icon: "people-circle-outline" as const,
                    label: "Follower e connessioni",
                    subtitle: "Chi ti segue e chi segui.",
                    onPress: () =>
                      router.push(
                        `/profile/connections?profileId=${profileId}&mode=followers` as never,
                      ),
                  },
                ]
              : []),
            {
              icon: "bookmark-outline",
              label: "Salvati",
              subtitle: "Solo tu puoi vedere ciò che salvi.",
              onPress: () => router.push("/saved" as never),
            },
            {
              icon: "people-outline",
              label: "Seguiti",
              subtitle: "I profili che segui.",
              onPress: () => router.push("/following" as never),
            },
            {
              icon: "settings-outline",
              label: "Impostazioni",
              subtitle: "Preferenze e account",
              onPress: () => router.push("/settings" as never),
            },
          ]}
          onClose={() => setMoreMenuVisible(false)}
          title="Le tue raccolte"
          visible={moreMenuVisible}
        />
        {pendingMemberships.length > 0 ? (
          <SectionCard
            description="Conferma se vuoi unirti a queste rose."
            title="Richieste"
            variant="flat"
          >
            <View style={styles.pendingList}>
              {pendingMemberships.map((membership) => (
                <View key={membership.id} style={styles.pendingItem}>
                  <View style={styles.pendingInfo}>
                    <AppText variant="bodySm">
                      {membership.club_name ?? "Una societa'"}
                      {membership.team_name ? ` · ${membership.team_name}` : ""}
                    </AppText>
                    <AppText color="secondary" variant="caption">
                      {MEMBER_ROLE_LABELS[membership.member_role] ??
                        membership.member_role}
                    </AppText>
                  </View>
                  <View style={styles.pendingActions}>
                    <Button
                      disabled={respondingMembershipId === membership.id}
                      label="Accetta"
                      onPress={() =>
                        handleRespondMembership(membership.id, true)
                      }
                      size="sm"
                    />
                    <Button
                      disabled={respondingMembershipId === membership.id}
                      label="Rifiuta"
                      onPress={() =>
                        handleRespondMembership(membership.id, false)
                      }
                      size="sm"
                      variant="outline"
                    />
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}
        {completeProfile && role === "club_admin" && completeProfile.club ? (
          /*
            Stessa vista della route pubblica: owner e visitor leggono gli
            stessi dati, e le differenze stanno solo nelle azioni. Finché la
            RPC non ha risposto si mostra lo scheletro, non una versione
            diversa della pagina.
          */
          societyProfile ? (
            <SocietyMasterProfileView
              activeTab={activeClubTab}
              mediaClub={toPublicClubProfile(completeProfile.club)}
              onContactPress={(contactType) =>
                trackProfileEvent("public_contact_tapped", {
                  contactType,
                  profileType: "society",
                  viewerMode: societyProfile.viewer.mode,
                })
              }
              onEditProfile={handleOpenSocietyEditor}
              onFollowPress={() => undefined}
              onManagePositions={handleOpenClubPositions}
              onMessagePress={() => undefined}
              onMorePress={() => setMoreMenuVisible(true)}
              onOpenAffiliate={handleOpenAffiliateClub}
              onOpenPosition={(positionId) =>
                router.push(`/position/${positionId}` as never)
              }
              onOpenProfile={handleOpenProfile}
              onOpenTeam={handleOpenClubTeam}
              onPositionFilterChange={setClubPositionFilter}
              onSeeAllTeams={() =>
                router.push(
                  `/club/${societyProfile.club.id}/teams` as never,
                )
              }
              onSharePress={() => void handleShareClub()}
              onTabChange={setActiveClubTab}
              positionFilter={clubPositionFilter}
              profile={societyProfile}
              shouldOpenMediaComposer={composeIntent === "club"}
            />
          ) : (
            <SocietyProfileSkeleton />
          )
        ) : completeProfile && role === "player" && playerHeaderDetails ? (
          <PlayerProfileHeader
            availabilityLabel={playerHeaderDetails.availabilityLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            clubLabel={playerHeaderDetails.clubLabel}
            coverImageUrl={completeProfile.profile.cover_url}
            fullName={playerHeaderDetails.fullName}
            locationLabel={playerHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "player",
                viewerMode: "owner",
              });
              trackProfileEvent("player_profile_edit_opened", {
                profileType: "player",
                viewerMode: "owner",
              });
              // REV-PROF-02 §E: la CTA apre l hub modulare, non piu il form unico.
              router.push("/profile/edit");
            }}
            primaryRole={playerHeaderDetails.primaryRole}
            quickFacts={playerHeaderDetails.quickFacts}
            secondaryRole={playerHeaderDetails.secondaryRole}
          />
        ) : completeProfile && role === "coach" && coachHeaderDetails ? (
          <CoachProfileHeader
            availabilityLabel={coachHeaderDetails.availabilityLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            clubLabel={coachHeaderDetails.clubLabel}
            coverImageUrl={completeProfile.profile.cover_url}
            fullName={coachHeaderDetails.fullName}
            isVerified={coachHeaderDetails.isVerified}
            locationLabel={coachHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "coach",
                viewerMode: "owner",
              });
              // REV-PROF-05: la CTA apre l hub modulare, non piu la modale.
              router.push("/profile/coach-edit");
            }}
            onMorePress={() => {
              trackProfileEvent("profile_more_menu_opened", {
                profileType: "coach",
                viewerMode: "owner",
              });
              setMoreMenuVisible(true);
            }}
            onSharePress={() => {
              trackProfileEvent("profile_share_tapped", {
                profileType: "coach",
                viewerMode: "owner",
              });
              void handleShareOwnProfile();
            }}
            primaryRole={coachHeaderDetails.primaryRole}
            quickFacts={coachHeaderDetails.quickFacts}
          />
        ) : completeProfile && role === "staff" && staffHeaderDetails ? (
          <StaffProfileHeader
            availabilityLabel={staffHeaderDetails.availabilityLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            clubLabel={staffHeaderDetails.clubLabel}
            coverImageUrl={completeProfile.profile.cover_url}
            fullName={staffHeaderDetails.fullName}
            isVerified={staffHeaderDetails.isVerified}
            locationLabel={staffHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "staff",
                viewerMode: "owner",
              });
              // REV-PROF-08: la CTA apre l hub modulare, non piu la modale.
              router.push("/profile/staff-edit");
            }}
            onMorePress={() => {
              trackProfileEvent("profile_more_menu_opened", {
                profileType: "staff",
                viewerMode: "owner",
              });
              setMoreMenuVisible(true);
            }}
            onSharePress={() => {
              trackProfileEvent("profile_share_tapped", {
                profileType: "staff",
                viewerMode: "owner",
              });
              void handleShareOwnProfile();
            }}
            primaryRole={staffHeaderDetails.primaryRole}
            quickFacts={staffHeaderDetails.quickFacts}
          />
        ) : completeProfile && role === "agent" && agentHeaderDetails ? (
          <AgentProfileHeader
            availabilityLabel={agentHeaderDetails.availabilityLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            badges={agentHeaderDetails.badges}
            clubLabel={agentHeaderDetails.clubLabel}
            coverImageUrl={completeProfile.profile.cover_url}
            fullName={agentHeaderDetails.fullName}
            isVerified={agentHeaderDetails.isVerified}
            locationLabel={agentHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "agent",
                viewerMode: "owner",
              });
              // REV-PROF-16: hub modulare, non più la modale anagrafica.
              router.push("/profile/agent-edit");
            }}
            onMorePress={() => {
              trackProfileEvent("profile_more_menu_opened", {
                profileType: "agent",
                viewerMode: "owner",
              });
              setMoreMenuVisible(true);
            }}
            onSharePress={() => {
              trackProfileEvent("profile_share_tapped", {
                profileType: "agent",
                viewerMode: "owner",
              });
              void handleShareOwnProfile();
            }}
            primaryRole={agentHeaderDetails.primaryRole}
            quickFacts={agentHeaderDetails.quickFacts}
          />
        ) : completeProfile && role === "director" && directorHeaderDetails ? (
          <DirectorProfileHeader
            availabilityLabel={directorHeaderDetails.availabilityLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            clubLabel={directorHeaderDetails.clubLabel}
            coverImageUrl={completeProfile.profile.cover_url}
            fullName={directorHeaderDetails.fullName}
            isVerified={directorHeaderDetails.isVerified}
            locationLabel={directorHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "director",
                viewerMode: "owner",
              });
              // REV-PROF-11: hub modulare, non più la modale anagrafica.
              router.push("/profile/director-edit");
            }}
            onMorePress={() => {
              trackProfileEvent("profile_more_menu_opened", {
                profileType: "director",
                viewerMode: "owner",
              });
              setMoreMenuVisible(true);
            }}
            onSharePress={() => {
              trackProfileEvent("profile_share_tapped", {
                profileType: "director",
                viewerMode: "owner",
              });
              void handleShareOwnProfile();
            }}
            primaryRole={directorHeaderDetails.primaryRole}
            quickFacts={directorHeaderDetails.quickFacts}
          />
        ) : completeProfile && (role === "fan" || role === "media") ? null : completeProfile && headerDetails ? (
          <ProfileHeader
            avatarUrl={completeProfile.profile.avatar_url}
            badges={headerDetails.badges}
            clubLogoUrl={completeProfile.club?.logo_url}
            clubMode={role === "club_admin"}
            fullName={headerDetails.fullName}
            onEditPress={() => handleEdit("bio")}
            primaryMeta={headerDetails.primaryMeta}
            secondaryMeta={headerDetails.secondaryMeta}
          />
        ) : null}

        {isLoading ? (
          role === "coach" || role === "staff" || role === "director" ? (
            /*
              Scheletro al posto del testo di attesa (REV-PROF-03, "Loading"):
              l'ingombro e' gia' quello della pagina finale, quindi l'arrivo dei
              dati non sposta niente.
            */
            <ProfileSkeleton testID={`${role}-profile-loading-skeleton`} />
          ) : (
            <AppText variant="bodySm" color="secondary">
              Sto recuperando i dati professionali del tuo account...
            </AppText>
          )
        ) : completeProfile && role === "player" ? (
          <ProfileTabView
            completeProfile={completeProfile}
            isOwner
            onManageMedia={() => router.push("/profile/edit/media")}
          />
        ) : completeProfile && role === "coach" ? (
          <CoachProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onAddExperience={() => router.push("/profile/coach-career")}
            onManageMedia={() => router.push("/profile/coach-edit/media")}
            onOpenClub={handleOpenAffiliateClub}
          />
        ) : completeProfile && role === "staff" ? (
          <StaffProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onAddExperience={() => router.push("/profile/staff-career")}
            onManageAdditionalPaths={() =>
              router.push("/profile/staff-career?section=paths")
            }
            onManageMedia={() => handleEdit("staffMedia")}
            onOpenClub={handleOpenAffiliateClub}
          />
        ) : completeProfile && role === "agent" ? (
          <AgentProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            /*
              REV-PROF-15: "Aggiungi esperienza" apre la gestione carriera, non
              l'editor di profilo. È l'unico modulo che scrive la carriera, e
              tutti gli entry point passano di lì.
            */
            onAddExperience={() => router.push("/profile/agent-career" as never)}
            onDeleteMedia={handleDeleteAgentMedia}
            onEditMedia={(itemId) => handleManageAgentMedia(itemId)}
            // REV-PROF-16: stesso hub della CTA nell'header.
            onEditProfile={() => router.push("/profile/agent-edit")}
            onManageAssistiti={() =>
              router.push("/representation/hub?source=profile" as never)
            }
            onManageMedia={() => router.push("/profile/agent-edit/media")}
            onOpenAllAssistiti={() =>
              router.push(`/representation/portfolio/${profileId}` as never)
            }
            onOpenAssistito={handleOpenProfile}
            refreshToken={profileRefreshToken}
          />
        ) : completeProfile && role === "director" ? (
          <DirectorProfileTabView
            completeProfile={completeProfile}
            isOwner
            onAddExperience={() => router.push("/profile/director-career")}
            onDeleteMedia={handleDeleteDirectorMedia}
            onEditMedia={(itemId) => handleManageDirectorMedia(itemId)}
            // REV-PROF-11: stesso hub della CTA nell'header.
            onEditProfile={() => router.push("/profile/director-edit")}
            onManageAdditionalPaths={() =>
              router.push("/profile/director-career?section=paths")
            }
            onManageMedia={() => handleManageDirectorMedia()}
            onOpenClub={handleOpenAffiliateClub}
            onOpenLinkedTarget={handleOpenDirectorLinkedTarget}
            onToggleMediaFeatured={handleToggleDirectorMediaFeatured}
          />
        ) : completeProfile && role === "fan" ? (
          /*
            REV-PROF-19: il Master Profile Tifoso porta header e tre tab. Le
            azioni della testata — Condividi, menu azioni, Modifica profilo —
            restano quelle della schermata.
          */
          <FanProfileView
            completeProfile={completeProfile}
            mode="owner"
            onEditProfilePress={() => {
              trackProfileEvent("profile_edit_tapped", {
                profileType: "fan",
                viewerMode: "owner",
              });
              /*
                REV-PROF-20 non esiste ancora: durante la transizione la CTA
                apre la rotta corrente, cioè la modale anagrafica già usata
                dal Tifoso. Nessun form nuovo è stato scritto qui.
              */
              handleEdit("personalInfo");
            }}
            onMorePress={() => {
              trackProfileEvent("profile_more_menu_opened", {
                profileType: "fan",
                viewerMode: "owner",
              });
              setMoreMenuVisible(true);
            }}
            onOpenContent={handleOpenContent}
            onOpenFavoriteClub={handleOpenAffiliateClub}
            onSharePress={() => {
              trackProfileEvent("profile_share_tapped", {
                profileType: "fan",
                viewerMode: "owner",
              });
              void handleShareOwnProfile();
            }}
            shouldOpenComposer={composeIntent === "fan"}
            viewerProfileId={userId}
          />
        ) : completeProfile && role === "media" ? (
          <MediaProfileView
            completeProfile={completeProfile}
            mode="owner"
            onOpenClub={handleOpenAffiliateClub}
            onOpenProfile={handleOpenProfile}
            shouldOpenComposer={composeIntent === "media"}
            viewerProfileId={userId}
          />
        ) : completeProfile && role === "club_admin" ? null : completeProfile ? (
          <ProfileReadonlyView
            completeProfile={completeProfile}
            onEdit={handleEdit}
            role={role}
          />
        ) : null}
        {/*
          REV-PROF-01 §5: il Master Profile finisce con le tab. "Salvati" e
          "Seguiti" sono aree personali con una schermata propria e restano
          raggiungibili dal menu "..." qui sopra, non in coda al profilo.
        */}
      </KeyboardAwareForm>

      {/* Per-section edit modals */}
      {completeProfile && userId ? (
        <>
          <EditPersonalInfoModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "personalInfo"}
          />
          <EditBioModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "bio"}
          />
          <EditContactModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "contact"}
          />
          {/*
            REV-PROF-02: il Calciatore non ha piu editor a modal. Tutte le sue
            sezioni vivono sotto /profile/edit, una rotta per sezione, e il
            vecchio form unico e stato rimosso invece di restare in parallelo.
          */}
          {role === "coach" ? (
            <>
              <EditCoachProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "editCoachProfile"}
              />
              <EditCoachInfoModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "coachInfo"}
              />
              <EditCoachMediaModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "coachMedia"}
              />
              <EditCoachAchievementsModal
                achievements={completeProfile.coachProfile?.achievements ?? []}
                coachProfileId={completeProfile.coachProfile?.profile_id ?? ""}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                visible={activeModal === "coachAchievements"}
              />
            </>
          ) : null}
          {role === "staff" ? (
            <>
              <EditStaffInfoModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "staffInfo"}
              />
              <EditStaffMediaModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "staffMedia"}
              />
            </>
          ) : null}
          {role === "agent" ? (
            /*
              REV-PROF-16: la modale anagrafica del Procuratore non esiste
              piu'. Scriveva agenzia, ruolo e attivita' a mano, cioe' proprio
              i campi che ora derivano dalla carriera e dal modulo "Attivita'
              e mercati". Resta solo l'editor di contenuto.
            */
            <EditAgentMediaModal
              completeProfile={completeProfile}
              editingItemId={agentMediaEditingItemId}
              onClose={handleCloseModal}
              onSaved={handleSaved}
              userId={userId}
              visible={activeModal === "agentMedia"}
            />
          ) : null}
          {role === "director" ? (
            <EditDirectorMediaModal
              completeProfile={completeProfile}
              editingItemId={directorMediaEditingItemId}
              onClose={handleCloseModal}
              onSaved={handleSaved}
              userId={userId}
              visible={activeModal === "directorMedia"}
            />
          ) : null}
          {role === "club_admin" ? (
            <>
              <EditClubSeasonsModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "clubSeasons"}
              />
              <EditClubSportProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "clubSportProfile"}
              />
              {completeProfile.club ? (
                <>
                  <EditTeamsModal
                    clubId={completeProfile.club.id}
                    clubName={completeProfile.club.name}
                    onClose={handleCloseModal}
                    onSaved={handleSaved}
                    teams={clubTeams}
                    visible={activeModal === "clubTeams"}
                  />
                  <EditClubAffiliationsModal
                    clubId={completeProfile.club.id}
                    initialAffiliations={clubOverview.affiliations}
                    onClose={handleCloseModal}
                    onSaved={handleSaved}
                    visible={activeModal === "clubAffiliations"}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}

function toPublicClubProfile(
  club: NonNullable<CompleteProfessionalProfile["club"]>,
): PublicClubProfile {
  return {
    category: club.category,
    city: club.city,
    club_colors: club.club_colors,
    club_email: club.club_email,
    club_phone: club.club_phone,
    country: club.country,
    description: club.description,
    field_address: club.field_address,
    founding_year: club.founding_year,
    gallery_urls: club.gallery_urls,
    headquarters_address: club.headquarters_address,
    id: club.id,
    key_results: club.key_results,
    league: club.league,
    logo_url: club.logo_url,
    name: club.name,
    owner_full_name: null,
    owner_profile_id: null,
    region: club.region,
    sports_focus: club.sports_focus,
    stadium: club.stadium,
    top_level_reached: club.top_level_reached,
    verification_status: club.verification_status,
    website_url: club.website_url,
  };
}

const styles = StyleSheet.create({
  profileTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreButtonPressed: {
    opacity: 0.7,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    backgroundColor: colors.background,
    paddingBottom: 0,
  },
  pendingList: {
    gap: spacing[12],
  },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  pendingInfo: {
    flex: 1,
    gap: spacing[4],
  },
  pendingActions: {
    flexDirection: "row",
    gap: spacing[8],
  },
});
