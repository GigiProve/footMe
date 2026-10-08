/**
 * Riepiloghi delle righe dell'hub Modifica profilo Tifoso (REV-PROF-20,
 * schermata 1).
 *
 * Funzioni pure: prendono i dati reali e restituiscono la riga di testo. I
 * conteggi del mockup — tre interessi, quattro categorie, nove contenuti —
 * sono esempi visuali e non compaiono da nessuna parte nel codice.
 *
 * Due regole che non sono negoziabili e che quindi vivono qui, in un posto
 * solo:
 *
 *  - la squadra del cuore si riassume con la **denominazione canonica**. Un
 *    identificativo, uno slug o la stringa del vecchio flusso Appassionato
 *    non sono un nome di squadra: quando la relazione canonica manca la riga
 *    dice "Non impostata" e il modulo chiede una nuova scelta;
 *  - le aree di interesse riportano sempre "Visibile solo a te". Non è una
 *    decorazione: è l'unica informazione di visibilità che quella riga può
 *    mostrare, perché un toggle pubblico per le aree non esiste.
 */
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";

export const FAN_FAVORITE_CLUB_EMPTY_SUMMARY = "Non impostata";

/** Suffisso delle aree: la riga non ha, e non può avere, un toggle pubblico. */
export const FAN_AREAS_PRIVACY_SUFFIX = "Visibile solo a te";

export type FanHubSummaryInput = {
  /**
   * Denominazione risolta dall'entità canonica. `null` quando la relazione
   * non esiste o non porta più da nessuna parte.
   */
  favoriteClubName: string | null;
  /**
   * Contenuti gestibili dal modulo Media condiviso. `null` finché il
   * conteggio reale non è arrivato: la riga resta senza riepilogo invece di
   * mostrare uno zero che non è stato ancora verificato.
   */
  mediaCount: number | null;
  profile: CompleteProfessionalProfile;
};

export function buildFanFavoriteClubSummary(
  favoriteClubName: string | null,
): string {
  const trimmed = favoriteClubName?.trim();

  return trimmed ? trimmed : FAN_FAVORITE_CLUB_EMPTY_SUMMARY;
}

export function buildFanInterestsSummary(count: number): string {
  if (count <= 0) {
    return "Nessuno selezionato";
  }

  return count === 1 ? "1 selezionato" : `${count} selezionati`;
}

export function buildFanCategoriesSummary(count: number): string {
  if (count <= 0) {
    return "Nessuna selezionata";
  }

  return count === 1 ? "1 selezionata" : `${count} selezionate`;
}

/**
 * Riepilogo delle aree: la modalità reale, non l'elenco completo dei
 * territori, più la nota di privacy.
 */
export function buildFanAreasSummary(input: {
  geoScope: string;
  provinceCount: number;
  regionCount: number;
}): string {
  const detail = describeAreaMode(input);

  return `${detail} · ${FAN_AREAS_PRIVACY_SUFFIX}`;
}

function describeAreaMode({
  geoScope,
  provinceCount,
  regionCount,
}: {
  geoScope: string;
  provinceCount: number;
  regionCount: number;
}): string {
  if (geoScope === "REGIONS") {
    return regionCount === 1 ? "1 regione" : `${regionCount} regioni`;
  }

  if (geoScope === "PROVINCES") {
    return provinceCount === 1 ? "1 zona" : `${provinceCount} zone`;
  }

  return "Tutta Italia";
}

export function buildFanMediaSummary(count: number): string {
  if (count <= 0) {
    return "0 contenuti";
  }

  return count === 1 ? "1 contenuto" : `${count} contenuti`;
}

/**
 * Riepilogo di una riga dell'hub. `undefined` lascia in piedi il sottotitolo
 * fisso dichiarato nel registro delle sezioni.
 */
export function buildFanSectionSummary(
  sectionId: ProfileEditSectionKey,
  { favoriteClubName, mediaCount, profile }: FanHubSummaryInput,
): string | undefined {
  const fan = profile.fanProfile ?? null;

  if (sectionId === "favoriteClub") {
    return buildFanFavoriteClubSummary(favoriteClubName);
  }

  if (sectionId === "interests") {
    return buildFanInterestsSummary(fan?.football_types.length ?? 0);
  }

  if (sectionId === "categories") {
    return buildFanCategoriesSummary(fan?.interest_categories.length ?? 0);
  }

  if (sectionId === "areas") {
    return buildFanAreasSummary({
      geoScope: fan?.geo_scope ?? "ITALY",
      provinceCount: fan?.interest_provinces.length ?? 0,
      regionCount: fan?.interest_regions.length ?? 0,
    });
  }

  if (sectionId === "media") {
    return mediaCount === null ? undefined : buildFanMediaSummary(mediaCount);
  }

  return undefined;
}
