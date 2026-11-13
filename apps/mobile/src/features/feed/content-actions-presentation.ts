/**
 * Azioni di gestione di un contenuto pubblicato (HOM-04 §14–20, §28–32, §131–133).
 *
 * Logica pura, senza React: è ciò che rende testabile la matrice delle
 * capability (§136–138) e il copy per tipo (§140–141) senza renderizzare nulla.
 *
 * Il client NON deduce i permessi (§21, §96): `buildContentActions` riceve le
 * tre capability dal server e le traduce in righe. Capability falsa = riga
 * assente, mai disabilitata (§28–29). L'ordine è fisso: Modifica → Dettagli e
 * statistiche → (divisore) → Elimina (§15). Il divisore lo disegna il foglio e
 * solo se sopra c'è un'altra azione.
 */

import type { ContentManageTarget, ContentOrigin } from "./content-routes";
import type { ContentAnalyticsProps } from "./feed-analytics";
import type {
  FeedContentItem,
  FeedContentType,
  FeedItemType,
  FeedPostCapabilities,
} from "./feed-types";

/** §133: id stabili, indipendenti dal copy. */
export const CONTENT_ACTION_IDS = {
  delete: "DELETE_CONTENT",
  edit: "EDIT_CONTENT",
  insights: "VIEW_INSIGHTS",
} as const;

export type ContentActionId = (typeof CONTENT_ACTION_IDS)[keyof typeof CONTENT_ACTION_IDS];

/**
 * §17–20: il nome che l'utente vede. Il Video social è un Post (§18), l'Articolo
 * è un articolo, il video editoriale è un «contenuto» (§19): mai il nome tecnico.
 */
export type ContentVisibleKind = "post" | "article" | "content";

export type ContentManageCapabilities = Pick<
  FeedPostCapabilities,
  "canDelete" | "canEdit" | "canViewInsights"
>;

export type ContentActionDescriptor = {
  id: ContentActionId;
  label: string;
  icon: "create-outline" | "stats-chart-outline" | "trash-outline";
  destructive?: boolean;
  dividerBefore?: boolean;
};

export type ContentKindCopy = {
  edit: string;
  delete: string;
  confirmTitle: string;
  confirmMessage: string;
  /** §48: feedback leggero, nessuna pagina di successo. */
  deleted: string;
  /** §69: eliminazione fallita. */
  deleteFailed: string;
};

export const CONTENT_INSIGHTS_LABEL = "Dettagli e statistiche";
export const CONTENT_ACTIONS_SHEET_LABEL = "Azioni contenuto";
export const CONTENT_DELETE_CONFIRM_LABEL = "Elimina";
/** §71 */
export const CONTENT_PERMISSION_LOST = "Non hai più i permessi per eseguire questa operazione.";
/** §75, §77: il server risponde `unavailable` — non diciamo «eliminato» su un contenuto che forse non lo è. */
export const CONTENT_NO_LONGER_AVAILABLE = "Questo contenuto non è più disponibile.";
/** Destinazione non ancora esistente (HOM-05 / HOM-06.1 / HOM-06.2). */
export const CONTENT_ACTION_SOON = "Questa funzione arriverà presto.";

/** §40–42 e §48, §69: copy centrale per tipo. */
export const CONTENT_KIND_COPY: Record<ContentVisibleKind, ContentKindCopy> = {
  article: {
    confirmMessage: "L’articolo non sarà più visibile su PROLINK. Questa azione non può essere annullata.",
    confirmTitle: "Eliminare questo articolo?",
    delete: "Elimina articolo",
    deleted: "Articolo eliminato",
    deleteFailed: "Non è stato possibile eliminare l’articolo. Riprova.",
    edit: "Modifica articolo",
  },
  content: {
    confirmMessage: "Il contenuto non sarà più visibile su PROLINK. Questa azione non può essere annullata.",
    confirmTitle: "Eliminare questo contenuto?",
    delete: "Elimina contenuto",
    deleted: "Contenuto eliminato",
    deleteFailed: "Non è stato possibile eliminare il contenuto. Riprova.",
    edit: "Modifica contenuto",
  },
  post: {
    confirmMessage: "Il post non sarà più visibile su PROLINK. Questa azione non può essere annullata.",
    confirmTitle: "Eliminare questo post?",
    delete: "Elimina post",
    deleted: "Post eliminato",
    deleteFailed: "Non è stato possibile eliminare il post. Riprova.",
    edit: "Modifica post",
  },
};

