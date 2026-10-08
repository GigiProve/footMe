/**
 * Tipi di contenuto (REV-PROF-22, Screen 5).
 *
 * I **formati** che la realtà produce abitualmente. È una sezione
 * dichiarativa, e la parola conta: alimenta la sezione "Contenuti" della tab
 * Info di REV-PROF-21 e nient'altro.
 *
 * In particolare non: crea formati tecnici autonomi, cambia
 * `can_publish_post`, `can_publish_article` o `can_schedule_content`,
 * pubblica contenuti, filtra retroattivamente quelli esistenti, ne elimina di
 * incoerenti, o diventa la tassonomia delle categorie Articolo. Le capability
 * editoriali restano al backend e a HOM-06.2.
 */
import {
  MEDIA_CONTENT_TYPE_ICONS,
  MEDIA_CONTENT_TYPE_OPTIONS,
} from "../../../onboarding/community/media-taxonomy";
import { MediaTaxonomyScreen } from "./MediaTaxonomyScreen";

export function MediaContentTypesScreen() {
  return (
    <MediaTaxonomyScreen
      buildPatch={(values) => ({
        kind: "contentTypes",
        value: { content_types: values },
      })}
      helperMessage="I tipi dichiarati descrivono la tua attività e non modificano i permessi di pubblicazione."
      icons={MEDIA_CONTENT_TYPE_ICONS}
      intro="Indica i contenuti che realizzi abitualmente."
      readValues={(data) => data.mediaProfile?.content_types}
      section="contentTypes"
      taxonomy={MEDIA_CONTENT_TYPE_OPTIONS}
      testIDPrefix="media-content-types"
      title="Tipi di contenuto"
    />
  );
}
