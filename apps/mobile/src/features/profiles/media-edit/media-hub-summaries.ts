/**
 * Riepiloghi delle righe dell'hub Modifica profilo Media/Creator
 * (REV-PROF-22, Screen 1).
 *
 * Funzioni pure sui dati reali. I numeri del mockup — tre ambiti, quattro
 * tipi, tre canali, nove contenuti — sono esempi visuali e non esistono nel
 * codice.
 *
 * Due regole che valgono più delle stringhe che producono:
 *
 *  - un conteggio che non è ancora arrivato è `undefined`, non `0`. Lo zero è
 *    un'informazione, e mostrarla prima di averla verificata è un'altra cosa:
 *    la riga resta senza riepilogo finché il dato non c'è;
 *  - un campo vuoto si dichiara "Da completare". Non si inventa un nome, un
 *    tipo, una descrizione o una copertura, e soprattutto non si ricade sui
 *    dati personali del proprietario per riempirlo.
 */
import type { ProfileEditSectionKey } from "../profile-analytics";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  MEDIA_COVERAGE_ALL_ITALY_LABEL,
  resolveMediaCoverageAreas,
} from "../media/media-master-profile";
import {
  countVisibleMediaChannels,
  normalizeMediaContentTypeSelection,
  normalizeMediaScopeSelection,
  type MediaChannelForm,
} from "./media-edit-rules";

export const MEDIA_INCOMPLETE_SUMMARY = "Da completare";

export type MediaHubSummaryInput = {
  /** Canali letti da `profile_contacts`, già nella forma del modulo. */
  channels: MediaChannelForm;
  /**
   * Contenuti gestibili dal modulo Media condiviso. `null` finché il
   * conteggio reale non è arrivato.
   */
  contentCount: number | null;
  profile: CompleteProfessionalProfile;
};

export function buildMediaIdentitySummary(): string {
  return "Logo, copertina, nome e tipo";
}

export function buildMediaCoverageSummary(count: number): string {
  if (count <= 0) {
    return MEDIA_INCOMPLETE_SUMMARY;
  }

  return count === 1 ? "1 ambito selezionato" : `${count} ambiti selezionati`;
}

export function buildMediaContentTypesSummary(count: number): string {
  if (count <= 0) {
    return MEDIA_INCOMPLETE_SUMMARY;
  }

  return count === 1 ? "1 selezionato" : `${count} selezionati`;
}

/**
 * Riepilogo leggibile delle aree: "Lombardia, Piemonte e Liguria". Oltre la
 * terza voce si conta invece di elencare, altrimenti la riga va a capo o
 * viene tagliata — e una riga tagliata non dice quante aree mancano.
 */
export function buildMediaAreasSummary(areas: readonly string[]): string {
  if (areas.length === 0) {
    return MEDIA_INCOMPLETE_SUMMARY;
  }

  if (areas.length === 1) {
    return areas[0] as string;
  }

  if (areas.length <= 3) {
    return `${areas.slice(0, -1).join(", ")} e ${areas[areas.length - 1]}`;
  }

  return `${areas.slice(0, 2).join(", ")} e altre ${areas.length - 2}`;
}

export function buildMediaChannelsSummary(count: number): string {
  if (count <= 0) {
    return MEDIA_INCOMPLETE_SUMMARY;
  }

  return count === 1 ? "1 visibile" : `${count} visibili`;
}

export function buildMediaContentsSummary(count: number): string {
  return count === 1 ? "1 contenuto" : `${count} contenuti`;
}

/**
 * Riepilogo di una riga. `undefined` lascia in piedi il sottotitolo fisso
 * dichiarato nel registro delle sezioni — ed è anche ciò che tiene la riga
 * Media senza numero finché il conteggio non è confermato.
 */
export function buildMediaSectionSummary(
  sectionId: ProfileEditSectionKey,
  { channels, contentCount, profile }: MediaHubSummaryInput,
): string | undefined {
  const media = profile.mediaProfile ?? null;

  if (sectionId === "presentation") {
    return media?.short_description?.trim()
      ? "Descrizione pubblica"
      : MEDIA_INCOMPLETE_SUMMARY;
  }

  if (sectionId === "coverage") {
    const selection = normalizeMediaScopeSelection(media?.focus_areas);

    return buildMediaCoverageSummary(
      selection.known.length + selection.deprecated.length,
    );
  }

  if (sectionId === "contentTypes") {
    const selection = normalizeMediaContentTypeSelection(media?.content_types);

    return buildMediaContentTypesSummary(
      selection.known.length + selection.deprecated.length,
    );
  }

  if (sectionId === "areas") {
    /*
      "Tutta Italia" è una copertura dichiarata, non un elenco: passa da
      `resolveMediaCoverageAreas` come tutte le altre e arriva qui già come
      etichetta singola.
    */
    const areas = resolveMediaCoverageAreas({
      coverageScope: media?.coverage_scope,
      coveredProvinces: media?.covered_provinces,
      coveredTerritories: media?.covered_territories,
    });

    return media?.coverage_scope === "ITALY"
      ? MEDIA_COVERAGE_ALL_ITALY_LABEL
      : buildMediaAreasSummary(areas);
  }

  if (sectionId === "channels") {
    return buildMediaChannelsSummary(countVisibleMediaChannels(channels));
  }

  if (sectionId === "media") {
    return contentCount === null
      ? undefined
      : buildMediaContentsSummary(contentCount);
  }

  return undefined;
}
