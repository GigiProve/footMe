/**
 * Query key di FeedFeedback (HOM-11 §47–§49). Un posto solo, così lettura e
 * invalidazioni non divergono.
 *
 * I motivi sono uguali per ogni utente ma sono dati del server: la key non porta il
 * profilo, e vive finché il server non li cambia (`staleTime` lungo nel hook).
 */

export const FEED_FEEDBACK_QK = {
  all: ["feed-feedback"] as const,
  reasons: () => ["feed-feedback", "reasons"] as const,
};
