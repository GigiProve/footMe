/**
 * Derivazioni pure del composer Post (HOM-06.1).
 *
 * Tutto ciò che si può calcolare senza renderizzare vive qui, così è testabile
 * senza schermo: pubblicabilità (§11–13), motivo del blocco (§29, §169, §172,
 * §173), URL e rich preview (§73–98), riga «Con …» (§107), identity predefinita
 * per origin (§21–24), mention `@` (§110–113), payload verso le RPC (§117,
 * §155–161), copy degli errori (§169–177) e label per lo screen reader
 * (§196–199).
 *
 * Il reducer (`composer-reducer.ts`) usa queste funzioni; questo file importa da
 * lì SOLO il tipo `ComposerState`.
 */

import type {
  ComposerErrorKind,
  ComposerIdentity,
  ComposerLimits,
  ComposerMediaItem,
  ComposerMention,
  ComposerMentionCandidate,
  ComposerMentionQuery,
  ComposerOrigin,
  ComposerTaggedIdentity,
  ComposerTextRange,
  ComposerUrlMatch,
  WireMention,
  WirePublishLink,
  WirePublishMedia,
  WirePublishPostArgs,
  WireTaggedIdentity,
  WireUpdatePostArgs,
} from "./composer-types";
import type { ComposerState } from "./composer-reducer";

/* ------------------------------------------------------------------ */
/* Copy (spec)                                                         */
/* ------------------------------------------------------------------ */

export const COMPOSER_PLACEHOLDER = "Di cosa vuoi parlare?"; // §31
export const COMPOSER_MEDIA_LIMIT_COPY = "Hai raggiunto il numero massimo di contenuti per questo post."; // §62
export const COMPOSER_PUBLISH_ERROR_COPY = "Non è stato possibile pubblicare il post. Riprova."; // §175
export const COMPOSER_PERMISSION_LOST_COPY = "Non hai più i permessi per pubblicare con questo profilo."; // §169
export const COMPOSER_EDIT_PERMISSION_LOST_COPY = "Non hai più i permessi per modificare questo post."; // §173
export const COMPOSER_NO_IDENTITY_COPY = "Non hai profili con cui pubblicare un post."; // §172
export const COMPOSER_EDIT_ERROR_COPY = "Non è stato possibile salvare le modifiche. Riprova.";
export const COMPOSER_CONFLICT_COPY =
  "Questo post è stato modificato altrove. Esci e riaprilo per vedere la versione aggiornata."; // §161
export const COMPOSER_NOT_FOUND_COPY = "Questo post non è più disponibile.";
export const COMPOSER_UPLOAD_PENDING_BLOCK_COPY =
  "Rimuovi o riprova i contenuti non caricati per pubblicare."; // §70
export const COMPOSER_BODY_TOO_LONG_COPY = "Il testo è troppo lungo.";
export const COMPOSER_UPLOAD_FAILED_COPY = "Caricamento non riuscito"; // §70

/* ------------------------------------------------------------------ */
/* Identità                                                            */
/* ------------------------------------------------------------------ */

export function sameIdentity(
  a: Pick<ComposerIdentity, "type" | "id"> | null,
  b: Pick<ComposerIdentity, "type" | "id"> | null,
): boolean {
  return a !== null && b !== null && a.type === b.type && a.id === b.id;
}

/**
 * §21–24, §25: l'identity iniziale dipende dall'origin, senza schermata di scelta.
 *  • Home / dettaglio: la persona se può pubblicare, altrimenti il Media, altrimenti
 *    la prima; `hint` (acting identity della Dashboard, §21) vince se autorizzata;
 *  • Profilo personale: la PERSON;
 *  • Società / Media gestiti: l'identity indicata da `hint`, poi il tipo coerente.
 */
export function defaultIdentity(
  origin: ComposerOrigin,
  identities: readonly ComposerIdentity[],
  hint?: string | null,
): ComposerIdentity | null {
  if (identities.length === 0) {
    return null;
  }

  const byId = hint ? identities.find((identity) => identity.id === hint) : undefined;
  const person = identities.find((identity) => identity.type === "person");
  const media = identities.find((identity) => identity.type === "media");

  switch (origin) {
    case "PERSONAL_PROFILE":
      return person ?? byId ?? identities[0];
    case "SOCIETY_PROFILE":
      return byId ?? identities.find((identity) => identity.type === "society") ?? identities[0];
    case "MEDIA_PROFILE":
      return byId ?? media ?? identities[0];
    case "HOME_PER_TE":
    case "HOME_SEGUITI":
    case "CONTENT_DETAIL":
      return byId ?? person ?? media ?? identities[0];
  }
}