/** Tipo visibile di un elemento del Feed: `post` → post, `article` → articolo, `video` → contenuto. */
export function visibleKindOfItemType(itemType: FeedItemType): ContentVisibleKind {
  if (itemType === "article") {
    return "article";
  }
  return itemType === "video" ? "content" : "post";
}

/**
 * Tipo visibile di un contenuto aperto dal dettaglio, dove non c'è un elemento
 * del Feed: solo `media_profile` può essere un Articolo o un video editoriale.
 */
export function visibleKindOfContentType(
  contentType: FeedContentType,
  isVideo: boolean,
): ContentVisibleKind {
  if (contentType !== "media_profile") {
    return "post";
  }
  return isVideo ? "content" : "article";
}

/** §15, §28–32: le azioni disponibili, nell'ordine definitivo. */
export function buildContentActions(
  kind: ContentVisibleKind,
  capabilities: ContentManageCapabilities,
): ContentActionDescriptor[] {
  const copy = CONTENT_KIND_COPY[kind];
  const actions: ContentActionDescriptor[] = [];

  if (capabilities.canEdit) {
    actions.push({ icon: "create-outline", id: CONTENT_ACTION_IDS.edit, label: copy.edit });
  }
  if (capabilities.canViewInsights) {
    actions.push({
      icon: "stats-chart-outline",
      id: CONTENT_ACTION_IDS.insights,
      label: CONTENT_INSIGHTS_LABEL,
    });
  }
  if (capabilities.canDelete) {
    actions.push({
      destructive: true,
      dividerBefore: true,
      icon: "trash-outline",
      id: CONTENT_ACTION_IDS.delete,
      label: copy.delete,
    });
  }

  return actions;
}

/**
 * §131–132: il menu aggrega descrittori di più moduli. Un id compare una sola
 * volta (vince la prima occorrenza), e le azioni distruttive di gestione
 * restano in fondo.
 */
export function composeActionList<T extends { id?: string; destructive?: boolean }>(
  ...groups: readonly (readonly T[])[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const action of groups.flat()) {
    if (action.id) {
      if (seen.has(action.id)) {
        continue;
      }
      seen.add(action.id);
    }
    merged.push(action);
  }

  return merged;
}

export function hasManagementActions(capabilities: ContentManageCapabilities): boolean {
  return capabilities.canEdit || capabilities.canViewInsights || capabilities.canDelete;
}

/** §72: dopo un permesso negato le tre capability di gestione vanno a falso subito. */
export const NO_MANAGE_CAPABILITIES: ContentManageCapabilities = {
  canDelete: false,
  canEdit: false,
  canViewInsights: false,
};

/** §135: le sole proprietà degli eventi di gestione. Mai il testo del contenuto. */
export function contentAnalyticsProps(target: ContentManageTarget): ContentAnalyticsProps {
  return {
    authorIdentityType: target.authorIdentityType,
    contentId: target.contentId,
    contentType: target.contentType,
    origin: target.origin,
  };
}

/**
 * Il bersaglio di gestione di un elemento del Feed: id, tipo, identità autrice,
 * provenienza e versione (§34, §37). Il tipo visibile segue il tipo di elemento.
 */
export function buildManageTarget(
  item: FeedContentItem,
  origin: ContentOrigin,
): ContentManageTarget & { itemId: string; visibleKind: ContentVisibleKind } {
  return {
    authorIdentityId: item.author?.id ?? null,
    authorIdentityType: item.payload.authorIdentityType,
    contentId: item.payload.postId,
    contentType: item.payload.contentType,
    itemId: item.id,
    origin,
    version: item.payload.version,
    visibleKind: visibleKindOfItemType(item.type),
  };
}
