/**
 * Accesso ai dati della carriera Procuratore (REV-PROF-15).
 *
 * Onboarding, Gestisci carriera e Master Profile leggono e scrivono le stesse
 * righe di `agent_career_entries`: niente `agentCareerOnboarding` accanto a un
 * `agentCareerProfile`, niente copia sincronizzata a mano.
 *
 * La differenza rispetto al Dirigente è il modo di scrivere. Lì la carriera è
 * una colonna `jsonb` e l'atomicità arriva gratis da un `upsert` di riga; qui è
 * una tabella, e un incarico per volta attraversa una RPC che tiene insieme le
 * invarianti che il client non può garantire da solo:
 *
 *  * una sola esperienza principale, con il flag tolto alla precedente nella
 *    stessa transazione — e un indice parziale che rifiuta comunque la seconda,
 *    se due richieste si incrociano;
 *  * un incarico concluso non resta mai principale;
 *  * un duplicato esatto non entra, mentre una sovrapposizione sì.
 *
 * Dopo ogni scrittura il profilo completo viene riletto e messo in cache con la
 * stessa chiave del Master Profile: header, tab Carriera e situazione attuale
 * si aggiornano senza logout, senza riavvio e senza refresh manuale.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { supabase } from "../../../lib/supabase";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import {
  getCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../profile-service";
import type { CoachAssignment } from "../coach-career/coach-assignment-model";
import type { AdditionalAssignmentLane } from "../career-manager/career-manager-config";
import { assignmentsToDirectorEntries } from "../director-career/director-assignment-model";
import {
  assignmentToPayload,
  type AgentCareerAssignment,
} from "./agent-assignment-model";

export { useCompleteProfileQuery } from "../edit/player-profile-edit-service";

/**
 * Un'organizzazione trovata su PROLINK.
 *
 * È una pagina reale: selezionarla salva il suo id canonico e usa nome, logo e
 * località che arrivano da lì. Non attribuisce nessun permesso su quella pagina
 * e non la modifica in alcun modo.
 */
export type AgentOrganizationResult = {
  category: string | null;
  city: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
  region: string | null;
};

/**
 * Ricerca delle organizzazioni realmente presenti su PROLINK.
 *
 * Il registro delle organizzazioni del prodotto è `clubs`: le agenzie non hanno
 * ancora una pagina propria, quindi quasi tutte finiranno nell'inserimento
 * manuale — che per questo non è un ripiego ma una strada prevista, con un
 * riferimento privato e nessuna pagina pubblica creata di nascosto.
 *
 * Ricerca per nome, normalizzata e insensibile alle maiuscole. Nessun risultato
 * dimostrativo: una query senza corrispondenze torna vuota.
 */
export async function searchAgentOrganizations(
  query: string,
  limit = 10,
): Promise<AgentOrganizationResult[]> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, category, logo_url")
    .ilike("name", `%${trimmed}%`)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const club = row as {
      category: string | null;
      city: string | null;
      id: string;
      logo_url: string | null;
      name: string | null;
      region: string | null;
    };

    return {
      category: club.category?.trim() || null,
      city: club.city?.trim() || null,
      id: club.id,
      logoUrl: club.logo_url?.trim() || null,
      name: club.name?.trim() ?? "",
      region: club.region?.trim() || null,
    };
  });
}

/**
 * Codici sollevati dalle RPC. Arrivano nel messaggio dell'errore Postgres e
 * vanno tradotti qui: la schermata mostra la copy della task, non un errore
 * del database.
 */
export const AGENT_CAREER_ERROR_CODES = {
  duplicate: "AGENT_CAREER_DUPLICATE",
  notFound: "AGENT_CAREER_ENTRY_NOT_FOUND",
} as const;

export function isDuplicateError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(AGENT_CAREER_ERROR_CODES.duplicate)
  );
}

type SaveAssignmentVariables = {
  assignment: AgentCareerAssignment;
  profileId: string;
};

/**
 * Creazione e modifica di un incarico: è lo stesso record, con o senza id.
 * Due schermate che chiamassero due mutation diverse avrebbero prodotto due
 * insiemi di regole da tenere allineati.
 */
