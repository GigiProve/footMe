/**
 * Regole pure del composer Repost (HOM-10 §14–§41, §61–§64, §120–§133, §137–§148,
 * §225–§233, §283–§288).
 *
 * Il composer Repost NON è un editor nuovo (§16): è il composer Post (HOM-06.1/06.2)
 * aperto con una reference. Qui vivono solo le derivazioni che lo distinguono —
 * cosa è «testo significativo», quale CTA mostrare, cosa blocca l'invio — così sono
 * testabili senza renderizzare e `composer-presentation.ts` le chiama senza
 * duplicarle.
 *
 * Importa dal composer SOLO tipi: `composer-presentation` importa da qui e un import
 * di valore nell'altra direzione sarebbe un ciclo.
 *
 * Decisione chiave (§61–§64): il Simple Repost o il Post con testo si decide dal
 * body NORMALIZZATO. Vuoti sono stringa vuota, soli whitespace, newline e caratteri
 * invisibili (§62). Le mention da sole non sono testo (stessa regola di HOM-06.1
 * §12–13 e di `footme_content_is_significant`): il token `@Nome` senza altro vale
 * un body vuoto, quindi «Reposta» fa un Simple Repost e il token si ignora.
 */

import type { FeedContentType } from "../feed/feed-types";
import type { Publication } from "../publishing/publishing-types";
import type { ComposerState } from "../post-composer/composer-reducer";
import type { ComposerIdentity, ComposerReference } from "../post-composer/composer-types";

/* ------------------------------------------------------------------ */
/* Copy (§23–§24, §39, §71–§72, §130, §175, §229, §288)                */
/* ------------------------------------------------------------------ */

export const REPOST_COMPOSER_COPY = {
  alreadyReposted: "Hai già ripostato questo contenuto.", // §125
  ctaAlreadyReposted: "Già ripostato", // §127
  ctaRepost: "Reposta", // §15, §146
  ctaSave: "Salva", // programmato riaperto (HOM-06.2 §167)
  ctaSchedule: "Programma", // §147–§148
  /** Stessa frase di `content_empty` (HOM-06.2): un programmato senza contenuto non si salva. */
  emptyScheduled: "Aggiungi un testo, un media o un link.",
  /** §288: quando il problema non è specificamente l'originale. */
  genericFailure: "Pubblicazione non riuscita. Riprova.",
  identitySheetTitle: "Reposta come", // §29
  microcopy: "Se lasci vuoto, riposterai il contenuto senza aggiungere testo.", // §24
  noIdentity: "Non hai profili con cui effettuare il repost.", // §41
  permissionLost: "Non hai più i permessi per effettuare il repost con questo profilo.", // §39
  // §23: una sola formulazione in tutta l'app.
  placeholder: "Aggiungi un testo al repost…",
  remove: "Rimuovi repost", // §128
  removeFailed: "Non è stato possibile rimuovere il repost. Riprova.",
  removed: "Repost rimosso", // §130
  simpleFailure: "Non è stato possibile effettuare il repost. Riprova.", // §72
  simpleSuccess: "Repost effettuato", // §71
  title: "Repost", // §15
  unavailable: "Il contenuto originale non è più disponibile.", // §229
} as const;

/** Codici con cui il server dice «la reference non è più valida» (§153–§155, §231). */
export const REFERENCE_UNAVAILABLE_CODES = ["repost_reference_unavailable"] as const;

export function isReferenceUnavailableCode(code: string | null | undefined): boolean {
  return code != null && (REFERENCE_UNAVAILABLE_CODES as readonly string[]).includes(code);
}

/* ------------------------------------------------------------------ */
/* Body significativo (§61–§64)                                        */
/* ------------------------------------------------------------------ */

/**
 * Caratteri che non si vedono: controllo/formato (ZWSP, ZWJ, BOM, soft hyphen,
 * marcatori bidi), selettori di variazione, riempitivi Hangul e braille vuoto. Gli
 * spazi (anche NBSP) li copre `\s`.
 *
 * È un SUPERINSIEME della regola del server (`footme_content_is_significant`): se il
 * client considera vuoto qualcosa che il server considera testo, l'utente fa un Simple
 * Repost e non perde nulla di visibile. L'unico buco nella direzione pericolosa (client
 * «significativo», server «vuoto» → `content_empty`) è il codepoint non assegnato
 * U+2065, trascurabile.
 */
const INVISIBLE = /[\s\p{Cc}\p{Cf}͏ᅟᅠ឴឵᠋-᠏⠀ㅤ︀-️ﾠ]/gu;

/** §62: il body senza spazi e senza caratteri invisibili. Vuoto = nessun testo. */
export function normalizeRepostBody(body: string): string {
  return body.replace(INVISIBLE, "");
}

type TextRange = { start: number; end: number };

function withoutRanges(body: string, ranges: readonly TextRange[]): string {
  let out = "";
  let cursor = 0;

  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    out += body.slice(cursor, range.start);
    cursor = Math.max(cursor, range.end);
  }

  return out + body.slice(cursor);
}

