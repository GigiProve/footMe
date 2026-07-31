/**
 * Filter sections, option lists and sort options for Cerca > Media e
 * contenuti (CER-05 §18/§19).
 *
 * Le categorie calcistiche riusano `CLUB_CATEGORY_OPTIONS`, già fonte
 * canonica per Cerca > Società; regioni e province riusano `REGION_OPTIONS`
 * e `PROVINCE_OPTIONS` di profile-form-utils tramite i selettori condivisi.
 */

import type { MediaSearchSort } from "./media-search-types";
import type {
  MediaContentFormat,
  MediaResultKind,
  MediaSourceFilterKind,
} from "./media-search-types";
import type { MediaPublishedWithin, MediaRelationState } from "./media-filter-types";

export type MediaFilterSectionId =
  | "risultato"
  | "tipo"
  | "fonte"
  | "categoria"
  | "zona"
  | "data"
  | "relazione";

export const MEDIA_FILTER_MODAL_TITLE = "Filtri media e contenuti";

export const MEDIA_FILTER_SECTIONS: { id: MediaFilterSectionId; title: string }[] = [
  { id: "risultato", title: "Tipo di risultato" },
  { id: "tipo", title: "Tipo di contenuto" },
  { id: "fonte", title: "Fonte" },
  { id: "categoria", title: "Categoria" },
  { id: "zona", title: "Zona trattata" },
  { id: "data", title: "Data di pubblicazione" },
  { id: "relazione", title: "Relazione personale" },
];

export const MEDIA_RESULT_KIND_OPTIONS: { label: string; value: MediaResultKind }[] = [
  { label: "Tutti", value: "all" },
  { label: "Solo contenuti", value: "contents" },
  { label: "Solo profili Media", value: "sources" },
];

/**
 * Selezione multipla: nessun formato selezionato equivale a "Tutti", quindi
 * non serve una voce "Tutti" separata nello stato (CER-05 §18).
 */
export const MEDIA_FORMAT_OPTIONS: { label: string; value: MediaContentFormat }[] = [
  { label: "Articoli", value: "articolo" },
  { label: "Video", value: "video" },
  { label: "Foto", value: "foto" },
  { label: "Post", value: "post" },
];

/**
 * "Pagine sportive" non è elencata fra le voci Fonte di CER-05 §18, ma
 * `media_kind` ricade su 'pagina' per i profili Media senza tipologia
 * riconoscibile: senza questa voce quei profili sarebbero invisibili a
 * qualunque filtro Fonte.
 */
export const MEDIA_SOURCE_OPTIONS: { label: string; value: MediaSourceFilterKind }[] = [
  { label: "Società e profili ufficiali", value: "ufficiale" },
  { label: "Testate sportive", value: "testata" },
  { label: "Giornalisti", value: "giornalista" },
  { label: "Creator", value: "creator" },
  { label: "Pagine sportive", value: "pagina" },
];

export const MEDIA_PUBLISHED_OPTIONS: { label: string; value: MediaPublishedWithin }[] = [
  { label: "Qualsiasi data", value: "any" },
  { label: "Oggi", value: "today" },
  { label: "Ultimi 7 giorni", value: "last7" },
  { label: "Ultimi 30 giorni", value: "last30" },
];

export const MEDIA_RELATION_OPTIONS: {
  label: string;
  value: keyof MediaRelationState;
}[] = [
  { label: "Fonti seguite", value: "followedSources" },
  { label: "Contenuti salvati", value: "savedContents" },
  { label: "Società seguite", value: "followedClubs" },
  { label: "Profili seguiti", value: "followedProfiles" },
];

/** CER-05 §19. Default dopo una ricerca: "Più pertinenti". */
export const MEDIA_SORT_OPTIONS: { label: string; value: MediaSearchSort }[] = [
  { label: "Più pertinenti", value: "pertinenza" },
  { label: "Più recenti", value: "recenti" },
  { label: "In evidenza", value: "evidenza" },
  { label: "Più discussi", value: "discussi" },
];

export const MEDIA_DEFAULT_SORT: MediaSearchSort = "pertinenza";
