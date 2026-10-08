/**
 * Squadra del cuore (REV-PROF-20, schermata 3).
 *
 * Una sola squadra, e deve essere un'entità: la ricerca propone società
 * canoniche e il testo libero non è una scelta valida. Nel profilo viene
 * salvato l'identificativo — denominazione, logo e categoria restano
 * dell'entità e si rileggono da lì a ogni apertura, così una società che
 * cambia categoria non lascia una copia vecchia dentro il profilo di chi la
 * tifa.
 *
 * Tre cose che questa schermata **non** fa, per scelta:
 *
 *  - non segue e non smette di seguire nessuno. Squadra del cuore e follow
 *    sono relazioni diverse, e cambiare la prima non tocca la seconda;
 *  - non crea una società quando la ricerca non trova nulla;
 *  - non pubblica niente prima della CTA. Selezione, cambio, rimozione e
 *    toggle vivono nella bozza finché "Salva modifiche" non conferma.
 *
 * Il toggle resta spento e non attivabile senza una relazione valida: una
 * visibilità accesa senza valore non ha significato, e il database la spegne
 * comunque.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, SearchField } from "../../../../ui";
import { InfoMessage, ToggleRow } from "../../../onboarding/ui";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { trackProfileEvent } from "../../profile-analytics";
import { fanFavoriteClubQueryKey } from "../FanProfileEditHubScreen";
import {
  FAN_CLUB_SEARCH_MIN_LENGTH,
  fetchFanFavoriteClub,
  searchFanFavoriteClubs,
  type FanFavoriteClubOption,
} from "../fan-favorite-club-service";
import {
  describeFanSaveError,
  FAN_LOAD_ERROR_MESSAGE,
  FanProfileConflictError,
  useCompleteProfileQuery,
  useFanSectionSave,
} from "../fan-profile-edit-service";
import { useFanEditorGuard } from "../use-fan-editor-guard";

const SEARCH_DEBOUNCE_MS = 300;

const UNAVAILABLE_CLUB_MESSAGE =
  "Questa squadra non è più disponibile. Scegline un'altra.";

type SearchState = {
  error: string | null;
  isLoading: boolean;
  results: FanFavoriteClubOption[];
};

const IDLE_SEARCH: SearchState = {
  error: null,
  isLoading: false,
  results: [],
};

export function FanFavoriteClubScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useFanSectionSave(userId);
  const data = profileQuery.data;

  const savedClubId = data?.fanProfile?.favorite_club_id ?? null;
  const savedIsPublic = data?.fanProfile?.favorite_club_is_public ?? false;

  /*
    La società salvata viene riletta dall'entità canonica, non ricostruita da
    una copia nel profilo. `null` dopo il caricamento significa che la
    relazione non porta più da nessuna parte: eliminata, sospesa, rifiutata.
  */
  const savedClubQuery = useQuery({
    enabled: Boolean(savedClubId),
    queryFn: () => fetchFanFavoriteClub(savedClubId as string),
    queryKey: fanFavoriteClubQueryKey(savedClubId),
  });

  const [draftClub, setDraftClub] = useState<FanFavoriteClubOption | null>(null);
  const [draftRemoved, setDraftRemoved] = useState(false);
  const [draftIsPublic, setDraftIsPublic] = useState<boolean | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>(IDLE_SEARCH);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const savedClub = savedClubQuery.data ?? null;
  const club = draftRemoved ? null : (draftClub ?? savedClub);
  const clubId = draftRemoved ? null : (draftClub?.id ?? savedClubId);
  const isPublic = Boolean(clubId) && (draftIsPublic ?? savedIsPublic);

  const isDirty =
    clubId !== savedClubId || isPublic !== (savedIsPublic && Boolean(savedClubId));

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "fan",
          section: "favoriteClub",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  /*
    Ricerca con debounce e scarto delle risposte obsolete: la query corrente è
    l'unica che può scrivere nello stato, così una risposta lenta non
    sovrascrive i risultati di una ricerca più recente.
  */
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < FAN_CLUB_SEARCH_MIN_LENGTH) {
      requestId.current += 1;
      setSearch(IDLE_SEARCH);
      return undefined;
    }

    const current = (requestId.current += 1);
    setSearch((previous) => ({ ...previous, error: null, isLoading: true }));

    const timer = setTimeout(() => {
      searchFanFavoriteClubs(trimmed)
        .then((results) => {
          if (current !== requestId.current) {
            return;
          }

          setSearch({ error: null, isLoading: false, results });

          if (results.length === 0) {
            trackProfileEvent("fan_favorite_club_search_empty", {
              profileType: "fan",
              section: "favoriteClub",
            });
          }
        })
        .catch(() => {
          if (current !== requestId.current) {
            return;
          }

          setSearch({
            error: "Non è stato possibile cercare le squadre. Riprova.",
            isLoading: false,
            results: [],
          });
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const openSearch = useCallback(() => {
    setIsSearching(true);
    setQuery("");
    setSearch(IDLE_SEARCH);
    trackProfileEvent("fan_favorite_club_search_opened", {
      profileType: "fan",
      section: "favoriteClub",
    });
  }, []);

  function handleSelect(option: FanFavoriteClubOption) {
    const isChange = Boolean(clubId) && clubId !== option.id;

    setDraftClub(option);
    setDraftRemoved(false);
    setIsSearching(false);
    setQuery("");
    setSearch(IDLE_SEARCH);
    setErrorMessage(null);
    trackProfileEvent(
      isChange ? "fan_favorite_club_changed" : "fan_favorite_club_selected",
      { profileType: "fan", section: "favoriteClub" },
    );
  }

  function handleRemove() {
    Alert.alert(
      "Rimuovere la squadra del cuore?",
      "La squadra non comparirà più nel tuo profilo.",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: () => {
            setDraftClub(null);
            setDraftRemoved(true);
            setDraftIsPublic(false);
            setIsSearching(false);
            setErrorMessage(null);
            trackProfileEvent("fan_favorite_club_removed", {
              profileType: "fan",
              section: "favoriteClub",
            });
          },
          style: "destructive",
          text: "Rimuovi",
        },
      ],
    );
  }

  function handleSave() {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          kind: "favoriteClub",
          value: {
            favorite_club_id: clubId,
            favorite_club_is_public: isPublic,
            /*
              La stringa del vecchio flusso era *questa* relazione: rimuovere
              la squadra e lasciarla in piedi la farebbe ricomparire. Negli
              altri salvataggi non viene nominata, così un dato storico non si
              perde per un salvataggio che non lo riguarda.
            */
            ...(clubId ? {} : { favorite_team_name: null }),
          },
        },
      },
      {
        onError: (error) => {
          if (error instanceof FanProfileConflictError) {
            trackProfileEvent("fan_profile_edit_conflict", {
              profileType: "fan",
              section: "favoriteClub",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "fan",
            section: "favoriteClub",
            success: false,
          });
          setErrorMessage(describeFanSaveError(error));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "fan",
            section: "favoriteClub",
            success: true,
          });
          setDraftClub(null);
          setDraftRemoved(false);
          setDraftIsPublic(null);
          router.back();
        },
      },
    );
  }

  const isLoadingClub = Boolean(savedClubId) && savedClubQuery.isPending;
  const showsUnavailableNotice =
    Boolean(savedClubId) &&
    savedClubQuery.isSuccess &&
    savedClub === null &&
    !draftClub &&
    !draftRemoved;

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data ? handleSave : undefined}
      saveDisabled={!isDirty}
      saving={save.isPending}
      testID="fan-profile-edit-favorite-club"
      title="Squadra del cuore"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={3} testID="fan-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={FAN_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="fan-edit-error"
        />
      ) : null}

      {data ? (
        <View style={styles.content}>
          <AppText color="secondary" variant="bodySm">
            Scegli la squadra che tifi e decidi se mostrarla nel profilo.
          </AppText>

          {showsUnavailableNotice ? (
            <InfoMessage
              message={UNAVAILABLE_CLUB_MESSAGE}
              testID="fan-favorite-club-unavailable"
              tone="warning"
            />
          ) : null}

          {club && !isSearching ? (
            <SelectedClubCard club={club} onChange={openSearch} />
          ) : (
            <ClubSearch
              onQueryChange={setQuery}
              onSelect={handleSelect}
              query={query}
              selectedClubId={clubId}
              state={search}
            />
          )}

          {isLoadingClub ? (
            <ProfileEditFieldsSkeleton
              rows={1}
              testID="fan-favorite-club-skeleton"
            />
          ) : null}

          <ToggleRow
            description="La squadra sarà visibile nella tab Info."
            disabled={!clubId}
            label="Mostra nel profilo"
            onValueChange={(value) => {
              setDraftIsPublic(value);
              trackProfileEvent("fan_visibility_changed", {
                profileType: "fan",
                section: "favoriteClub",
                visible: value,
              });
            }}
            testID="fan-favorite-club-visibility"
            value={isPublic}
          />

          {clubId ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleRemove}
              style={styles.removeAction}
              testID="fan-favorite-club-remove"
            >
              <AppText color="danger" variant="actionLabel">
                Rimuovi squadra
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ProfileEditScaffold>
  );
}

