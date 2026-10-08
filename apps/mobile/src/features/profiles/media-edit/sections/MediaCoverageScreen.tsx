/**
 * Copertura (REV-PROF-22, Screen 4).
 *
 * Gli **ambiti calcistici** che la realtà racconta: professionistico,
 * dilettantistico, giovanile, femminile, calciomercato. Vivono in
 * `media_profiles.focus_areas`, la stessa colonna che l'onboarding riempie e
 * che la sezione "Copertura" della tab Info mostra.
 *
 * Non sono i tipi di contenuto, non sono le categorie degli Articoli, non
 * sono le aree geografiche e non sono gli interessi personali del
 * proprietario. Non sono nemmeno le categorie calcistiche del Tifoso, che
 * hanno una tassonomia loro: il Media/Creator non è un Tifoso.
 */
import {
  MEDIA_SCOPE_ICONS,
  MEDIA_SCOPE_OPTIONS,
} from "../../../onboarding/community/media-taxonomy";
import { MediaTaxonomyScreen } from "./MediaTaxonomyScreen";

export function MediaCoverageScreen() {
  return (
    <MediaTaxonomyScreen
      buildPatch={(values) => ({
        kind: "coverage",
        value: { focus_areas: values },
      })}
      helperMessage="Queste informazioni saranno visibili nella tab Info."
      icons={MEDIA_SCOPE_ICONS}
      intro="Scegli gli ambiti calcistici che racconti."
      readValues={(data) => data.mediaProfile?.focus_areas}
      section="coverage"
      taxonomy={MEDIA_SCOPE_OPTIONS}
      testIDPrefix="media-coverage"
      title="Copertura"
    />
  );
}
