/**
 * Barra operativa del dettaglio (§15, §20, §22 — screen 05-10).
 *
 * Una primaria sola, sempre nello stesso posto: §15 — «barra operativa con
 * primaria shortlist e secondaria Messaggio», e «mantieni una sola
 * primaria».
 *
 * Lo stato dopo l'aggiunta non è un successo celebrato: §20 — «Dopo conferma
 * mostra **✓ In shortlist**, con superficie grigio neutro e testo nero. Non
 * usare verde decorativo, popup di successo o una schermata celebrativa.»
 *
 * DAS-REV-24 lo aveva reso **non tappabile**, per non farne «un comando
 * nascosto di rimozione». DAS-REV-25 §11 completa quel comportamento senza
 * contraddirlo: il controllo resta neutro e continua a non rimuovere nulla
 * al tap, ma apre uno sheet di azioni — «Il controllo confermato resta
 * neutro e diventa un accesso ad azioni, con label accessibile equivalente
 * a In shortlist, apri azioni. Non annunciarlo come rimozione e non
 * rimuovere al tap.»
 *
 * Un'azione non autorizzata non diventa un pulsante disabilitato: §22 — «Se
 * il sistema non consente alla Society corrente di scrivere, nascondi
 * l'azione non autorizzata.» Lo stesso vale per la shortlist.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { SHORTLIST_COPY } from "../../shortlist/shortlist-presentation";
import { APPLICATIONS_COPY } from "../applications-presentation";

type Props = {
  bottomInset: number;
  canAddShortlist: boolean;
  canMessage: boolean;
  inShortlist: boolean;
  messageBusy: boolean;
  onAddShortlist: () => void;
  onMessage: () => void;
  /** DAS-REV-25 §11: apre lo sheet delle azioni sulla membership. */
  onOpenShortlistActions: () => void;
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
  onOpenShortlistActions,
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
          Non è un `Button`: la superficie resta quella neutra dell'esito,
          non quella di una CTA (§4 della 25 — «In shortlist: superficie
          grigia neutra, check e testo neri»). È però un controllo, e
          l'etichetta accessibile dice che cosa fa il tap: §31 — «In
          shortlist deve annunciare stato e apertura azioni.»
        */
        <Pressable
          accessibilityHint="Apre le azioni sulla shortlist di questa posizione"
          accessibilityLabel={`${APPLICATIONS_COPY.inShortlist}. ${SHORTLIST_COPY.sheetOpenActions}`}
          accessibilityRole="button"
          onPress={onOpenShortlistActions}
          style={({ pressed }) => [
            styles.shortlistState,
            pressed ? styles.pressed : null,
          ]}
          testID="application-in-shortlist"
        >
          <Ionicons color={colors.textNeutral} name="checkmark" size={16} />
          <AppText color="neutral" variant="actionLabel">
            {APPLICATIONS_COPY.inShortlist}
          </AppText>
        </Pressable>
      ) : canAddShortlist ? (
        <Button
          /* §20: «Durante la richiesta disabilita soltanto l'azione
             interessata e mostra loading nel pulsante.» */
          disabled={shortlistBusy}
          label={APPLICATIONS_COPY.addToShortlist}
          loading={shortlistBusy}
          onPress={onAddShortlist}
          size="lg"
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
          size="lg"
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
    /* DAS-REV-23 §34: «nessun overflow orizzontale o testo troncato nelle
       azioni essenziali», e §29 vieta di rimpicciolire il testo per farcelo
       stare. Con una base di 150 le due azioni stanno affiancate al viewport
       di riferimento — com'è nel PNG — e vanno a capo sotto i ~340 px, dove
       «Aggiungi alla shortlist» accanto a «Messaggio» non entrerebbe. */
    flexWrap: "wrap",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  action: {
    flexBasis: 150,
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  shortlistState: {
    alignItems: "center",
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.full,
    flexBasis: 150,
    flexGrow: 1,
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
  },
});
