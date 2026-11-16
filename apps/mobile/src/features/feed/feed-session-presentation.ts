/**
 * Sessione del Feed Per te (HOM-13 §81–§97, §227–§228) — funzioni pure, nessun React.
 *
 * Il server costruisce uno snapshot ordinato per sessione e il client lo legge a
 * pagine con un cursore di POSIZIONE (`feed_session_id` + `next_position`, §95–§97):
 * nessun numero di pagina, nessun riordino lato client (§220). Qui vivono le
 * derivazioni testabili senza rendering:
 *
 *  • riconoscere la sessione scaduta (`P0002` / `feed_session_expired`) per ripartire
 *    con una sessione nuova in modo trasparente;
 *  • il cursore di ripresa dalla cache (§227): sessione + posizione dell'ULTIMO
 *    elemento persistito, perché la cache tronca a 30 elementi e il cursore del
 *    server potrebbe essere più avanti;
 *  • il parametro della pagina successiva e della sessione nuova;
 *  • il tipo di unit di un elemento, per l'analytics (§222, §259).
 *
 * Nessun peso, score o formula passa di qui (§258).
 */

import type {
  FeedItem,
  FeedPage,
  FeedPageParam,
  FeedSessionParam,
  FeedUnitType,
} from "./feed-types";

/**
 * Oltre questa età una sessione in cache non si riprende: il Feed è cambiato e si
 * parte da una sessione nuova. Un breve background NON ricostruisce nulla (§228);
 * il TTL del server (24h) resta il limite duro.
 */
export const FEED_SESSION_RESUME_MAX_AGE_MS = 30 * 60 * 1000;

export type FeedSessionIdentity = NonNullable<FeedSessionParam["identity"]>;

const SESSION_EXPIRED_HINT = "feed_session_expired";
const SESSION_EXPIRED_CODE = "P0002";
const SESSION_SCAN_TRUNCATED_HINT = "feed_scan_truncated";

/**
 * `Sessione Feed non valida o scaduta`, `errcode P0002`, `hint feed_session_expired`
 * (contratto §1, «Errori»). Si accetta uno qualunque dei tre segnali: PostgREST
 * riporta `code`, `hint` e `message` come campi dell'errore.
 */
export function isFeedSessionExpired(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const { code, hint, message } = error as {
    code?: unknown;
    hint?: unknown;
    message?: unknown;
  };

  return (
    code === SESSION_EXPIRED_CODE ||
    hint === SESSION_EXPIRED_HINT ||
    // Contratto §1: scansione interrotta senza righe valide (irraggiungibile in pratica).
    // Il cursore non può proseguire: come una sessione scaduta, si riparte da una nuova.
    hint === SESSION_SCAN_TRUNCATED_HINT ||
    (typeof message === "string" && message.includes("Sessione Feed non valida"))
  );
}

/**
 * L'identità attiva Home (HOM-07 §11: l'ultima identità Dashboard ancora autorizzata,
 * già risolta da `useInteractionIdentity`) nella forma che la RPC vuole. Nessuna scelta
 * nuova qui: se non c'è, il server ricade sulla personale (contratto §1, D3).
 */
export function toSessionIdentity(
  identity: { type: FeedSessionIdentity["type"]; id: string } | null | undefined,
): FeedSessionIdentity | null {
  return identity ? { id: identity.id, type: identity.type } : null;
}

/** Applica l'identità a un parametro di sessione NUOVA che non la porta già. */
export function withSessionIdentity(
  param: FeedPageParam,
  identity: FeedSessionIdentity | null,
): FeedPageParam {
  if (!param.session || param.session.identity) {
    return param;
  }
  return { ...param, session: { ...param.session, identity } };
}

/** Parametro di una sessione NUOVA: pull-to-refresh, tap sulla pill, primo avvio. */
export function newSessionParam(identity: FeedSessionIdentity | null): FeedSessionParam {
  return { afterPosition: null, identity, sessionId: null };
}

/** Il parametro della pagina 0 di Per te con una sessione nuova. */
export function newForYouPageParam(identity: FeedSessionIdentity | null): FeedPageParam {
  return { cursor: null, pageIndex: 0, session: newSessionParam(identity) };
}

