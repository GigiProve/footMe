/**
 * Barra operativa del dettaglio (§15, §20, §22 — screen 05-10).
 *
 * Una primaria sola, sempre nello stesso posto: §15 — «barra operativa con
 * primaria shortlist e secondaria Messaggio», e «mantieni una sola
 * primaria».
 *
 * Lo stato dopo l'aggiunta non è un successo celebrato: §20 — «Dopo conferma
 * mostra **✓ In shortlist**, con superficie grigio neutro e testo nero. Non
 * usare verde decorativo, popup di successo o una schermata celebrativa.» È
 * anche **non tappabile**: «Non rendere In shortlist un comando nascosto di
 * rimozione.»
 *
 * Un'azione non autorizzata non diventa un pulsante disabilitato: §22 — «Se
 * il sistema non consente alla Society corrente di scrivere, nascondi
 * l'azione non autorizzata.» Lo stesso vale per la shortlist.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { APPLICATIONS_COPY } from "../applications-presentation";

type Props = {
  bottomInset: number;
  canAddShortlist: boolean;
  canMessage: boolean;
  inShortlist: boolean;
  messageBusy: boolean;
  onAddShortlist: () => void;
  onMessage: () => void;
  shortlistBusy: boolean;
};

export function ApplicationActionBar({
  bottomInset,
  canAddShortlist,
  canMessage,
  inShortlist,
  messageBusy,
  onAddShortlist,
  onMessage,
  shortlistBusy,
}: Props) {
  const showShortlist = inShortlist || canAddShortlist;

  if (!showShortlist && !canMessage) {
    return null;
  }

  return (
    <View style={[styles.bar, { paddingBottom: spacing[12] + bottomInset }]}>
      {inShortlist ? (
        /*
          Non è un Button: un `Button` con `disabled` comunicherebbe
          «azione momentaneamente non disponibile», mentre questo è un
          **esito**. Resta nell'albero di accessibilità come testo di stato.
        */
        <View
          accessibilityRole="text"
          accessibilityLabel={`${APPLICATIONS_COPY.inShortlist}. Candidato già aggiunto alla shortlist di questa posizione.`}
          style={styles.shortlistState}
          testID="application-in-shortlist"
        >
          <Ionicons color={colors.textNeutral} name="checkmark" size={16} />
          <AppText color="neutral" variant="actionLabel">
            {APPLICATIONS_COPY.inShortlist}
          </AppText>
        </View>
      ) : canAddShortlist ? (
        <Button
          /* §20: «Durante la richiesta disabilita soltanto l'azione
             interessata e mostra loading nel pulsante.» */
          disabled={shortlistBusy}
          label={APPLICATIONS_COPY.addToShortlist}
          loading={shortlistBusy}
          onPress={onAddShortlist}
          size="md"
          style={styles.action}
          testID="application-add-shortlist"
          variant="primary"
        />
      ) : null}

      {canMessage ? (
        <Button
          disabled={messageBusy}
          label={APPLICATIONS_COPY.message}
          loading={messageBusy}
          onPress={onMessage}
          size="md"
          style={styles.action}
          testID="application-message"
          variant="neutralOutline"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    /* §11: elevazione per hairline, non per ombra. */
    borderTopColor: colors.borderNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  action: {
    flex: 1,
  },
  shortlistState: {
    alignItems: "center",
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.full,
    flex: 1,
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
});
