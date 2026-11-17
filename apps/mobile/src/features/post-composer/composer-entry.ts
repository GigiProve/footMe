/**
 * Come il «+» della Home arriva al composer (HOM-06.1 §2–3, §25, §213, §261;
 * HOM-06.2 §4–§10).
 *
 * Il «+» NON è cablato come «+ = Post» né come «+ = Crea contenuto» (§4): è una
 * funzione delle azioni realmente disponibili, che arrivano dal server
 * (`fetch_content_launcher`, `features/publishing`). Chi decide è
 * `resolveLauncherMode`:
 *  • solo Post e nulla in sospeso → composer diretto, un tap (§5);
 *  • altrimenti → foglio «Crea contenuto» (§6) con righe semplici (§10).
 *
 * Questo file tiene ciò che il server NON sa: la destinazione di «Posizione
 * aperta» e l'origin del composer. Se la riga compare lo decide il server
 * (`can_open_position`, HOM-15 §168: nessuna capability dedotta dal ruolo).
 *
 * I formati LEGACY del vecchio menu «Crea» sono assorbiti (decisione Luigi
 * 2026-11-13): `media_article` e `club_content` sono ora «Articolo»; `fan_post`
 * è «Post» (il tifoso è una PERSON con il composer Post). Resta una sola azione
 * che non è né Post né Articolo: «Posizione aperta», per chi ha la capability
 * Position, che continua ad aprire la stessa destinazione di prima (§4: azione
 * reale, non un mockup).
 */

import type { FeedScope } from "../feed/feed-types";
import type { ComposerOrigin } from "./composer-types";

/** Destinazione di «Posizione aperta»: la stessa del vecchio menu (modulo legacy, non si estende). */
export const OPEN_POSITION_HREF = "/(tabs)/announcements";

/** §5, §123: la tab Home da cui si apre è la superficie a cui si torna. */
export function composerOriginForScope(scope: FeedScope): ComposerOrigin {
  return scope === "seguiti" ? "HOME_SEGUITI" : "HOME_PER_TE";
}
