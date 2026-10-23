/**
 * Vecchio indirizzo del dettaglio gestionale.
 *
 * DAS-REV-17 §6 chiede che il dettaglio mostri la bottom navigation con
 * Dashboard selezionata, e una route fuori dalle tab non può farlo: la
 * destinazione è ora `(tabs)/dashboard/positions/[id]`. Questa resta come
 * reindirizzamento perché un link già aperto o salvato non deve finire su
 * una pagina vuota.
 */
import { Redirect, useLocalSearchParams } from "expo-router";

import { MANAGE_HREFS } from "../../src/features/dashboard/positions/manage/manage-routes";

export default function SocietyPositionDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <Redirect href={MANAGE_HREFS.detail(typeof id === "string" ? id : "") as never} />
  );
}
