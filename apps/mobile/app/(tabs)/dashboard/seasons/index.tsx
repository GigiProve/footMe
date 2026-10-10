import { SeasonsCenterScreen } from "../../../../src/features/teams/seasons/SeasonsCenterScreen";

/**
 * Centro Stagioni e storico (DAS-REV-10 §9, screen 01).
 *
 * Figlio dello Stack della tab Dashboard, come il Centro Squadre: la bottom
 * navigation resta visibile con Dashboard selezionata.
 */
export default function SeasonsCenterRoute() {
  return <SeasonsCenterScreen />;
}