/** I token che la toolbar del Repost inserisce da soli (`@`, `https://`): non sono testo di chi scrive. */
const BARE_TOKEN_AT_END = /(?:@|https?:\/\/)$/i;

/**
 * §61–§64: `true` → nuovo Post con reference; `false` → Simple Repost.
 *
 * Un token della toolbar lasciato in fondo senza nulla dopo («@», «https://») non
 * conta: un tap per sbaglio su `@` o link e poi «Reposta» non deve pubblicare un Post
 * che dice solo «@». Il server non lo ferma, quindi lo decide il client. «Bravo @» resta
 * significativo (c'è «Bravo»); si tolgono i token in coda finché ce ne sono.
 */
export function isSignificantRepostBody(body: string, mentions: readonly TextRange[] = []): boolean {
  let text = normalizeRepostBody(withoutRanges(body, mentions));

  while (BARE_TOKEN_AT_END.test(text)) {
    text = text.replace(BARE_TOKEN_AT_END, "");
  }

  return text.length > 0;
}

/**
 * §21–§24 di HOM-06.1 + HOM-10 §28: nel Repost l'identità che ha aperto il composer è
 * quella della riga Condividi («Repost ✓» riguarda LEI), a prescindere dall'origine: il
 * default per origin (es. profilo → persona) la scavalcherebbe e si ripostarebbe con
 * un'altra identità. `null` se il suggerimento non è tra quelle autorizzate.
 */
export function hintFirstIdentity(
  identities: readonly ComposerIdentity[],
  hint: string | null | undefined,
): ComposerIdentity | null {
  return (hint ? identities.find((identity) => identity.id === hint) : undefined) ?? null;
}

/* ------------------------------------------------------------------ */
/* Stato del composer                                                  */
/* ------------------------------------------------------------------ */

type RepostStateView = Pick<
  ComposerState,
  | "body"
  | "identities"
  | "identity"
  | "limits"
  | "mentions"
  | "mode"
  | "publication"
  | "publish"
  | "reference"
> &
  Partial<Pick<ComposerState, "draft">>;

/** Un programmato riaperto (HOM-06.2 §163–§167): si salva con «Salva», non diventa un Simple Repost. */
function isScheduledEdit(state: Partial<Pick<ComposerState, "draft">>): boolean {
  return state.draft?.status === "scheduled";
}

/**
 * §16–§17: il composer è in modalità Repost quando è una CREAZIONE con una
 * reference. Una Modifica con reference (§158–§162) è il composer di Modifica
 * normale, con la card in sola lettura; una bozza riaperta con reference è di
 * nuovo un Repost (stesso editor, §140).
 */
export function isRepostComposer(state: Pick<ComposerState, "mode" | "reference">): boolean {
  // `Boolean` e non `!== null`: uno stato costruito senza il campo (test, snapshot vecchi) non è un Repost.
  return state.mode.kind === "create" && Boolean(state.reference);
}

export function sameRepostIdentity(
  a: Pick<ComposerIdentity, "type" | "id"> | null,
  b: Pick<ComposerIdentity, "type" | "id"> | null,
): boolean {
  return a !== null && b !== null && a.type === b.type && a.id === b.id;
}

/** §63–§64: l'esito tecnico che «Reposta» produrrebbe adesso. */
export function repostIntent(state: Pick<ComposerState, "body" | "mentions">): "simple" | "referenced" {
  return isSignificantRepostBody(state.body, state.mentions) ? "referenced" : "simple";
}

/** §120, §126: l'identità corrente ha già un Simple Repost attivo di questo originale. */
export function hasActiveSimpleRepost(state: Pick<ComposerState, "identity">): boolean {
  return state.identity?.hasSimpleRepost === true;
}

/**
 * §125: «Hai già ripostato» + «Rimuovi repost» compaiono con un Simple Repost
 * attivo, anche mentre l'utente scrive testo (§133: il Post con testo resta
 * possibile).
 */
export function shouldShowAlreadyReposted(state: RepostStateView): boolean {
  return isRepostComposer(state) && hasActiveSimpleRepost(state);
}

/** §144–§145, §341–§342: la riga «Pubblicazione» esiste solo con testo e `can_schedule_content`. */
export function shouldShowRepostPublication(state: RepostStateView): boolean {
  return (
    isRepostComposer(state) &&
    state.identity?.canSchedule === true &&
    isSignificantRepostBody(state.body, state.mentions)
  );
}

/**
 * Il motivo che blocca l'invio indipendentemente dal testo, o `null`. Non cancella
 * mai niente (§38, §230): lo schermo mostra la copy accanto al contenuto intatto.
 */