/**
 * Pagina successiva dello snapshot (§96). `undefined` = fine: l'ultima pagina ha
 * `next_position` nullo. Senza stato di sessione (pagina vuota di una sessione nuova)
 * non c'è nulla da chiedere.
 */
export function nextForYouPageParam(
  lastPage: FeedPage,
  identity: FeedSessionIdentity | null,
): FeedPageParam | undefined {
  const session = lastPage.session;
  if (lastPage.isLastPage || !session || session.nextPosition === null) {
    return undefined;
  }

  return {
    cursor: null,
    pageIndex: lastPage.pageIndex + 1,
    session: { afterPosition: session.nextPosition, identity, sessionId: session.feedSessionId },
  };
}

/**
 * §227: dalla cache su disco si riprende la sessione dell'ultimo elemento
 * persistito, con `afterPosition = rank` di quell'elemento. `null` quando non c'è
 * sessione (cache pre-HOM-13, Seguiti) o quando è troppo vecchia (§228): in quel caso
 * la cache si mostra comunque, ma il Feed riparte da una sessione nuova.
 */
export function resumableSession(
  items: readonly FeedItem[],
  updatedAt: string,
  now: number = Date.now(),
): { feedSessionId: string; lastPosition: number } | null {
  const last = items[items.length - 1];
  if (!last?.feedSessionId) {
    return null;
  }

  const age = now - new Date(updatedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > FEED_SESSION_RESUME_MAX_AGE_MS) {
    return null;
  }

  return { feedSessionId: last.feedSessionId, lastPosition: last.rank };
}

/**
 * La pagina costruita dalla cache. Con una sessione ripresa porta il cursore, quindi
 * `hasNextPage` è vero e il revalidate rilegge la STESSA sessione (stesso ordine,
 * solo le esclusioni dure ricontrollate, §83–§88); senza, resta una pagina «chiusa».
 */
export function cachedForYouPage(
  items: FeedItem[],
  updatedAt: string,
  now: number = Date.now(),
): FeedPage {
  const resume = resumableSession(items, updatedAt, now);

  return {
    asOf: updatedAt,
    isLastPage: false,
    items,
    nextCursor: null,
    pageIndex: 0,
    session: resume
      ? {
          feedSessionId: resume.feedSessionId,
          isNew: false,
          limit: items.length,
          nextPosition: resume.lastPosition,
          rankingVersion: null,
        }
      : null,
  };
}

/**
 * Il `pageParam` della pagina 0 coerente con una pagina in mano. Dopo un refresh il
 * `pageParam` originale è «sessione nuova»: un refetch successivo (invalidazione dopo un
 * Block, rientro sulla Home) NON deve crearne un'altra né resuscitare quella vecchia, ma
 * rileggere la sessione corrente dall'inizio, con la stessa ampiezza.
 */
export function firstPageParamFor(
  page: FeedPage,
  identity: FeedSessionIdentity | null,
): FeedPageParam {
  const session = page.session;

  if (!session) {
    return newForYouPageParam(identity);
  }

  return {
    cursor: null,
    pageIndex: 0,
    session: {
      afterPosition: null,
      identity,
      limit: session.limit,
      sessionId: session.feedSessionId,
    },
  };
}

/** true quando il `pageParam` della pagina 0 non descrive la sessione della pagina 0. */
export function isFirstParamStale(
  param: FeedPageParam | undefined,
  page: FeedPage | undefined,
): boolean {
  if (!page?.session) {
    return false;
  }

  return param?.session?.sessionId !== page.session.feedSessionId;
}

/** §222: il tipo di unit di un elemento, derivato — il server non lo ripete nella cache. */
export function unitTypeOf(item: FeedItem): FeedUnitType {
  switch (item.type) {
    case "suggested_position":
      return "OPPORTUNITY";
    case "suggested_profiles":
    case "suggested_clubs":
      return "SUGGESTED_PROFILES";
    default:
      return "repost" in item && item.repost ? "SIMPLE_REPOST" : "CONTENT";
  }
}

/**
 * §125 / HOM-13 §4: lo stesso id non compare due volte. Rete di sicurezza lato client
 * (§99: il server deduplica già); non riordina mai.
 */
export function dedupeByUnitId(items: readonly FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const unique: FeedItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}
