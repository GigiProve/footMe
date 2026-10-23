/**
 * Step 2 con più Position — «Configura le posizioni» (screen 04).
 *
 * Esiste come route separata e non come stato dello step 1 perché il back
 * dal dettaglio deve tornare **qui** (§27): una schermata condizionale
 * avrebbe riportato l'utente al form di creazione.
 */
import { PositionComposeHubScreen } from "../../src/features/dashboard/positions/compose/PositionComposeHubScreen";

export default function PositionComposeHubRoute() {
  return <PositionComposeHubScreen />;
}
