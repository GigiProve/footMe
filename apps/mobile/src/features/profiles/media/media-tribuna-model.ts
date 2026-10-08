/**
 * Modello della Tribuna editoriale (REV-PROF-21, Screen 3).
 *
 * I quattro content type sono quelli che esistono già — sondaggio editoriale,
 * dibattito da articolo, vota il migliore, Q&A community — e REV-PROF-21 non
 * ne introduce nessuno. Qui vivono le loro etichette, la regola di
 * ordinamento e il calcolo ottimistico del voto: tre cose che la card
 * dell'anteprima e il dettaglio condiviso devono fare allo stesso modo, e che
 * prima stavano dentro un componente da 4.000 righe.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import type {
  MediaTribunaKind,
  MediaTribunaPost,
  MediaTribunaQuestion,
} from "../media-tribuna-service";

/** Tutti e quattro: la Tribuna non filtra per tipo, li mostra insieme. */
export const MEDIA_TRIBUNA_KINDS: readonly MediaTribunaKind[] = [
  "editorial_poll",
  "article_debate",
  "player_vote",
  "community_qa",
];

const TRIBUNA_LABELS: Record<MediaTribunaKind, string> = {
  article_debate: "Dibattito",
  community_qa: "Q&A",
  editorial_poll: "Sondaggio",
  player_vote: "Vota il migliore",
};

const TRIBUNA_ICONS: Record<
  MediaTribunaKind,
  keyof typeof Ionicons.glyphMap
> = {
  article_debate: "chatbox-outline",
  community_qa: "help-circle-outline",
  editorial_poll: "bar-chart-outline",
  player_vote: "star-outline",
};

export function formatMediaTribunaLabel(kind: MediaTribunaKind): string {
  return TRIBUNA_LABELS[kind] ?? "Tribuna";
}

export function getMediaTribunaIcon(
  kind: MediaTribunaKind,
): keyof typeof Ionicons.glyphMap {
  return TRIBUNA_ICONS[kind] ?? "chatbubbles-outline";
}

/** `true` per i tipi che si votano scegliendo un'opzione. */
export function isMediaTribunaVotable(kind: MediaTribunaKind): boolean {
  return kind === "editorial_poll" || kind === "player_vote";
}

/**
 * Ordinamento della Tribuna: dalla pubblicazione più recente. Mai per data di
 * aggiornamento e mai per data dell'ultimo voto — un sondaggio vecchio che
 * riceve un voto non torna in cima.
 */
export function sortMediaTribunaPosts(
  posts: readonly MediaTribunaPost[],
): MediaTribunaPost[] {
  return [...posts].sort((left, right) =>
    (right.published_at ?? right.created_at).localeCompare(
      left.published_at ?? left.created_at,
    ),
  );
}

/**
 * Domande di un Q&A: le più votate in cima, a pari voti la più vecchia prima.
 */
export function sortMediaTribunaQuestions(
  questions: readonly MediaTribunaQuestion[],
): MediaTribunaQuestion[] {
  return [...questions].sort((left, right) => {
    if (left.vote_count !== right.vote_count) {
      return right.vote_count - left.vote_count;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

/**
 * Stato ottimistico dopo un voto. Le percentuali si ricalcolano su un totale
 * coerente — un secondo voto sullo stesso sondaggio sposta la preferenza, non
 * aggiunge un votante — e nessun conteggio scende sotto zero. In caso di
 * errore il chiamante rimette lo stato precedente.
 */
export function buildVotedMediaTribunaState(
  post: MediaTribunaPost,
  optionId: string,
): Pick<MediaTribunaPost, "options" | "total_vote_count"> {
  const previousVoted = post.options.find((option) => option.is_voted);
  const totalVoteCount = post.total_vote_count + (previousVoted ? 0 : 1);

  const options = post.options.map((option) => {
    const wasVoted = option.is_voted;
    const isVoted = option.id === optionId;
    const voteCount = Math.max(
      0,
      option.vote_count + (isVoted && !wasVoted ? 1 : 0) - (!isVoted && wasVoted ? 1 : 0),
    );

    return {
      ...option,
      is_voted: isVoted,
      percentage:
        totalVoteCount > 0
          ? Math.round((voteCount / totalVoteCount) * 100)
          : 0,
      vote_count: voteCount,
    };
  });

  return { options, total_vote_count: totalVoteCount };
}

/** Il viewer ha già espresso una preferenza su questo contenuto. */
export function hasVotedMediaTribuna(post: MediaTribunaPost): boolean {
  return post.options.some((option) => option.is_voted);
}

/** "368 voti · 52 commenti", senza le voci che valgono zero. */
export function formatMediaTribunaCounts(post: MediaTribunaPost): string[] {
  const parts: string[] = [];

  if (isMediaTribunaVotable(post.kind) && post.total_vote_count > 0) {
    parts.push(
      `${post.total_vote_count} ${post.total_vote_count === 1 ? "voto" : "voti"}`,
    );
  }

  if (post.kind === "community_qa" && post.question_count > 0) {
    parts.push(
      `${post.question_count} ${post.question_count === 1 ? "domanda" : "domande"}`,
    );
  }

  if (post.comment_count > 0) {
    parts.push(
      `${post.comment_count} ${post.comment_count === 1 ? "commento" : "commenti"}`,
    );
  }

  return parts;
}
