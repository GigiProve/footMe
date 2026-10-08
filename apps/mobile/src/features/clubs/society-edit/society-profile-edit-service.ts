/**
 * Accesso ai dati dell'editor Società (REV-PROF-18 §"Architettura
 * dell'editor", §"Salvataggio e persistenza").
 *
 * Una lettura e una scrittura, entrambe RPC:
 *
 *  - `fetch_society_profile_editor` restituisce il club editabile e i
 *    conteggi dei flussi collegati in una chiamata sola. È owner-only: a chi
 *    non può gestire la Società il database risponde `null`, quindi non
 *    esiste una versione "svuotata" della pagina da nascondere lato client.
 *  - `save_society_profile_section` scrive una sezione per volta, su un
 *    elenco chiuso di colonne. Un modulo non può sovrascrivere i campi di un
 *    altro nemmeno sbagliando payload, e il client non rimanda indietro
 *    l'intero club per cambiare una riga.
 *
 * Il salvataggio porta con sé `updatedAt`: se un altro amministratore ha
 * toccato il club nel frattempo, il database rifiuta invece di sovrascrivere.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { supabase } from "../../../lib/supabase";
import { coerceClubStructure } from "../../onboarding/club/club-structure";
import type {
  SocietyEditSectionId,
  SocietyEditableClub,
  SocietyProfileEditor,
} from "./society-edit-types";

type Json = Record<string, unknown>;

/**
 * Chiave unica dell'editor. Hub e moduli leggono da qui, quindi un
 * salvataggio si vede immediatamente in tutte le sezioni senza refetch a
 * catena.
 */
export function societyEditorQueryKey(clubId: string) {
  return ["society-profile-editor", clubId] as const;
}

export async function fetchSocietyProfileEditor(
  clubId: string,
): Promise<SocietyProfileEditor | null> {
  const { data, error } = await supabase.rpc("fetch_society_profile_editor", {
    p_club_id: clubId,
  });

  if (error) throw error;

  return mapEditor(data);
}

export function useSocietyProfileEditorQuery(clubId: string | null) {
  return useQuery({
    enabled: Boolean(clubId),
    queryFn: () => fetchSocietyProfileEditor(clubId as string),
    queryKey: societyEditorQueryKey(clubId ?? ""),
  });
}

/**
 * Errori che il database solleva e che hanno una copy dedicata. Tutto il
 * resto resta l'errore generico: un messaggio tecnico non aiuterebbe, e un
 * dettaglio del backend non va mostrato.
 */
export const SOCIETY_SAVE_ERROR_MESSAGES: Record<string, string> = {
  society_profile_city_required: "Seleziona una città valida.",
  society_profile_conflict:
    "Il profilo è stato aggiornato da un altro amministratore. Ricarica i dati e riprova.",
  society_profile_description_too_long:
    "La descrizione non può superare 500 caratteri.",
  society_profile_first_team_active:
    "È presente una prima squadra attiva. Gestiscila prima di modificare la struttura del club.",
  society_profile_forbidden:
    "Non hai più i permessi per modificare questo profilo.",
  society_profile_founding_year_invalid:
    "Inserisci un anno di fondazione valido.",
  society_profile_name_required: "Inserisci la denominazione del club.",
  society_profile_not_found:
    "Non è stato possibile caricare i dati del profilo. Riprova.",
  society_profile_structure_invalid: "Seleziona la struttura del club.",
  society_profile_youth_teams_active:
    "Sono presenti squadre giovanili attive. Gestiscile prima di modificare la struttura del club.",
};

export const SOCIETY_GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

/** Un conflitto non è un errore qualsiasi: la schermata offre "Ricarica". */
export function isSocietyConflictError(error: unknown): boolean {
  return resolveErrorCode(error) === "society_profile_conflict";
}

export function resolveSocietySaveErrorMessage(error: unknown): string {
  const code = resolveErrorCode(error);

  return (
    (code ? SOCIETY_SAVE_ERROR_MESSAGES[code] : undefined) ??
    SOCIETY_GENERIC_SAVE_ERROR
  );
}