export function repostBlockReason(state: RepostStateView): string | null {
  const failure = state.publish.status === "failed" ? state.publish.code : null;

  // §155, §231, §287: mai una pubblicazione verso una reference sicuramente rotta. Per
  // prima: senza un originale non ha senso parlare di identità (e ne mancherebbero).
  if (state.reference?.available === false || isReferenceUnavailableCode(failure)) {
    return REPOST_COMPOSER_COPY.unavailable;
  }

  // §41: «nessun profilo» solo se non c'è mai stata un'identità. Un'identità selezionata che perde il
  // permesso e svuota la lista è «permesso perso» (§38–§39), non «nessun profilo».
  if (state.identities.length === 0 && !state.identity) {
    return REPOST_COMPOSER_COPY.noIdentity;
  }

  if (
    !state.identity ||
    !state.identities.some((candidate) => sameRepostIdentity(candidate, state.identity)) ||
    failure === "post_permission_denied" ||
    failure === "content_permission_denied"
  ) {
    return REPOST_COMPOSER_COPY.permissionLost; // §38–§39
  }

  // §33, §226: con testo serve anche `can_publish_post`.
  if (state.identity.canPublishPost === false && isSignificantRepostBody(state.body, state.mentions)) {
    return REPOST_COMPOSER_COPY.permissionLost;
  }

  // Un programmato svuotato non può diventare un Simple Repost in silenzio (§137, §150): resta un Post.
  if (isScheduledEdit(state) && repostIntent(state) === "simple") {
    return REPOST_COMPOSER_COPY.emptyScheduled;
  }

  return null;
}

/** §41, §127, §225–§226: la CTA è azionabile? */
export function canSubmitRepost(state: RepostStateView): boolean {
  if (state.publish.status === "publishing" || repostBlockReason(state) !== null) {
    return false;
  }

  // §126–§127: body vuoto + Simple Repost già attivo = nessun secondo Repost.
  if (repostIntent(state) === "simple" && hasActiveSimpleRepost(state)) {
    return false;
  }

  return state.body.length <= state.limits.maxBodyLength;
}

/**
 * §15, §127, §146–§148: «Reposta» (vuoto o Ora), «Programma» (data futura, solo
 * con testo), «Già ripostato» (vuoto + Simple Repost attivo). Mai «Reposta» per un
 * invio futuro (§148).
 */
export function repostCtaLabel(
  state: Pick<ComposerState, "body" | "identity" | "mentions" | "publication"> & Partial<Pick<ComposerState, "draft">>,
): string {
  // Un programmato riaperto resta un «Salva» (HOM-06.2 §167); senza testo è chiuso (vedi `repostBlockReason`).
  if (isScheduledEdit(state)) {
    return REPOST_COMPOSER_COPY.ctaSave;
  }

  if (!isSignificantRepostBody(state.body, state.mentions)) {
    return state.identity?.hasSimpleRepost === true
      ? REPOST_COMPOSER_COPY.ctaAlreadyReposted
      : REPOST_COMPOSER_COPY.ctaRepost;
  }

  return isFuturePublication(state.publication, state.identity)
    ? REPOST_COMPOSER_COPY.ctaSchedule
    : REPOST_COMPOSER_COPY.ctaRepost;
}

function isFuturePublication(publication: Publication, identity: ComposerIdentity | null): boolean {
  return publication.mode === "scheduled" && identity?.canSchedule === true;
}

/** §197 per analogia: l'etichetta parlata della riga identità («Reposta come …»). */
export function repostIdentityAccessibilityLabel(identity: ComposerIdentity): string {
  if (!identity.isVerified) {
    return `Reposta come ${identity.name}`;
  }

  const verified =
    identity.type === "person"
      ? "profilo verificato"
      : identity.type === "society"
        ? "società verificata"
        : "media verificato";

  return `Reposta come ${identity.name}, ${verified}`;
}

/**
 * La copy di un errore di INVIO con testo. Solo l'originale sparito e il permesso
 * perso hanno una frase propria (§229, §39); il resto è «Pubblicazione non riuscita»
 * (§288).
 */
export function referencedPostErrorCopy(code: string): string {
  if (isReferenceUnavailableCode(code)) {
    return REPOST_COMPOSER_COPY.unavailable;
  }

  if (code === "post_permission_denied" || code === "content_permission_denied") {
    return REPOST_COMPOSER_COPY.permissionLost;
  }

  return REPOST_COMPOSER_COPY.genericFailure;
}

/** `reference` di `save_content_draft` / `submit_content` (§88, §139). */
export function referencePayload(reference: Pick<ComposerReference, "contentId" | "contentType">): {
  content_id: string;
  content_type: FeedContentType;
} {
  return { content_id: reference.contentId, content_type: reference.contentType };
}

/* ------------------------------------------------------------------ */
/* Toolbar ristretta (§17–§18, §92–§96)                                */
/* ------------------------------------------------------------------ */

export type ToolbarInsertion = { body: string; cursor: number };

/**
 * Inserisce `token` alla selezione (`@` o `https://`). `@` deve aprire il testo o
 * seguire uno spazio per attivare l'autocomplete (`mentionQueryAt`): se il carattere
 * prima non è uno spazio se ne aggiunge uno. Il cursore va subito dopo il token.
 */
export function insertTokenAtSelection(
  body: string,
  selection: { start: number; end: number },
  token: string,
): ToolbarInsertion {
  const start = Math.min(Math.max(selection.start, 0), body.length);
  const end = Math.min(Math.max(selection.end, start), body.length);
  const before = body.slice(0, start);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const inserted = `${needsSpace ? " " : ""}${token}`;

  return {
    body: before + inserted + body.slice(end),
    cursor: before.length + inserted.length,
  };
}
