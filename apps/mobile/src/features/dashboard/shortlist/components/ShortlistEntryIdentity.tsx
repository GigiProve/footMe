/**
 * Identità live della persona nella scheda interna (DAS-REV-25 §15.1).
 *
 * «Avatar, nome e sintesi professionale live.» Live significa che questi
 * dati vengono dal profilo canonico a ogni lettura e non da una copia
 * dentro la membership: §7 — «Non copiare carriera, statistiche o contatti
 * privati nella entry», §15 — «Aggiornamento del profilo live cambia la
 * sintesi professionale senza alterare nota, valutazione o origine.»
 *
 * Estratto perché la stessa testata serve alla scheda e all'editor, e
 * perché il blocco che apre la pagina è esattamente ciò che lo screen 08
 * dice di non far coprire dal toast di successo.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";

type Props = {
  avatarUrl: string | null;
  identity: string;
  name: string;
  situation: string | null;
};

export function ShortlistEntryIdentity({
  avatarUrl,
  identity,
  name,
  situation,
}: Props) {
  return (
    <View style={styles.row} testID="shortlist-entry-identity">
      <Avatar name={name} size="lg" uri={avatarUrl ?? undefined} />

      <View style={styles.body}>
        <AppText color="neutral" numberOfLines={2} variant="titleMd">
          {name}
        </AppText>

        {identity ? (
          <AppText color="neutralMuted" numberOfLines={2} variant="meta">
            {identity}
          </AppText>
        ) : null}

        {/* §12: un contesto non determinabile non diventa «Svincolato». La
            derivazione canonica restituisce null, e la riga non si disegna. */}
        {situation ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {situation}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
