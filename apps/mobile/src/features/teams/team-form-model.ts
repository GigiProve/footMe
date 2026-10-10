/**
 * Stato del form Squadra (DAS-REV-08 §13, §14, §23).
 *
 * Funzioni pure, fuori dal componente: lo stato dirty, l'abilitazione della
 * CTA e la patch parziale sono le tre regole che la task verifica una per
 * una, e si controllano senza montare la schermata.
 */
import type { TeamInheritanceMode, TeamPatch } from "./teams-service";

export type TeamDraft = {
  city: string;
  cityMode: TeamInheritanceMode;
  crestMode: TeamInheritanceMode;
  crestUrl: string | null;
  levelId: string | null;
  levelLabel: string | null;
  name: string;
  region: string;
  typeId: string | null;
  typeLabel: string | null;
};

export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 80;

/**
 * §14: trim e gestione coerente degli spazi. Gli spazi interni multipli
 * collassano — "Under  17  A" e "Under 17 A" sono lo stesso nome digitato
 * due volte — ma accenti, apostrofi e maiuscole restano quelli dell'utente.
 */
export function normalizeTeamName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isTeamNameValid(value: string): boolean {
  const normalized = normalizeTeamName(value);

  return (
    normalized.length >= TEAM_NAME_MIN && normalized.length <= TEAM_NAME_MAX
  );
}

/**
 * §23: «Aprire un form o mostrare valori predefiniti non costituisce da solo
 * una modifica. Calcolare lo stato dirty sui dati effettivi e sulle modalità
 * ereditato/personalizzato.»
 *
 * Il confronto include quindi le due modalità: passare da ereditato a
 * personalizzato con lo stesso valore effettivo **è** una modifica, perché
 * cambia che cosa succederà quando la Società aggiornerà il proprio dato.
 */
export function isTeamDraftDirty(
  initial: TeamDraft,
  draft: TeamDraft,
): boolean {
  return (
    normalizeTeamName(initial.name) !== normalizeTeamName(draft.name) ||
    initial.typeId !== draft.typeId ||
    initial.levelId !== draft.levelId ||
    initial.crestMode !== draft.crestMode ||
    (draft.crestMode === "custom" && initial.crestUrl !== draft.crestUrl) ||
    initial.cityMode !== draft.cityMode ||
    (draft.cityMode === "custom" &&
      (initial.city !== draft.city || initial.region !== draft.region))
  );
}

/**
 * §13: «CTA Crea squadra: abilitata soltanto con dati validi, contesto
 * autorizzato, Tipo selezionato e asset necessari pronti. Livello è
 * facoltativo.»
 */
export function canSubmitCreate(input: {
  draft: TeamDraft;
  hasSeason: boolean;
  isAuthorized: boolean;
  isUploading: boolean;
}): boolean {
  return (
    input.isAuthorized &&
    input.hasSeason &&
    !input.isUploading &&
    isTeamNameValid(input.draft.name) &&
    Boolean(input.draft.typeId) &&
    (input.draft.crestMode !== "custom" || Boolean(input.draft.crestUrl)) &&
    (input.draft.cityMode !== "custom" ||
      (input.draft.city.trim().length > 0 && input.draft.region.trim().length > 0))
  );
}

/**
 * §13: «CTA Salva modifiche: abilitata soltanto con modifiche effettive e
 * valide. Il caricamento iniziale non deve consentire di inviare valori
 * vuoti.»
 */
export function canSubmitUpdate(input: {
  draft: TeamDraft;
  initial: TeamDraft | null;
  isAuthorized: boolean;
  isUploading: boolean;
}): boolean {
  if (!input.initial || !input.isAuthorized || input.isUploading) {
    return false;
  }

  return (
    isTeamDraftDirty(input.initial, input.draft) &&
    isTeamNameValid(input.draft.name) &&
    (input.draft.crestMode !== "custom" || Boolean(input.draft.crestUrl)) &&
    (input.draft.cityMode !== "custom" ||
      (input.draft.city.trim().length > 0 && input.draft.region.trim().length > 0))
  );
}

/**
 * Patch parziale (§22): solo i campi davvero cambiati.
 *
 * `level_id: null` è presente quando il campionato è stato rimosso, ed è
 * diverso da "chiave assente": il primo è la rimozione esplicita che §16
 * consente, il secondo è un campo che nessuno ha toccato.
 *
 * Tipo e Livello non entrano nella patch quando la squadra non ha una
 * configurazione corrente: §13 vieta di crearne una come effetto implicito
 * del form.
 */
export function buildTeamPatch(input: {
  draft: TeamDraft;
  hasSeasonConfig: boolean;
  initial: TeamDraft;
}): TeamPatch {
  const patch: TeamPatch = {};
  const { draft, initial } = input;

  if (normalizeTeamName(initial.name) !== normalizeTeamName(draft.name)) {
    patch.name = normalizeTeamName(draft.name);
  }

  if (initial.crestMode !== draft.crestMode) {
    patch.crest_mode = draft.crestMode;

    if (draft.crestMode === "custom") {
      patch.crest_url = draft.crestUrl;
    }
  } else if (draft.crestMode === "custom" && initial.crestUrl !== draft.crestUrl) {
    patch.crest_url = draft.crestUrl;
  }

  if (initial.cityMode !== draft.cityMode) {
    patch.city_mode = draft.cityMode;

    if (draft.cityMode === "custom") {
      patch.city = draft.city;
      patch.region = draft.region;
    }
  } else if (
    draft.cityMode === "custom" &&
    (initial.city !== draft.city || initial.region !== draft.region)
  ) {
    patch.city = draft.city;
    patch.region = draft.region;
  }

  if (input.hasSeasonConfig) {
    if (initial.typeId !== draft.typeId && draft.typeId) {
      patch.type_id = draft.typeId;
    }

    if (initial.levelId !== draft.levelId) {
      patch.level_id = draft.levelId;
    }
  }

  return patch;
}
