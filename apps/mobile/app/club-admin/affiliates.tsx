/**
 * Vecchia rotta delle Società affiliate (DAS-REV-11 §2).
 *
 * Qui viveva l'editor manuale: un elenco che il club compilava da solo,
 * senza che l'altra società lo sapesse, e che finiva sul profilo pubblico e
 * in Cerca. §2 chiede che «Società collegate apra direttamente il nuovo
 * centro Rete societaria» e che non resti «una pagina intermedia con un
 * secondo elenco delle stesse relazioni».
 *
 * La rotta resta solo per i deep link già in circolazione e reindirizza.
 */
import { Redirect } from "expo-router";

export default function ClubAffiliatesScreen() {
  return <Redirect href="/(tabs)/dashboard/network" />;
}