/** §16: una sola identity → nessun selector, nessuna freccia. */
export function hasIdentityChoice(
  state: Pick<ComposerState, "mode" | "identities" | "identity">,
): boolean {
  if (state.mode.kind !== "create") {
    return false;
  }

  // §171: dopo la revoca la lista può contenere solo un'altra identity; il
  // selector serve proprio per passarci.
  const current = state.identity;
  const onlyOther =
    state.identities.length === 1 &&
    (current === null ||
      state.identities[0].id !== current.id ||
      state.identities[0].type !== current.type);

  return state.identities.length > 1 || onlyOther;
}

/** §197. Il suffisso di verifica non nomina mai «ufficiale» (§183). */
export function identityAccessibilityLabel(identity: ComposerIdentity): string {
  if (!identity.isVerified) {
    return `Pubblica come ${identity.name}`;
  }

  const verified =
    identity.type === "person"
      ? "profilo verificato"
      : identity.type === "society"
        ? "società verificata"
        : "media verificato";

  return `Pubblica come ${identity.name}, ${verified}`;
}

/* ------------------------------------------------------------------ */
/* URL (§73–94)                                                        */
/* ------------------------------------------------------------------ */

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;
const URL_PARTS = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;
// Host con almeno un punto e senza userinfo (`user:pw@host`): niente `@`, `:` solo per la porta.
const HOST = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d{1,5})?$/u;
const MAX_URL_LENGTH = 2048;

function trimUrlTail(raw: string): string {
  let value = raw;

  while (value.length > 0) {
    const last = value[value.length - 1];

    if (".,;:!?'\"]}".includes(last)) {
      value = value.slice(0, -1);
    } else if (last === ")" && !value.includes("(")) {
      // La parentesi finale appartiene all'URL solo se ne apre una (es. Wikipedia).
      value = value.slice(0, -1);
    } else {
      break;
    }
  }

  return value;
}

/**
 * §78, §88: solo http/https; schema e host in minuscolo, niente frammento,
 * `/` finale della sola radice rimosso. `null` se non è un URL idoneo.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();

  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }

  const parts = URL_PARTS.exec(trimmed);

  if (!parts) {
    return null;
  }

  const [, scheme, host, path = "", query = ""] = parts;

  if (!HOST.test(host)) {
    return null;
  }

  return `${scheme.toLowerCase()}://${host.toLowerCase()}${path === "/" ? "" : path}${query}`;
}

/** §73, §88: gli URL idonei nell'ordine del testo, senza duplicati normalizzati. */
export function extractUrls(body: string): ComposerUrlMatch[] {
  const seen = new Set<string>();
  const matches: ComposerUrlMatch[] = [];

  for (const found of body.matchAll(URL_IN_TEXT)) {
    const raw = trimUrlTail(found[0]);
    const normalized = normalizeUrl(raw);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const start = found.index ?? 0;
    matches.push({ end: start + raw.length, normalized, raw, start });
  }

  return matches;
}

const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?$/;

/**
 * §77–78: idoneo a diventare `p_link` è solo ciò che il server accetta
 * (`footme_post_resolve_link`): https, porta assente o 443, host non IP.
 * Gli altri URL restano testo cliccabile (§87) e non bloccano mai la
 * pubblicazione (§89).
 */
export function isLinkTargetEligible(normalized: string): boolean {
  const parts = URL_PARTS.exec(normalized);

  if (!parts || parts[1] !== "https") {
    return false;
  }

  const host = parts[2];
  const port = /:(\d+)$/.exec(host)?.[1];

  return (port === undefined || port === "443") && !IPV4_HOST.test(host);
}

/** §74, §86: il primo URL idoneo è l'unico candidato a rich preview. */
export function firstEligibleUrl(body: string): ComposerUrlMatch | null {
  return extractUrls(body).find((match) => isLinkTargetEligible(match.normalized)) ?? null;
}