function SelectedClubCard({
  club,
  onChange,
}: {
  club: FanFavoriteClubOption;
  onChange: () => void;
}) {
  return (
    <View
      accessibilityLabel={`${club.name}, selezionata`}
      accessibilityState={{ selected: true }}
      accessible
      style={styles.selectedCard}
      testID="fan-favorite-club-card"
    >
      <ClubLogo logoUrl={club.logoUrl} />
      <View style={styles.cardText}>
        <AppText numberOfLines={2} variant="titleSm">
          {club.name}
        </AppText>
        {club.subtitle ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {club.subtitle}
          </AppText>
        ) : null}
        <Pressable
          accessibilityLabel="Cambia squadra del cuore"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onChange}
          testID="fan-favorite-club-change"
        >
          <AppText color="accent" variant="actionLabel">
            Cambia
          </AppText>
        </Pressable>
      </View>
      {/* Lo stato selezionato non si affida al solo colore: c'è la spunta. */}
      <Ionicons color={colors.accent} name="checkmark-circle" size={22} />
    </View>
  );
}

function ClubSearch({
  onQueryChange,
  onSelect,
  query,
  selectedClubId,
  state,
}: {
  onQueryChange: (value: string) => void;
  onSelect: (option: FanFavoriteClubOption) => void;
  query: string;
  selectedClubId: string | null;
  state: SearchState;
}) {
  const hasQuery = query.trim().length >= FAN_CLUB_SEARCH_MIN_LENGTH;

  return (
    <View style={styles.search}>
      <SearchField
        onChangeText={onQueryChange}
        placeholder="Cerca una squadra"
        testID="fan-favorite-club-search"
        value={query}
      />

      {state.error ? (
        <AppText accessibilityLiveRegion="polite" color="danger" variant="bodySm">
          {state.error}
        </AppText>
      ) : null}

      {state.isLoading ? (
        <ProfileEditFieldsSkeleton
          rows={2}
          testID="fan-favorite-club-search-skeleton"
        />
      ) : null}

      {hasQuery && !state.isLoading && !state.error && state.results.length === 0 ? (
        <View style={styles.empty} testID="fan-favorite-club-search-empty">
          <AppText variant="titleSm">Nessuna squadra trovata</AppText>
          <AppText color="secondary" variant="bodySm">
            Prova con un altro nome.
          </AppText>
        </View>
      ) : null}

      {state.results.map((option) => (
        <Pressable
          accessibilityLabel={[option.name, option.subtitle]
            .filter(Boolean)
            .join(", ")}
          accessibilityRole="button"
          accessibilityState={{ selected: option.id === selectedClubId }}
          key={option.id}
          onPress={() => onSelect(option)}
          style={({ pressed }) => [
            styles.resultRow,
            pressed ? styles.pressed : null,
          ]}
          testID={`fan-favorite-club-result-${option.id}`}
        >
          <ClubLogo logoUrl={option.logoUrl} />
          <View style={styles.cardText}>
            <AppText numberOfLines={2} variant="titleSm">
              {option.name}
            </AppText>
            {option.subtitle ? (
              <AppText color="secondary" numberOfLines={1} variant="meta">
                {option.subtitle}
              </AppText>
            ) : null}
          </View>
          {option.id === selectedClubId ? (
            <Ionicons color={colors.accent} name="checkmark-circle" size={22} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Logo assente: il placeholder del design system, mai un'immagine rotta. */
function ClubLogo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <View style={styles.logo}>
        <Image source={{ uri: logoUrl }} style={styles.logoImage} />
      </View>
    );
  }

  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <Ionicons color={colors.accent} name="shield-outline" size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  content: {
    gap: spacing[16],
  },
  empty: {
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[24],
  },
  logo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 44,
    overflow: "hidden",
    width: 44,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  pressed: {
    opacity: 0.7,
  },
  removeAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  resultRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingVertical: spacing[8],
  },
  search: {
    gap: spacing[8],
  },
  selectedCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: radius[16],
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
});
