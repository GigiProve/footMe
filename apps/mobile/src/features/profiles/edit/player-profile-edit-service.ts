import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  buildFullUpdatePayload,
  buildInitialState,
  type ProfileFormState,
} from "../profile-edit-helpers";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type CompleteProfessionalProfileUpdate,
  type PlayerCareerEntryInput,
  type PlayerPalmaresInput,
} from "../profile-service";
import { parseBirthDateInput } from "../profile-form-utils";

/**
 * Chiave unica del profilo completo. Il Master Profile e ogni sezione
 * dell'editor leggono da qui, quindi un salvataggio si vede immediatamente
 * ovunque senza refetch a catena (§P, §W).
 */
export function completeProfileQueryKey(profileId: string) {
  return ["complete-profile", profileId] as const;
}

export function useCompleteProfileQuery(profileId: string | null) {
  return useQuery({
    enabled: Boolean(profileId),
    queryFn: () => getCompleteProfessionalProfile(profileId as string),
    queryKey: completeProfileQueryKey(profileId ?? ""),
  });
}

export type PlayerSectionPatch = Partial<ProfileFormState> & {
  /**
   * Presente solo nella sezione Palmarès. `undefined` lascia i riconoscimenti
   * come sono: `updateCompleteProfessionalProfile` tocca la tabella solo
   * quando il campo è definito.
   */
  playerPalmares?: PlayerPalmaresInput[];
};

/**
 * Costruisce il payload di UNA sezione a partire dal profilo appena letto.
 *
 * Due trappole vivono qui, e solo qui:
 *
 * 1. `save_player_profile_details` **cancella** le esperienze di carriera che
 *    non trova in `p_career_entries`. Partire sempre da `buildInitialState`
 *    garantisce che una sezione che non c'entra nulla con la carriera la
 *    riscriva identica invece di azzerarla.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`
 *    aspettandosi che sia il chiamante a reimpostarla. Una sezione che se ne
 *    dimentica cancella la data di nascita.
 */
/**
 * Righe di carriera già salvate, ripassate così come sono.
 *
 * `PlayerCareerEntryInput` è `PlayerExperiencePayload`: stessa forma del
 * record letto dal database meno `player_profile_id`, che la RPC ricava da
 * sé. Non normalizziamo nulla di proposito — il punto è che una sezione che
 * non parla di carriera non deve toccarla.
 */
function keepCareerEntriesAsStored(
  data: CompleteProfessionalProfile,
): PlayerCareerEntryInput[] {
  return data.playerCareerEntries.map((entry) => ({
    appearances: entry.appearances,
    assists: entry.assists,
    awards: entry.awards,
    career_type: entry.career_type,
    club_id: entry.club_id,
    club_name: entry.club_name,
    competition_name: entry.competition_name,
    experience_group_id: entry.experience_group_id,
    goals: entry.goals,
    id: entry.id,
    minutes_played: entry.minutes_played,
    period_end_month: entry.period_end_month,
    period_start_month: entry.period_start_month,
    season_label: entry.season_label,
    season_period: entry.season_period as PlayerCareerEntryInput["season_period"],
    sort_order: entry.sort_order,
    team_logo_url: entry.team_logo_url,
  }));
}

export function buildPlayerSectionPayload(
  data: CompleteProfessionalProfile,
  patch: PlayerSectionPatch,
): CompleteProfessionalProfileUpdate {
  const { playerPalmares, ...formPatch } = patch;

  /*
    Terza trappola, la più insidiosa: `buildFullUpdatePayload` rivalida SEMPRE
    tutte le righe di carriera (`parsePlayerExperienceForms`), e `category` /
    `season_label` sono colonne nullable in database. Un profilo storico con
    una riga senza categoria rendeva quindi impossibile salvare QUALUNQUE
    sezione — cambiare la foto falliva con "Seleziona la categoria per
    l'esperienza 2.". Quando la sezione in corso non è la carriera togliamo le
    righe dallo stato da validare e le rimettiamo subito dopo, identiche a
    come sono salvate: nessuna validazione, nessuna perdita di dati. La
    sezione Carriera (l'unica che passa `careerEntries` nel patch) continua a
    validare esattamente come prima.
  */
  const sectionEditsCareer = formPatch.careerEntries !== undefined;
  const initialState = buildInitialState(data);
  const merged: ProfileFormState = {
    ...initialState,
    ...formPatch,
    ...(sectionEditsCareer ? {} : { careerEntries: [] }),
  };
  const payload = buildFullUpdatePayload(data, merged);

  if (!sectionEditsCareer && data.profile.role === "player") {
    payload.playerCareerEntries = keepCareerEntriesAsStored(data);
  }

  payload.profile.birth_date =
    parseBirthDateInput(merged.birthDate)?.isoValue ?? data.profile.birth_date;

  if (playerPalmares !== undefined) {
    payload.playerPalmares = playerPalmares;
  }

  return payload;
}

export type SavePlayerSectionVariables = {
  data: CompleteProfessionalProfile;
  patch: PlayerSectionPatch;
};

/**
 * Salvataggio di una sezione. Rilegge il profilo e riscrive la cache condivisa,
 * così hub e Master Profile sono aggiornati senza reload manuale (§P).
 */
export function usePlayerSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SavePlayerSectionVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SavePlayerSectionVariables) => {
      await updateCompleteProfessionalProfile(
        buildPlayerSectionPayload(data, patch),
      );

      return getCompleteProfessionalProfile(data.profile.id);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(
        completeProfileQueryKey(profileId ?? fresh.profile.id),
        fresh,
      );
    },
  });
}