/** §82–83: l'URL è l'unico contenuto della propria riga. */
export function isIsolatedUrl(body: string, match: ComposerUrlMatch): boolean {
  const lineStart = body.lastIndexOf("\n", match.start - 1) + 1;
  const newline = body.indexOf("\n", match.end);
  const lineEnd = newline === -1 ? body.length : newline;

  return body.slice(lineStart, lineEnd).trim() === body.slice(match.start, match.end);
}

export function isUrlDismissed(state: Pick<ComposerState, "dismissedUrls">, normalizedUrl: string): boolean {
  return state.dismissedUrls.includes(normalizedUrl);
}

/**
 * §95–98: la card visuale non convive con i media (resta nello stato: nulla si
 * perde, §97) e, dopo una X esplicita, non torna per quell'URL (§93).
 */
export function shouldShowRichPreview(
  state: Pick<ComposerState, "link" | "media" | "dismissedUrls">,
): boolean {
  if (state.link.status === "idle" || state.media.length > 0) {
    return false;
  }

  return !isUrlDismissed(state, state.link.url);
}

/**
 * L'URL per cui il chiamante deve avviare il recupero della preview, o `null`.
 * Niente fetch con media presenti (§95: la card sarebbe nascosta; tornerà a
 * valere alla rimozione, §98), per URL rimosso (§93) o già in corso/riuscito.
 */
export function linkFetchTarget(
  state: Pick<ComposerState, "body" | "link" | "media" | "dismissedUrls">,
): string | null {
  if (state.link.status !== "idle" || state.media.length > 0) {
    return null;
  }

  const first = firstEligibleUrl(state.body);

  return first && !isUrlDismissed(state, first.normalized) ? first.normalized : null;
}

/* ------------------------------------------------------------------ */
/* Pubblicabilità (§11–13, §29, §169–173)                              */
/* ------------------------------------------------------------------ */

function textWithoutMentions(body: string, mentions: readonly ComposerMention[]): string {
  let out = "";
  let cursor = 0;

  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    out += body.slice(cursor, mention.start);
    cursor = Math.max(cursor, mention.end);
  }

  return out + body.slice(cursor);
}

/** §12–13: le mention da sole non sono testo significativo. */
export function hasMeaningfulText(state: Pick<ComposerState, "body" | "mentions">): boolean {
  return textWithoutMentions(state.body, state.mentions).trim().length > 0;
}

/** §13: un upload fallito non rende pubblicabile il Post, pending/in corso sì. */
export function hasUsableMedia(media: readonly ComposerMediaItem[]): boolean {
  return media.some((item) => item.uploadStatus !== "failed");
}

export function hasFailedMedia(media: readonly ComposerMediaItem[]): boolean {
  return media.some((item) => item.uploadStatus === "failed");
}

export function hasUploadsInFlight(media: readonly ComposerMediaItem[]): boolean {
  return media.some((item) => item.uploadStatus === "pending" || item.uploadStatus === "uploading");
}

export function hasPublishableContent(
  state: Pick<ComposerState, "body" | "mentions" | "media">,
): boolean {
  return hasMeaningfulText(state) || hasUsableMedia(state.media) || firstEligibleUrl(state.body) !== null;
}

/**
 * Il motivo per cui Pubblica è bloccato indipendentemente dal contenuto, o
 * `null`. Non cancella mai niente (§29, §170): lo schermo mostra la copy.
 */
export function publishBlockReason(
  state: Pick<ComposerState, "mode" | "identity" | "identities" | "canEdit" | "media" | "body" | "publish">,
  limits?: Pick<ComposerLimits, "maxBodyLength">,
): string | null {
  const failure = state.publish.status === "failed" ? state.publish.code : null;

  if (state.mode.kind === "edit") {
    if (!state.canEdit || failure === "post_edit_denied") {
      return COMPOSER_EDIT_PERMISSION_LOST_COPY;
    }
    if (failure === "post_version_conflict") {
      return COMPOSER_CONFLICT_COPY;
    }
    if (failure === "post_not_found") {
      return COMPOSER_NOT_FOUND_COPY;
    }
  } else {
    if (state.identities.length === 0) {
      return COMPOSER_NO_IDENTITY_COPY;
    }
    if (
      !state.identity ||
      !state.identities.some((candidate) => sameIdentity(candidate, state.identity)) ||
      failure === "post_permission_denied"
    ) {
      return COMPOSER_PERMISSION_LOST_COPY;
    }
    if (hasFailedMedia(state.media)) {
      return COMPOSER_UPLOAD_PENDING_BLOCK_COPY;
    }
  }

  if (limits && state.body.length > limits.maxBodyLength) {
    return COMPOSER_BODY_TOO_LONG_COPY;
  }

  return null;
}

