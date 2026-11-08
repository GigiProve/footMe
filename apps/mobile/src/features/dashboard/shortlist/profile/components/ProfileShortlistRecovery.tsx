/**
 * Recupero «Lista creata» (DAS-REV-26 §19 — screen 16).
 *
 * La creazione dal profilo è transazionale (20261106090000, sezione 10):
 * nel percorso sano lista e membership nascono insieme. Questa vista
 * rappresenta l'esito che il server può comunque restituire per la stessa
 * operazione — la ricevuta di una lista confermata la cui membership
 * iniziale non è attiva — e non dichiara mai un successo che non c'è.
 *
 * «Riprova aggiunta usa lo stesso shortlist_id e la stessa operazione
 * correlata; non chiama nuovamente una creazione indipendente e non cerca
 * la lista per nome.» «Apri lista apre il dettaglio CUSTOM canonico, anche
 * vuoto.»
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";
import { PROFILE_SHORTLIST_COPY, recoveryBody } from "../profile-shortlist-presentation";

type Props = {
  busy: boolean;
  listName: string;
  onOpenList: () => void;
  onRetry: () => void;
  personName: string;
  scopeLabel: string;
};

export function ProfileShortlistRecovery({
  busy,
  listName,
  onOpenList,
  onRetry,
  personName,
  scopeLabel,
}: Props) {
  return (
    <View style={styles.root} testID="profile-shortlist-recovery">
      <Ionicons color={colors.textNeutralSoft} name="document-text-outline" size={44} />
      <AppText accessibilityRole="header" align="center" color="neutral" variant="titleMd">
        {PROFILE_SHORTLIST_COPY.recoveryTitle}
      </AppText>
      <View style={styles.meta}>
        <AppText align="center" color="neutral" variant="bodyLg">
          {listName}
        </AppText>
        <AppText align="center" color="neutralMuted" variant="meta">
          {`${scopeLabel} · ${PROFILE_SHORTLIST_COPY.formAccessValue}`}
        </AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" align="center" color="neutralMuted" variant="bodySm">
        {recoveryBody(personName)}
      </AppText>
      <Button
        fullWidth
        label={PROFILE_SHORTLIST_COPY.retryAdd}
        loading={busy}
        onPress={onRetry}
        testID="profile-shortlist-retry-add"
        variant="primary"
      />
      <Button
        fullWidth
        label={PROFILE_SHORTLIST_COPY.openList}
        onPress={onOpenList}
        testID="profile-shortlist-open-list"
        variant="link"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: spacing[12],
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  meta: {
    alignItems: "center",
    gap: spacing[4],
  },
});
