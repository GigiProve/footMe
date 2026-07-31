/**
 * Regole del ripristino della posizione di lettura (§18) — funzioni pure.
 *
 * Sono estratte dai componenti perché sono la parte del §18 più facile da
 * sbagliare e l'unica che si può verificare senza un renderer.
 */

import type { FeedScrollState } from "./feed-cache";

/**
 * Un offset salvato si applica SOLO se la lista mostrata è quella da cui
 * l'offset proviene.
 *
 * `hydratedFromCache` è il vincolo che conta: se la lista è stata rifetchata da
 * zero, l'offset punta a contenuti che non ci sono più e il ripristino
 * atterrerebbe in un punto arbitrario. `itemCount` copre il caso in cui la
 * lista si è accorciata rispetto a quando l'offset è stato salvato.
 */
export function shouldRestoreOffset(
  saved: FeedScrollState | null,
  itemCount: number,
  hydratedFromCache: boolean,
): boolean {
  if (!saved || !hydratedFromCache) {
    return false;
  }

  // Sotto la soglia il ripristino non si distingue dal normale inizio lista.
  if (saved.offset <= MIN_RESTORE_OFFSET) {
    return false;
  }

  return saved.itemCount <= itemCount;
}

/** Sotto questa soglia non vale la pena ripristinare nulla. */
export const MIN_RESTORE_OFFSET = 8;

/** ~1,5 schermate: sotto questa profondità "Riprendi da dove eri" è rumore. */
export const RESUME_BANNER_MIN_OFFSET = 800;

const MINUTE_MS = 60 * 1000;
/** Sotto i 30 minuti l'utente non si è mai davvero allontanato. */
export const RESUME_BANNER_MIN_AGE_MS = 30 * MINUTE_MS;
/** Oltre le 24 ore la posizione è stantia: meglio ripartire dall'inizio. */
export const RESUME_BANNER_MAX_AGE_MS = 24 * 60 * MINUTE_MS;
/** Tra due comparse dello stesso banner passano almeno 6 ore. */
export const RESUME_BANNER_COOLDOWN_MS = 6 * 60 * MINUTE_MS;

/**
 * Il §18 chiede un banner che "non compaia continuamente". Le quattro
 * condizioni sono in AND, ognuna con un motivo diverso:
 *  • profondità: solo per una posizione realmente profonda;
 *  • finestra temporale: né troppo recente né troppo vecchia;
 *  • una volta per sessione JS e per tab (`alreadyShownThisSession`);
 *  • cooldown persistito, per non riproporlo a ogni riavvio dell'app.
 */
export function shouldShowResumeBanner({
  restoredOffset,
  savedAt,
  now,
  bannerShownAt,
  alreadyShownThisSession,
}: {
  restoredOffset: number;
  savedAt: string | null;
  now: number;
  bannerShownAt: string | null;
  alreadyShownThisSession: boolean;
}): boolean {
  if (alreadyShownThisSession || restoredOffset < RESUME_BANNER_MIN_OFFSET) {
    return false;
  }

  if (!savedAt) {
    return false;
  }

  const savedTime = new Date(savedAt).getTime();
  if (Number.isNaN(savedTime)) {
    return false;
  }

  const age = now - savedTime;
  if (age < RESUME_BANNER_MIN_AGE_MS || age > RESUME_BANNER_MAX_AGE_MS) {
    return false;
  }

  if (bannerShownAt) {
    const shownTime = new Date(bannerShownAt).getTime();
    if (!Number.isNaN(shownTime) && now - shownTime < RESUME_BANNER_COOLDOWN_MS) {
      return false;
    }
  }

  return true;
}

/**
 * L'helper "Solo contenuti dei profili e delle società che segui." va mostrato
 * nei primi accessi e poi smesso: il §13 dice esplicitamente di non ripeterlo
 * a ogni accesso quando diventa ridondante.
 */
export const FOLLOWING_HINT_MAX_SHOWS = 3;

export function shouldShowFollowingHint(shownCount: number): boolean {
  return shownCount < FOLLOWING_HINT_MAX_SHOWS;
}