/** §11–13, §119: abilitata solo con contenuto valido, nessun blocco e nessun invio in corso. */
export function canPublish(state: ComposerState): boolean {
  if (state.publish.status === "publishing") {
    return false;
  }

  if (publishBlockReason(state, state.limits) !== null) {
    return false;
  }

  if (!hasPublishableContent(state)) {
    return false;
  }

  // §158: Salva solo se c'è davvero una modifica.
  return state.mode.kind === "edit" ? isDirty(state) : true;
}

/* ------------------------------------------------------------------ */
/* Annulla (§137–138)                                                  */
/* ------------------------------------------------------------------ */

/** §137: nulla inserito → Annulla chiude senza dialog. L'identity da sola non conta. */
export function isEmpty(state: Pick<ComposerState, "body" | "mentions" | "tagged" | "media" | "link">): boolean {
  return (
    state.body.trim().length === 0 &&
    state.mentions.length === 0 &&
    state.tagged.length === 0 &&
    state.media.length === 0 &&
    state.link.status === "idle"
  );
}

function mentionsKey(mentions: readonly ComposerMention[]): string {
  return mentions
    .map((mention) => `${mention.identityType}:${mention.identityId}:${mention.start}:${mention.end}`)
    .join("|");
}

function taggedKey(tagged: readonly ComposerTaggedIdentity[]): string {
  return tagged
    .map((identity) => `${identity.identityType}:${identity.identityId}`)
    .sort()
    .join("|");
}

/** Il `snapshot_id` che partirebbe adesso, per confrontarlo con quello caricato in Modifica. */
function currentSnapshotId(state: Pick<ComposerState, "body" | "link" | "dismissedUrls">): string | null {
  return toWireLink(state)?.snapshot_id ?? null;
}

export type ComposerBaseline = {
  body: string;
  mentionsKey: string;
  taggedKey: string;
  snapshotId: string | null;
  /** Il Post aveva un'anteprima salvata (`has_preview`) e per quale URL normalizzato. */
  hadPreview: boolean;
  linkUrl: string | null;
};

export function baselineOf(input: {
  body: string;
  mentions: readonly ComposerMention[];
  tagged: readonly ComposerTaggedIdentity[];
  snapshotId: string | null;
  hadPreview?: boolean;
  linkUrl?: string | null;
}): ComposerBaseline {
  return {
    body: input.body,
    hadPreview: input.hadPreview ?? input.snapshotId !== null,
    linkUrl: input.linkUrl ?? null,
    mentionsKey: mentionsKey(input.mentions),
    snapshotId: input.snapshotId,
    taggedKey: taggedKey(input.tagged),
  };
}

/**
 * Modifica: l'utente ha tolto l'anteprima SALVATA di un URL che non è cambiato.
 * È una modifica a tutti gli effetti (Salva si accende) anche se lo snapshot da
 * inviare resta `null` come prima, e il server la riceve come `dismiss_preview`.
 */
export function dismissesStoredPreview(state: ComposerState): boolean {
  if (state.mode.kind !== "edit" || !state.baseline?.hadPreview || !state.baseline.linkUrl) {
    return false;
  }

  const first = firstEligibleUrl(state.body);

  return first !== null && first.normalized === state.baseline.linkUrl && isUrlDismissed(state, first.normalized);
}

/**
 * §138, §158: in creazione «modificato» = non vuoto; in modifica = diverso da
 * quanto caricato (testo, mention, tag, preview inviata).
 */
