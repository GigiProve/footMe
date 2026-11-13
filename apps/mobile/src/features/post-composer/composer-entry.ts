/**
 * Come il «+» della Home arriva al composer (HOM-06.1 §2–3, §25, §213, §261).
 *
 * Il «+» NON è cablato come «+ = Post» (§3): è una funzione dei formati di
 * creazione che il ruolo può usare.
 *  • solo Post → `direct`: un tap, il composer si apre subito, senza schermata
 *    intermedia con Post/Foto/Video (§2, §25);
 *  • Post + altri formati → `menu`: resta l'ActionSheet esistente, con «Nuovo
 *    post» come PRIMA voce (decisione Luigi 2026-11-13). HOM-06.2 aggiungerà
 *    qui Articolo & co. aggiungendo formati, senza toccare Home né composer.
 *
 * Gli altri formati sono quelli LEGACY che oggi vivono in modali locali di
 * profilo/Società (vedi `FeedComposerEntry`): non si estendono (CLAUDE.md,
 * moduli legacy), si elencano soltanto.
 *
 * Il Post è disponibile per ogni ruolo come punto d'ingresso: chi non ha
 * identity con `can_publish_post` arriva comunque al composer, che spiega
 * «Non hai profili con cui pubblicare un post» (§172) invece del vecchio avviso
 * «non ancora attiva». L'autorità sul permesso resta del server (§30).
 */

import type { FeedScope } from "../feed/feed-types";
import type { ComposerOrigin } from "./composer-types";

export const COMPOSER_FORMATS = [
  "post",
  // Legacy, non estendere: vivono nelle viste di profilo/Società.
  "fan_post",
  "media_article",
  "club_content",
  "open_position",
] as const;

export type ComposerFormat = (typeof COMPOSER_FORMATS)[number];

export type ComposerEntryMode = "direct" | "menu";

const LEGACY_FORMATS_BY_ROLE: Record<string, readonly ComposerFormat[]> = {
  club_admin: ["club_content", "open_position"],
  fan: ["fan_post"],
  media: ["media_article"],
};

/** I formati di creazione disponibili al ruolo: sempre il Post, più gli eventuali legacy. */
export function composerFormatsForRole(role: string | null | undefined): ComposerFormat[] {
  return ["post", ...(role ? (LEGACY_FORMATS_BY_ROLE[role] ?? []) : [])];
}

/** `direct` se il Post è l'unico formato (o non ce n'è nessun altro), `menu` altrimenti. */
export function resolveComposerEntry(formats: readonly ComposerFormat[]): ComposerEntryMode {
  return formats.some((format) => format !== "post") ? "menu" : "direct";
}

/** §5, §123: la tab Home da cui si apre è la superficie a cui si torna. */
export function composerOriginForScope(scope: FeedScope): ComposerOrigin {
  return scope === "seguiti" ? "HOME_SEGUITI" : "HOME_PER_TE";
}