function resolveErrorCode(error: unknown): string | null {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  const match = message.match(/society_profile_[a-z_]+/);

  return match ? match[0] : null;
}

export type SaveSocietySectionVariables = {
  payload: Json;
  section: SocietyEditSectionId;
};

/**
 * Salvataggio di una sezione. La risposta della RPC è già il nuovo stato
 * dell'editor: si riscrive la cache con quella, senza una seconda lettura.
 */
export function useSocietySectionSave(
  clubId: string | null,
  updatedAt: string | null,
): UseMutationResult<
  SocietyProfileEditor | null,
  Error,
  SaveSocietySectionVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payload, section }: SaveSocietySectionVariables) => {
      const { data, error } = await supabase.rpc(
        "save_society_profile_section",
        {
          p_club_id: clubId,
          p_expected_updated_at: updatedAt,
          p_payload: payload,
          p_section: section,
        },
      );

      if (error) throw error;

      return mapEditor(data);
    },
    onSuccess: (fresh) => {
      if (fresh && clubId) {
        queryClient.setQueryData(societyEditorQueryKey(clubId), fresh);
      }

      /*
        Il Master Profile Società e le superfici che leggono il club (profilo
        squadra, Cerca, card) non condividono questa cache: si invalidano per
        chiave, così il dato nuovo arriva senza che l'utente ricarichi l'app.
      */
      void queryClient.invalidateQueries({ queryKey: ["society-master-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["complete-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["public-club-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["club-teams"] });
      void queryClient.invalidateQueries({ queryKey: ["search-clubs"] });
    },
  });
}

function mapEditor(value: unknown): SocietyProfileEditor | null {
  const payload = asObject(value);
  const clubRow = asObject(payload.club);

  if (!clubRow.id) {
    return null;
  }

  const countsRow = asObject(payload.counts);
  const teamsRow = asObject(payload.teams);
  const firstTeamRow = asObject(teamsRow.first_team);

  return {
    club: mapClub(clubRow),
    counts: {
      affiliates: asCount(countsRow.affiliates),
      media: asCount(countsRow.media),
      positions: asCount(countsRow.positions),
      teams: asCount(countsRow.teams),
    },
    teams: {
      firstTeam: firstTeamRow.id
        ? {
            category: asText(firstTeamRow.category),
            id: String(firstTeamRow.id),
            name: asText(firstTeamRow.name) ?? "",
          }
        : null,
      hasFirstTeam: teamsRow.has_first_team === true,
      hasYouthTeams: teamsRow.has_youth_teams === true,
    },
  };
}

function mapClub(row: Json): SocietyEditableClub {
  return {
    category: asText(row.category),
    city: asText(row.city) ?? "",
    clubColors: asText(row.club_colors),
    clubEmail: asText(row.club_email),
    clubPhone: asText(row.club_phone),
    clubStructure: coerceClubStructure(row.club_structure),
    country: asText(row.country),
    coverUrl: asText(row.cover_url),
    description: asText(row.description),
    facebook: asText(row.facebook),
    fieldAddress: asText(row.field_address),
    foundingYear: asNumber(row.founding_year),
    headquartersAddress: asText(row.headquarters_address),
    id: String(row.id),
    instagram: asText(row.instagram),
    logoUrl: asText(row.logo_url),
    name: asText(row.name) ?? "",
    province: asText(row.province),
    region: asText(row.region) ?? "",
    showClubEmail: row.show_club_email === true,
    showClubPhone: row.show_club_phone === true,
    showFacebook: row.show_facebook === true,
    showInstagram: row.show_instagram === true,
    showWebsite: row.show_website === true,
    stadium: asText(row.stadium),
    updatedAt: asText(row.updated_at),
    venueAddressSameAsHeadquarters:
      row.venue_address_same_as_headquarters === true,
    verificationStatus: asText(row.verification_status) ?? "unverified",
    websiteUrl: asText(row.website_url),
  };
}

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
