/**
 * Derivazioni pure del wizard «Crea gruppo» (DAS-REV-32 §12, §13, §16).
 *
 * Qui sta ciò che il componente non deve decidere da solo: quale Società
 * risolve l'ingresso (Dashboard o Messaggi), quale copy ha un errore di
 * immagine e come si accumulano le persone note per il riepilogo. Testato in
 * `group-compose-model.test.ts` senza renderizzare nulla.
 */
import { GROUPS_COPY } from "../groups-copy";
import type { GroupAvatarErrorCode } from "../groups-service";
import type { EligiblePerson, GroupComposeOrigin, GroupCreateContext } from "../groups-types";

/** Quante persone mostra il riepilogo prima del «+N» (§20). */
export const SUMMARY_PREVIEW_MAX = 6;

export type ComposeSociety = {
  clubId: string;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
};

export type SocietyResolution =
  | { status: "loading" }
  | { status: "unavailable" }
  | { contexts: GroupCreateContext[]; status: "choose" }
  | { society: ComposeSociety; status: "ready" };

function ofContext(context: GroupCreateContext): ComposeSociety {
  return {
    clubId: context.clubId,
    isVerified: context.isVerified,
    logoUrl: context.logoUrl,
    name: context.clubName,
  };
}

/**
 * §12: da Dashboard la Società è quella dell'identity (e deve essere una
 * Società: PERSON e MEDIA non possiedono gruppi organizzativi). Da Messaggi
 * valgono i contesti restituiti dal server: nessuno → niente; uno → diretto;
 * più → selector preliminare. Un `clubId` fuori dai contesti non si usa.
 */
export function resolveComposeSociety(input: {
  clubIdParam: string | null;
  contexts: readonly GroupCreateContext[] | null;
  contextsFailed: boolean;
  identity: { avatarUrl: string | null; id: string; isVerified: boolean; kind: string; name: string } | null;
  identityLoading: boolean;
  origin: GroupComposeOrigin;
  picked: string | null;
}): SocietyResolution {
  if (input.origin === "dashboard") {
    if (!input.identity) {
      return input.identityLoading ? { status: "loading" } : { status: "unavailable" };
    }

    if (input.identity.kind !== "society") {
      return { status: "unavailable" };
    }

    return {
      society: {
        clubId: input.identity.id,
        isVerified: input.identity.isVerified,
        logoUrl: input.identity.avatarUrl,
        name: input.identity.name,
      },
      status: "ready",
    };
  }

  if (!input.contexts) {
    return input.contextsFailed ? { status: "unavailable" } : { status: "loading" };
  }

  const wanted = input.picked ?? input.clubIdParam;

  if (wanted) {
    const found = input.contexts.find((context) => context.clubId === wanted);

    return found ? { society: ofContext(found), status: "ready" } : { status: "unavailable" };
  }

  if (input.contexts.length === 0) {
    return { status: "unavailable" };
  }

  if (input.contexts.length === 1) {
    return { society: ofContext(input.contexts[0]), status: "ready" };
  }

  return { contexts: [...input.contexts], status: "choose" };
}

/** §16: un avatar in errore si spiega, non si ignora. */
export function avatarErrorMessage(code: GroupAvatarErrorCode | null): string {
  switch (code) {
    case "permission_denied":
      return GROUPS_COPY.imagePermission;
    case "avatar_format":
      return GROUPS_COPY.imageFormat;
    case "avatar_too_large":
      return GROUPS_COPY.imageTooLarge;
    default:
      return GROUPS_COPY.imageError;
  }
}

/**
 * Accumula le persone viste nelle pagine, per ID, per il riepilogo (§20).
 * Restituisce lo stesso oggetto se non c'è nulla di nuovo: chi lo usa in un
 * setState non innesca un render in più.
 */
export function mergeKnownPeople(
  known: Readonly<Record<string, EligiblePerson>>,
  people: readonly EligiblePerson[],
): Record<string, EligiblePerson> {
  let next: Record<string, EligiblePerson> | null = null;

  for (const person of people) {
    if (!known[person.profileId]) {
      next = next ?? { ...known };
      next[person.profileId] = person;
    }
  }

  return next ?? (known as Record<string, EligiblePerson>);
}