export function isDirty(state: ComposerState): boolean {
  if (state.mode.kind === "create" || !state.baseline) {
    return !isEmpty(state);
  }

  return (
    state.body !== state.baseline.body ||
    mentionsKey(state.mentions) !== state.baseline.mentionsKey ||
    taggedKey(state.tagged) !== state.baseline.taggedKey ||
    currentSnapshotId(state) !== state.baseline.snapshotId ||
    dismissesStoredPreview(state)
  );
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export function remainingMediaSlots(state: Pick<ComposerState, "media" | "limits">): number {
  return Math.max(0, state.limits.maxMedia - state.media.length);
}

type PickedAssetLike = { type?: string | null; duration?: number | null };

export type PickedSelection<T> = {
  accepted: T[];
  /** §62: ce n'erano più degli slot liberi → mostrare la copy del limite. */
  limitReached: boolean;
  /** Video oltre `maxVideoSeconds`: scartati, il resto della selezione passa. */
  rejectedVideos: number;
};

/**
 * §39–41, §61–62: dalla selezione del picker agli asset accettati. `duration`
 * del picker è in millisecondi. Un video troppo lungo non occupa uno slot.
 */
export function selectPickedAssets<T extends PickedAssetLike>(
  assets: readonly T[],
  options: { remainingSlots: number; maxVideoSeconds: number },
): PickedSelection<T> {
  const accepted: T[] = [];
  let rejectedVideos = 0;
  let limitReached = options.remainingSlots <= 0 && assets.length > 0;

  for (const asset of assets) {
    if (options.remainingSlots <= 0) {
      break;
    }

    const seconds = asset.duration ? asset.duration / 1000 : null;

    if (asset.type === "video" && seconds !== null && seconds > options.maxVideoSeconds) {
      rejectedVideos += 1;
      continue;
    }

    if (accepted.length >= options.remainingSlots) {
      limitReached = true;
      break;
    }

    accepted.push(asset);
  }

  return { accepted, limitReached, rejectedVideos };
}

function secondsLabel(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return rounded === 1 ? "1 secondo" : `${rounded} secondi`;
}

function uploadStatusLabel(item: ComposerMediaItem): string {
  switch (item.uploadStatus) {
    case "pending":
      return "in attesa di caricamento";
    case "uploading":
      return item.uploadProgress === null
        ? "caricamento in corso"
        : `caricamento in corso, ${Math.round(item.uploadProgress * 100)} per cento`;
    case "uploaded":
      return "caricamento completato";
    case "failed":
      return "caricamento non riuscito";
  }
}

/** §198: «Video, durata 24 secondi, caricamento completato.» (§199: lo stato è anche a parole.) */
export function mediaAccessibilityLabel(item: ComposerMediaItem): string {
  const parts = [item.type === "video" ? "Video" : "Foto"];

  if (item.type === "video" && item.durationSeconds !== null) {
    parts.push(`durata ${secondsLabel(item.durationSeconds)}`);
  }

  // I media già pubblicati (Modifica) non hanno uno stato di caricamento da dire.
  if (item.remoteMediaPosition === null) {
    parts.push(uploadStatusLabel(item));
  }

  return `${parts.join(", ")}.`;
}

/* ------------------------------------------------------------------ */
/* Tag (§107) e mention (§110–113)                                     */
/* ------------------------------------------------------------------ */

/**
 * §107: «Con Marco Bianchi e AC Como» (due), «Con Marco Bianchi e altre 3
 * persone» (più di due). Stesse parole di `summarizeTagged` per il suffisso
 * «altre N persone / altri N» (feed-post-presentation.ts): lì non è esportato e
 * calcola anche la deduplica con le mention, che nel composer non serve (§116).
 */
export function tagSummary(tagged: readonly ComposerTaggedIdentity[]): string | null {
  const [lead, second, ...rest] = tagged;

  if (!lead) {
    return null;
  }

  if (!second) {
    return `Con ${lead.displayName}`;
  }

  if (rest.length === 0) {
    return `Con ${lead.displayName} e ${second.displayName}`;
  }

  const others = [second, ...rest];
  const allPeople = others.every((identity) => identity.identityType === "profile");

  return `Con ${lead.displayName} ${allPeople ? `e altre ${others.length} persone` : `e altri ${others.length}`}`;
}

const MAX_MENTION_QUERY_LENGTH = 40;

/**
 * §110: se il cursore sta dentro un token `@parola`, la query e l'intervallo da
 * sostituire. `@` deve aprire il testo o seguire uno spazio (niente e-mail), e
 * non può cadere dentro una mention già inserita.
 */
export function mentionQueryAt(
  body: string,
  cursor: number,
  mentions: readonly ComposerMention[] = [],
): ComposerMentionQuery | null {
  let index = cursor - 1;

  while (index >= 0 && body[index] !== "@") {
    if (/\s/.test(body[index])) {
      return null;
    }
    index -= 1;
  }

  if (index < 0 || (index > 0 && !/\s/.test(body[index - 1]))) {
    return null;
  }

  const query = body.slice(index + 1, cursor);

  if (query.length > MAX_MENTION_QUERY_LENGTH) {
    return null;
  }

  if (mentions.some((mention) => index >= mention.start && index < mention.end)) {
    return null;
  }

  return { query, range: { end: cursor, start: index } };
}

/**
 * §112: sostituisce `range` con `@Nome ` e registra la mention con il suo
 * intervallo (`end` escluso, senza lo spazio finale). Le mention successive
 * scorrono; quelle sovrapposte al range cadono.
 */
export function applyMention(
  body: string,
  mentions: readonly ComposerMention[],
  range: ComposerTextRange,
  candidate: ComposerMentionCandidate,
): { body: string; mentions: ComposerMention[]; cursor: number } {
  const token = `@${candidate.displayName}`;
  const insertion = `${token} `;
  const delta = insertion.length - (range.end - range.start);
  const next: ComposerMention[] = [];

  for (const mention of mentions) {
    if (mention.end <= range.start) {
      next.push(mention);
    } else if (mention.start >= range.end) {
      next.push({ ...mention, end: mention.end + delta, start: mention.start + delta });
    }
  }

  next.push({
    displayName: candidate.displayName,
    end: range.start + token.length,
    identityId: candidate.identityId,
    identityType: candidate.identityType,
    start: range.start,
  });
  next.sort((a, b) => a.start - b.start);

  return {
    body: body.slice(0, range.start) + insertion + body.slice(range.end),
    cursor: range.start + insertion.length,
    mentions: next,
  };
}

/**
 * §209: dopo una modifica del testo, le mention il cui intervallo è toccato
 * cadono (il testo non è più `@Nome`), quelle a valle scorrono. Si cerca il tratto
 * cambiato con prefisso e suffisso comuni; ogni mention superstite è ricontrollata
 * contro il nuovo testo, così non può restarne una con l'intervallo sbagliato.
 */
export function reconcileMentions(
  previous: string,
  next: string,
  mentions: readonly ComposerMention[],
): ComposerMention[] {
  if (previous === next) {
    return [...mentions];
  }

  const shortest = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < shortest && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix += 1;
  }

  const changedEnd = previous.length - suffix;
  const delta = next.length - previous.length;
  const kept: ComposerMention[] = [];

  for (const mention of mentions) {
    let moved: ComposerMention | null = null;

    if (mention.end <= prefix) {
      moved = mention;
    } else if (mention.start >= changedEnd) {
      moved = { ...mention, end: mention.end + delta, start: mention.start + delta };
    }

    if (moved && next.slice(moved.start, moved.end) === `@${moved.displayName}`) {
      kept.push(moved);
    }
  }

  return kept;
}

