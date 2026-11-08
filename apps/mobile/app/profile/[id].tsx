/**
 * Profilo pubblico.
 *
 * DAS-REV-26 §8: la stella Shortlist opera nel contesto della Società già
 * scelta nell'app — «Riutilizza il contesto Society già scelto nell'app. Non
 * chiedere ogni volta "Per quale società?"». Il provider di identità della
 * Dashboard risolve lo stesso contesto (stessa preferenza per utente, stessa
 * cache delle identità) anche su questa route, che vive fuori dalle tab, come
 * già fanno `position-manage/` e `society-position/`.
 *
 * Il provider non cambia nulla del profilo pubblico: per un visitatore senza
 * una Società amministrata `current` non è una Società e la stella non c'è.
 */
import { DashboardIdentityProvider } from "../../src/features/dashboard/identity/DashboardIdentityProvider";
import { PublicProfileScreen } from "../../src/features/profiles/PublicProfileScreen";

export default function PublicProfileRoute() {
  return (
    <DashboardIdentityProvider>
      <PublicProfileScreen />
    </DashboardIdentityProvider>
  );
}
