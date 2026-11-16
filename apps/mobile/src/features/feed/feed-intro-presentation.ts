/**
 * Stato di primo accesso del Feed (HOM-13 D1, §135–§146) — funzioni pure.
 *
 * `fetch_my_feed_intro()` restituisce UNA riga `(should_show, intro_state, areas jsonb)`:
 *  • `should_show` è vero solo con `intro_state = 'pending'` — una volta sola, nessuna
 *    riproposta (§146, §148);
 *  • `areas` = `[{kind: 'region'|'province'|'city', label}]` dai dati già presenti nel
 *    profilo (§140–§141). Nessuna nuova tassonomia (§142): il client mostra le etichette
 *    così come arrivano e, se l'elenco è vuoto, non mostra la sezione.
 *
 * Il «Modifica» (§142) apre l'editor del profilo ESISTENTE che gestisce quelle aree:
 * `introEditHref` sceglie la route per ruolo, senza inventare destinazioni.
 */

import type { FeedIntro, FeedIntroArea, FeedIntroAreaKind, FeedIntroRow } from "./feed-types";

const AREA_KINDS: readonly FeedIntroAreaKind[] = ["region", "province", "city"];

/** Un'area valida ha tipo noto e un'etichetta non vuota; il resto si scarta senza rompere le altre. */
export function parseIntroAreas(value: unknown): FeedIntroArea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const areas: FeedIntroArea[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const { kind, label } = entry as { kind?: unknown; label?: unknown };
    if (!AREA_KINDS.includes(kind as FeedIntroAreaKind) || typeof label !== "string") {
      continue;
    }
    const clean = label.trim();
    const key = `${kind}:${clean.toLowerCase()}`;
    if (clean.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    areas.push({ kind: kind as FeedIntroAreaKind, label: clean });
  }

  return areas;
}

/**
 * Righe RPC -> stato. Senza riga non c'è nulla da mostrare: meglio nascondere lo stato
 * che renderne uno vuoto (un errore sull'intro non deve mai bloccare il Feed, §23).
 */
export function mapIntroRows(rows: readonly FeedIntroRow[] | null | undefined): FeedIntro {
  const row = rows?.[0];

  return {
    areas: parseIntroAreas(row?.areas),
    shouldShow: row?.should_show === true,
  };
}

/**
 * La route dell'editor profilo che gestisce le aree, per ruolo (route reali di
 * `app/profile/*`; Dashboard e hub di sezione già esistenti). Nessuna route = nessun
 * link «Modifica» (es. admin).
 */
export function introEditHref(role: string | null | undefined): string | null {
  switch (role) {
    case "player":
      return "/profile/edit";
    case "coach":
      return "/profile/coach-edit";
    case "staff":
      return "/profile/staff-edit";
    case "agent":
      return "/profile/agent-edit";
    case "director":
      return "/profile/director-edit";
    case "fan":
      return "/profile/fan-edit/areas";
    case "media":
      return "/profile/media-edit/areas";
    case "club_admin":
      return "/profile/society-edit";
    default:
      return null;
  }
}

/**
 * Lo stato si mostra quando il server lo chiede E l'utente non l'ha già chiuso su questo
 * dispositivo (la copia locale evita il lampeggio tra «Inizia» e il refetch).
 */
export function shouldShowIntro(
  intro: FeedIntro | undefined,
  resolvedLocally: boolean,
): boolean {
  return intro?.shouldShow === true && !resolvedLocally;
}