export function useSaveAgentAssignment(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveAssignmentVariables
> {
  return useAgentCareerMutation(profileId, async (variables) => {
    const { error } = await supabase.rpc("save_agent_career_entry", {
      p_entry: assignmentToPayload(variables.assignment),
      p_profile_id: variables.profileId,
    });

    if (error) {
      throw error;
    }
  });
}

type EndAssignmentVariables = {
  assignmentId: string;
  endMonth: string;
  endYear: number;
  profileId: string;
};

/**
 * Conclusione di un incarico. Non è un salvataggio come gli altri: chiude il
 * periodo, spegne lo stato in corso e toglie l'esperienza principale, così la
 * situazione attuale viene ricalcolata al primo render successivo.
 */
export function useEndAgentAssignment(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  EndAssignmentVariables
> {
  return useAgentCareerMutation(profileId, async (variables) => {
    const { error } = await supabase.rpc("end_agent_career_entry", {
      p_end_month: variables.endMonth || null,
      p_end_year: variables.endYear,
      p_entry_id: variables.assignmentId,
      p_profile_id: variables.profileId,
    });

    if (error) {
      throw error;
    }
  });
}

type DeleteAssignmentVariables = {
  assignmentId: string;
  profileId: string;
};

export function useDeleteAgentAssignment(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  DeleteAssignmentVariables
> {
  return useAgentCareerMutation(profileId, async (variables) => {
    const { error } = await supabase.rpc("delete_agent_career_entry", {
      p_entry_id: variables.assignmentId,
      p_profile_id: variables.profileId,
    });

    if (error) {
      throw error;
    }
  });
}

/**
 * Ogni mutation della carriera finisce allo stesso modo: scrive, rilegge il
 * profilo completo e lo mette in cache sotto la chiave che il Master Profile
 * già osserva. È quello che rende immediato l'aggiornamento del profilo, e
 * l'unico punto in cui questa regola è scritta.
 */
function useAgentCareerMutation<TVariables extends { profileId: string }>(
  profileId: string | null,
  write: (variables: TVariables) => Promise<void>,
): UseMutationResult<CompleteProfessionalProfile, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      await write(variables);

      return getCompleteProfessionalProfile(variables.profileId);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(
        completeProfileQueryKey(profileId ?? fresh.profile.id),
        fresh,
      );
    },
  });
}

/**
 * Colonna `jsonb` di `agent_profiles` su cui scrive ciascun percorso.
 *
 * Il Procuratore ne ha tre ad assegnazione — Dirigente, Allenatore e Staff
 * tecnico — piu il percorso da calciatore, che ha un modello suo. La corsia
 * "Altri ruoli" del Dirigente non esiste qui e non ha una colonna: una corsia
 * assente non e una corsia vuota.
 */
const PATH_COLUMNS: Partial<Record<AdditionalAssignmentLane, string>> = {
  coach: "coach_career_entries",
  director: "director_career_entries",
  staff: "staff_career_entries",
};

export type SaveAgentPathVariables = {
  assignments?: readonly CoachAssignment[];
  lane?: AdditionalAssignmentLane;
  playerCareerEntries?: readonly unknown[];
  profileId: string;
};

/**
 * Percorsi aggiuntivi: le esperienze svolte in altri ruoli, che restano
 * separate dalla carriera da procuratore e non vengono mai convertite in
 * incarichi.
 *
 * Una sola riga, un solo `update`: l'atomicità arriva dalla forma del dato,
 * come per il Dirigente. La patch è parziale per corsia, così salvare il
 * percorso da allenatore non può azzerare quello da calciatore — l'errore che
 * `buildFullUpdatePayload` ha già commesso una volta sullo Staff tecnico.
 */
export function useSaveAgentPath(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveAgentPathVariables
> {
  return useAgentCareerMutation(profileId, async (variables) => {
    const patch: Record<string, unknown> = {};

    const column = variables.lane ? PATH_COLUMNS[variables.lane] : undefined;

    if (column && variables.assignments) {
      patch[column] = assignmentsToDirectorEntries(variables.assignments);
    }

    if (variables.playerCareerEntries) {
      patch.player_career_entries = [...variables.playerCareerEntries];
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    const { error } = await supabase
      .from("agent_profiles")
      .update(patch)
      .eq("profile_id", variables.profileId);

    if (error) {
      throw error;
    }
  });
}
