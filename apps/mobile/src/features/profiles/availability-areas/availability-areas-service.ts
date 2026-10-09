/**
 * Accesso ai dati della disponibilità geografica (DAS-REV-06 §18, §22, §23).
 *
 * Due RPC e nient'altro: «Non creare un database di completezza, una tabella
 * manuale di campi completati o un endpoint di salvataggio parallelo per la
 * Dashboard» (§22). Le RPC lavorano sempre su `auth.uid()` — non esiste un
 * parametro identità, quindi «leggere le mancanze o modificare le aree di
 * un'altra PERSON cambiando ID» (§25) non è nemmeno esprimibile dal client.
 *
 * Il salvataggio è una **patch limitata ai dati geografici** (§18): tocca la
 * modalità, le due liste e nient'altro. È la ragione per cui non riusa
 * `useProfileSectionSave`, che ricostruisce il payload completo del profilo e
 * riscriverebbe toggle di disponibilità, badge e carriera — compresi i campi
 * che le RPC `save_*_details` azzerano quando il payload li omette.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { supabase } from "../../../lib/supabase";
import { DASHBOARD_QK_PREFIXES } from "../../dashboard/dashboard-keys";
import { POSITIONS_QK } from "../../search/positions/positions-criteria";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import {
  normalizeAvailabilityAreasMode,
  resolveActiveAreas,
  type AvailabilityAreasDraft,
  type AvailabilityAreasMode,
} from "./availability-areas-model";

export type AvailabilityAreasConfig = {
  /** Il visitor non apre l'editor e non chiama le API di modifica (§5). */
  canEdit: boolean;
  /**
   * `null` quando nessuno ha mai confermato una configurazione.
   *
   * Non è pedanteria: `player_profiles.availability_type` è
   * `not null default 'ITALY'` e l'onboarding parte da `"ITALY"` senza che
   * nessuno lo scelga, quindi la sola modalità persistita non distingue
   * «ha scelto Tutta Italia» da «non ha mai scelto» (§16).
   */
  configuredAt: string | null;
  mode: AvailabilityAreasMode | null;
  provinces: string[];
  regions: string[];
  /** Revisione della sola disponibilità, per il controllo di concorrenza (§18). */
  revision: number;
  /**
   * Aree persistite che non appartengono più alla tassonomia canonica.
   * Restano visibili e rimovibili: §24 vieta le conversioni distruttive.
   */
  unknownAreas: string[];
};

export type SaveAvailabilityAreasInput = {
  draft: AvailabilityAreasDraft;
  /** Revisione letta all'apertura. Il backend rifiuta se è cambiata (§18). */
  expectedRevision: number;
};

export const AVAILABILITY_AREAS_QK = {
  config: (profileId: string) =>
    ["profile-availability-areas", profileId] as const,
} as const;

/** Conflitto riconoscibile: un altro dispositivo ha già cambiato le aree. */
export class AvailabilityAreasConflictError extends Error {
  constructor() {
    super(
      "Le aree sono state modificate da un altro dispositivo. Ricarica e riprova.",
    );
    this.name = "AvailabilityAreasConflictError";
  }
}

type AvailabilityAreasRow = {
  availability_mode: string | null;
  can_edit: boolean;
  configured_at: string | null;
  provinces: string[] | null;
  regions: string[] | null;
  revision: number | null;
  unknown_areas: string[] | null;
};

function toConfig(row: AvailabilityAreasRow): AvailabilityAreasConfig {
  return {
    canEdit: row.can_edit === true,
    configuredAt: row.configured_at,
    /*
      La modalità vale solo insieme alla conferma: senza `configured_at` il
      valore persistito è un default di schema, non una scelta. Restituire
      `null` è ciò che impedisce all'editor di preselezionare Tutta Italia
      su un profilo che non ha mai configurato le aree (§15, §16).
    */
    mode: row.configured_at
      ? normalizeAvailabilityAreasMode(row.availability_mode)
      : null,
    provinces: row.provinces ?? [],
    regions: row.regions ?? [],
    revision: row.revision ?? 0,
    unknownAreas: row.unknown_areas ?? [],
  };
}

export async function fetchAvailabilityAreas(): Promise<AvailabilityAreasConfig> {
  const { data, error } = await supabase
    .rpc("fetch_profile_availability_areas")
    .maybeSingle<AvailabilityAreasRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Availability areas not available");
  }

  return toConfig(data);
}

export async function saveAvailabilityAreas({
  draft,
  expectedRevision,
}: SaveAvailabilityAreasInput): Promise<AvailabilityAreasConfig> {
  const active = resolveActiveAreas(draft);

  const { data, error } = await supabase
    .rpc("save_profile_availability_areas", {
      p_expected_revision: expectedRevision,
      p_mode: draft.mode,
      p_provinces: active.provinces,
      p_regions: active.regions,
    })
    .maybeSingle<AvailabilityAreasRow>();

  if (error) {
    /*
      §18: «evitare overwrite silenziosi». Il backend alza un errore
      riconoscibile invece di scrivere comunque, e qui lo traduciamo in un
      tipo che la schermata sa distinguere da un guasto generico.
    */
    if (error.message.includes("availability_areas_conflict")) {
      throw new AvailabilityAreasConflictError();
    }

    throw error;
  }

  if (!data) {
    throw new Error("Availability areas not saved");
  }

  return toConfig(data);
}

export function useAvailabilityAreasQuery(profileId: string | null) {
  return useQuery({
    enabled: Boolean(profileId),
    queryFn: fetchAvailabilityAreas,
    queryKey: AVAILABILITY_AREAS_QK.config(profileId ?? ""),
    /*
      §16: «Un aggiornamento in background non deve sovrascrivere un draft
      modificato dall'utente». Il draft vive nello stato della schermata e
      viene inizializzato una volta sola; qui spegniamo comunque i refetch
      automatici, così la configurazione di partenza — quella con cui si
      confronta "dirty" — non cambia sotto le dita.
    */
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

export function useSaveAvailabilityAreas(
  profileId: string | null,
): UseMutationResult<
  AvailabilityAreasConfig,
  Error,
  SaveAvailabilityAreasInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAvailabilityAreas,
    onSuccess: (config) => {
      /*
        §20 — riconciliazione. La configurazione confermata dal backend
        sostituisce quella in cache: così una risposta precedente alla
        mutation non può far riapparire il suggerimento appena risolto.
      */
      if (profileId) {
        queryClient.setQueryData(
          AVAILABILITY_AREAS_QK.config(profileId),
          config,
        );
        queryClient.invalidateQueries({
          queryKey: completeProfileQueryKey(profileId),
        });
      }

      /*
        I segnali della Dashboard e i moduli che leggono le aree. Si invalida
        per prefisso perché la chiave contiene identità e capability, che
        questa schermata non conosce — e non deve conoscere (§22).
      */
      for (const prefix of DASHBOARD_QK_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /*
        Cerca e "Posizioni per te" usano le aree per il matching (§20). Si
        invalidano le superfici esistenti: nessun motore nuovo.
      */
      queryClient.invalidateQueries({ queryKey: [POSITIONS_QK] });
      queryClient.invalidateQueries({ queryKey: ["search-positions"] });
    },
  });
}