/* ------------------------------------------------------------------ */
/* Payload verso le RPC (§117, §155–161)                               */
/* ------------------------------------------------------------------ */

function toWireMentions(mentions: readonly ComposerMention[], bodyLength: number): WireMention[] {
  return mentions
    .filter((mention) => mention.end <= bodyLength)
    .map((mention) => ({
      display_name: mention.displayName,
      end: mention.end,
      identity_id: mention.identityId,
      identity_type: mention.identityType,
      start: mention.start,
    }));
}

/** §210: i tag duplicati si fondono già qui (il server li deduplica comunque). */
function toWireTagged(tagged: readonly ComposerTaggedIdentity[]): WireTaggedIdentity[] {
  const seen = new Set<string>();
  const out: WireTaggedIdentity[] = [];

  for (const identity of tagged) {
    const key = `${identity.identityType}:${identity.identityId}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push({ target_id: identity.identityId, target_type: identity.identityType });
    }
  }

  return out;
}

/**
 * `p_link`: il primo URL idoneo con lo snapshot se la preview è pronta e non
 * rimossa (§93); altrimenti `snapshot_id: null` e il link resta testo cliccabile
 * (§89–90). Nessun URL → `null`. Lo snapshot parte anche con media presenti: il
 * Feed decide di non mostrarlo (§95), nessun dato si perde (§97).
 */
export function toWireLink(state: Pick<ComposerState, "body" | "link" | "dismissedUrls">): WirePublishLink | null {
  const first = firstEligibleUrl(state.body);

  if (!first) {
    return null;
  }

  const ready =
    state.link.status === "ready" &&
    state.link.url === first.normalized &&
    !isUrlDismissed(state, first.normalized);

  return {
    snapshot_id: ready && state.link.status === "ready" ? state.link.snapshotId : null,
    url: first.raw,
  };
}

/** §44: l'ordine dell'array è la posizione. Solo i media caricati: un fallito non parte in silenzio (§70). */
function toWireMedia(media: readonly ComposerMediaItem[]): WirePublishMedia[] {
  return media
    .filter((item) => item.uploadStatus === "uploaded" && item.storagePath !== null)
    .map((item) => ({
      alt_text: item.altText,
      duration_seconds: item.durationSeconds,
      height: item.height,
      media_type: item.type,
      storage_path: item.storagePath as string,
      thumbnail_path: null,
      width: item.width,
    }));
}

/** §117. Lancia se l'identity manca: `canPublish` lo impedisce a monte. */
export function toWirePublishArgs(
  state: ComposerState,
  operationKey: string,
  origin: ComposerOrigin,
): WirePublishPostArgs {
  if (!state.identity) {
    throw new Error("toWirePublishArgs: nessuna identity selezionata");
  }

  // Solo la coda: togliere spazi iniziali sposterebbe gli offset delle mention.
  const body = state.body.trimEnd();

  return {
    p_body: body,
    p_identity_id: state.identity.id,
    p_identity_type: state.identity.type,
    p_link: toWireLink({ ...state, body }),
    p_media: toWireMedia(state.media),
    p_mentions: toWireMentions(state.mentions, body.length),
    p_operation_key: operationKey,
    p_origin: origin,
    p_tagged: toWireTagged(state.tagged),
  };
}

/**
 * `p_link` di `update_post`: come `toWireLink`, più `dismiss_preview: true` solo
 * quando l'utente ha tolto (X) l'anteprima salvata di un URL invariato (§92–93,
 * §157). Senza snapshot e senza il flag il server conserva l'anteprima esistente.
 */
function toWireUpdateLink(state: ComposerState): WirePublishLink | null {
  const link = toWireLink(state);

  return link && dismissesStoredPreview(state) ? { ...link, dismiss_preview: true } : link;
}

/** §155–161: media e autore non viaggiano; la versione è quella letta all'apertura. */
export function toWireUpdateArgs(state: ComposerState): WireUpdatePostArgs {
  if (state.mode.kind !== "edit" || state.mode.expectedVersion === null) {
    throw new Error("toWireUpdateArgs: serve la modalità modifica con una versione");
  }

  const body = state.body.trimEnd();

  return {
    p_body: body,
    p_content_type: state.mode.contentType,
    p_expected_version: state.mode.expectedVersion,
    p_link: toWireUpdateLink({ ...state, body }),
    p_mentions: toWireMentions(state.mentions, body.length),
    p_post_id: state.mode.contentId,
    p_tagged: toWireTagged(state.tagged),
  };
}

/* ------------------------------------------------------------------ */
/* Errori (§169–177)                                                   */
/* ------------------------------------------------------------------ */

/**
 * La copy per codice. In Modifica il generico è «salvare», non «pubblicare».
 * Rete assente e ignoti usano la copy §175: non si simula mai un successo (§177).
 */
export function errorCopy(code: ComposerErrorKind, mode: "create" | "edit" = "create"): string {
  switch (code) {
    case "post_permission_denied":
      return COMPOSER_PERMISSION_LOST_COPY;
    case "post_edit_denied":
      return COMPOSER_EDIT_PERMISSION_LOST_COPY;
    case "post_version_conflict":
      return COMPOSER_CONFLICT_COPY;
    case "post_not_found":
      return COMPOSER_NOT_FOUND_COPY;
    case "post_media_limit":
      return COMPOSER_MEDIA_LIMIT_COPY;
    case "post_invalid_media":
      return "Uno dei contenuti non è valido. Rimuovilo e riprova.";
    case "post_invalid_mention":
      return "Una menzione non è più valida. Reinseriscila e riprova.";
    case "post_invalid_tag":
      return "Uno dei tag non è disponibile. Rimuovilo e riprova.";
    case "post_invalid_link":
      return "Il link non è valido. Controllalo e riprova.";
    // La chiave di idempotenza è già stata ruotata: «Riprova» è sicuro (§118).
    case "post_operation_conflict":
    case "post_invalid_content":
    case "network":
    case "unknown":
      return mode === "edit" ? COMPOSER_EDIT_ERROR_COPY : COMPOSER_PUBLISH_ERROR_COPY;
  }
}
