/**
 * Salvataggio per sezione della Modifica profilo Tifoso (REV-PROF-20).
 *
 * La lettura è quella di sempre — `useCompleteProfileQuery`, la stessa query
 * del Master Profile e di tutti gli altri editor: riusarla è ciò che fa
 * apparire una modifica nell'hub e nel profilo senza refetch a catena e senza
 * una seconda copia dei dati.
 *
 * La scrittura **non** passa da `updateCompleteProfessionalProfile`. Quella
 * funzione, per il Tifoso, riscrive la riga `fan_profiles` intera a partire
 * dal payload dell'onboarding: squadra, interessi, modalità geografica e
 * territori insieme. Qui serve l'opposto — quattro insiemi di colonne
 * disgiunti, uno per modulo:
 *
 *   • squadra del cuore  → favorite_club_id, favorite_club_is_public,
 *                          favorite_team_name
 *   • interessi          → football_types, football_types_are_public
 *   • categorie          → interest_categories,
 *                          interest_categories_are_public
 *   • aree di interesse  → geo_scope, interest_regions, interest_provinces
 *
 * Nessun insieme nomina una colonna di un altro: salvare gli interessi non
 * può azzerare le aree, e rimuovere la squadra non può toccare le categorie.
 * I dati personali (schermata 2) non compaiono qui affatto, perché vivono su
 * `profiles` e passano dal modulo condiviso.
 *
 * La `updated_at` letta insieme al profilo torna indietro come condizione
 * della UPDATE: se un'altra sessione ha riscritto la riga nel frattempo, non
 * viene aggiornata nessuna riga e il modulo lo dice invece di sovrascrivere
 * silenziosamente.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { supabase } from "../../../lib/supabase";
import {
  getCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";

export const FAN_CONFLICT_MESSAGE =
  "Il profilo è stato aggiornato da un'altra sessione. Controlla le modifiche e riprova.";

export const FAN_SAVE_ERROR_MESSAGE =
  "Non è stato possibile salvare le modifiche. Riprova.";

export const FAN_LOAD_ERROR_MESSAGE =
  "Non è stato possibile caricare i dati. Riprova.";

/** Scrittura rifiutata perché la riga è cambiata sotto i piedi. */
export class FanProfileConflictError extends Error {
  constructor() {
    super(FAN_CONFLICT_MESSAGE);
    this.name = "FanProfileConflictError";
  }
}

export type FanFavoriteClubPatch = {
  favorite_club_id: string | null;
  favorite_club_is_public: boolean;
  /**
   * Presente solo quando il modulo rimuove la squadra: la stringa del vecchio
   * flusso era *quella* relazione, e lasciarla farebbe ricomparire una
   * squadra appena rimossa. Negli altri salvataggi non viene nominata, così
   * un dato storico non si perde per un salvataggio che non lo riguarda.
   */
  favorite_team_name?: string | null;
};

export type FanInterestsPatch = {
  football_types: string[];
  football_types_are_public: boolean;
};

export type FanCategoriesPatch = {
  interest_categories: string[];
  interest_categories_are_public: boolean;
};

export type FanAreasPatch = {
  geo_scope: "ITALY" | "REGIONS" | "PROVINCES";
  interest_provinces: string[];
  interest_regions: string[];
};

export type FanSectionPatch =
  | { kind: "favoriteClub"; value: FanFavoriteClubPatch }
  | { kind: "interests"; value: FanInterestsPatch }
  | { kind: "categories"; value: FanCategoriesPatch }
  | { kind: "areas"; value: FanAreasPatch };

export type SaveFanSectionVariables = {
  data: CompleteProfessionalProfile;
  patch: FanSectionPatch;
};

/**
 * Colonne che il patch tocca. Nessun merge con lo stato precedente: ciò che
 * non è qui non viene inviato, quindi non viene riscritto.
 */
function toColumns(patch: FanSectionPatch): Record<string, unknown> {
  return { ...patch.value };
}

export async function saveFanProfileSection(
  profileId: string,
  data: CompleteProfessionalProfile,
  patch: FanSectionPatch,
): Promise<void> {
  const columns = toColumns(patch);
  const current = data.fanProfile ?? null;

  /*
    Nessuna riga ancora: il Tifoso ha un profilo ma non ha mai salvato
    preferenze. Si inserisce, invece di trattarlo come un conflitto.
  */
  if (!current) {
    const { error } = await supabase
      .from("fan_profiles")
      .insert({ ...columns, profile_id: profileId });

    if (error) {
      throw error;
    }

    return;
  }

  let query = supabase
    .from("fan_profiles")
    .update(columns)
    .eq("profile_id", profileId);

  if (current.updated_at) {
    query = query.eq("updated_at", current.updated_at);
  }

  const { data: updated, error } = await query
    .select("profile_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  /*
    Zero righe aggiornate con la riga che esiste: la `updated_at` non combacia
    più. Non si riprova senza condizione — sarebbe un last-write-wins cieco
    proprio su visibilità e squadra del cuore.
  */
  if (!updated) {
    throw new FanProfileConflictError();
  }
}

/**
 * Salva una sezione e riscrive la cache condivisa con il profilo riletto:
 * hub, Master Profile owner e tab Info si allineano senza reload manuale.
 */
export function useFanSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveFanSectionVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveFanSectionVariables) => {
      await saveFanProfileSection(data.profile.id, data, patch);

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

/** Messaggio da mostrare nella CTA per un errore di salvataggio. */
export function describeFanSaveError(error: unknown): string {
  return error instanceof FanProfileConflictError
    ? FAN_CONFLICT_MESSAGE
    : FAN_SAVE_ERROR_MESSAGE;
}
