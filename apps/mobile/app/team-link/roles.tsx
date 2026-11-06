/**
 * Ruoli dirigenziali consentiti (DAS-REV-20, screen 03).
 *
 * Raggiungibile solo con Dirigenti fra le categorie: §12 ricorda che «Tutta
 * la squadra include Dirigenti e quindi richiede la relativa
 * configurazione».
 */
import { JoinLinkRolesScreen } from "../../src/features/dashboard/join-links/compose/JoinLinkRolesScreen";

export default function TeamLinkRolesRoute() {
  return <JoinLinkRolesScreen />;
}
