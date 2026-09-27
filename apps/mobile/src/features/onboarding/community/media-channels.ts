/**
 * Canali esterni del Media / Creator (REV-ONB-09 §21–§23).
 *
 * Instagram e TikTok accettano sia lo username sia l'URL completo; il sito
 * web accetta anche un dominio senza protocollo. La normalizzazione avviene
 * al salvataggio, non mentre si digita: `validateMediaChannel` non cancella
 * mai il valore scritto dall'utente, restituisce solo il verdetto e la forma
 * normalizzata da persistere.
 */
import {
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "../../profiles/profile-form-utils";

export type MediaChannelKey =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "website";

export type MediaChannelResult = {
  /** Valore da salvare. Vuoto quando il campo è vuoto. */
  normalized: string;
  /** `false` solo per un valore scritto ma non interpretabile. */
  isValid: boolean;
};

const EMPTY: MediaChannelResult = { isValid: true, normalized: "" };

const HANDLE_PATTERN = /^[A-Za-z0-9._-]+$/;
const DOMAIN_PATTERN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/[^\s]*)?$/;

/** §23: un campo opzionale lasciato vuoto non è un errore. */
export function validateMediaChannel(
  key: MediaChannelKey,
  rawValue: string,
): MediaChannelResult {
  const value = rawValue.trim();

  if (!value) {
    return EMPTY;
  }

  switch (key) {
    case "instagram":
      return fromLegacyNormalizer(normalizeInstagramInput(value));
    case "facebook":
      return fromLegacyNormalizer(normalizeFacebookInput(value));
    case "tiktok":
      return normalizeTikTok(value);
    case "youtube":
      return normalizeYouTube(value);
    case "website":
      return normalizeWebsite(value);
    default:
      return EMPTY;
  }
}

/**
 * I normalizzatori storici del profilo restituiscono stringa vuota quando il
 * valore non è interpretabile. Qui quel vuoto diventa un errore esplicito:
 * l'utente ha scritto qualcosa, non va silenziosamente buttato (§23).
 */
function fromLegacyNormalizer(normalized: string): MediaChannelResult {
  return normalized
    ? { isValid: true, normalized }
    : { isValid: false, normalized: "" };
}

function normalizeTikTok(value: string): MediaChannelResult {
  const handle = value.replace(/^@+/, "");

  if (/^https?:\/\//i.test(handle)) {
    const match = handle.match(
      /^https?:\/\/(?:www\.)?tiktok\.com\/@?([A-Za-z0-9._]+)\/?(?:\?.*)?$/i,
    );

    return match?.[1]
      ? { isValid: true, normalized: `https://tiktok.com/@${match[1]}` }
      : { isValid: false, normalized: "" };
  }

  return HANDLE_PATTERN.test(handle)
    ? { isValid: true, normalized: `https://tiktok.com/@${handle}` }
    : { isValid: false, normalized: "" };
}

/**
 * §22: YouTube accetta l'URL del canale e, dove c'è, l'handle `@nome`. Un
 * URL YouTube valido viene tenuto così com'è: `/channel/UC…`, `/c/nome` e
 * `/@handle` sono tutte forme legittime e riscriverle le romperebbe.
 */
function normalizeYouTube(value: string): MediaChannelResult {
  if (/^https?:\/\//i.test(value)) {
    return /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+$/i.test(value)
      ? { isValid: true, normalized: value.replace(/\/+$/, "") }
      : { isValid: false, normalized: "" };
  }

  if (value.startsWith("@")) {
    const handle = value.slice(1);

    return HANDLE_PATTERN.test(handle)
      ? { isValid: true, normalized: `https://youtube.com/@${handle}` }
      : { isValid: false, normalized: "" };
  }

  if (/^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(value)) {
    return { isValid: true, normalized: `https://${value.replace(/^www\./i, "").replace(/\/+$/, "")}` };
  }

  return { isValid: false, normalized: "" };
}

/** §44: un sito senza protocollo è valido — lo aggiungiamo noi. */
function normalizeWebsite(value: string): MediaChannelResult {
  if (/^https?:\/\//i.test(value)) {
    const withoutProtocol = value.replace(/^https?:\/\//i, "");

    return DOMAIN_PATTERN.test(withoutProtocol)
      ? { isValid: true, normalized: value.replace(/\/+$/, "") }
      : { isValid: false, normalized: "" };
  }

  return DOMAIN_PATTERN.test(value)
    ? { isValid: true, normalized: `https://${value.replace(/\/+$/, "")}` }
    : { isValid: false, normalized: "" };
}
