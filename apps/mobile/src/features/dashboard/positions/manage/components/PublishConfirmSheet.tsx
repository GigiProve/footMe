/**
 * Conferma leggera della pubblicazione singola (DAS-REV-17 §15, screen 05).
 *
 * «Non richiedere checkbox aggiuntive, un passaggio per compilare
 * facoltativi o una seconda conferma dopo questa.» Da qui una sola
 * primaria, una secondaria testuale per l'anteprima e «Annulla»: nessuna
 * spunta, nessun secondo livello.
 *
 * «Annullare non modifica lo stato della Position e non cancella la
 * bozza»: questo componente non esegue nulla: espone tre callback e il
 * chiamante decide. È ciò che gli permette di non conoscere versione,
 * operation key né idempotenza.
 *
 * «Sfondo attenuato e focus modale»: il `BottomSheet` condiviso monta un
 * `Modal` che copre la bottom navigation sottostante e ne intercetta il
 * focus (§6).
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import { MANAGE_COPY } from "../manage-presentation";

type Props = {
  /** «Primavera · Settore giovanile» oppure «Intera società». */
  context: string;
  onCancel: () => void;
  onPreview: () => void;
  onPublish: () => void;
  publishing: boolean;
  /** Il ruolo/titolo reale, mai un segnaposto (§15). */
  title: string;
  visible: boolean;
};

export function PublishConfirmSheet({
  context,
  onCancel,
  onPreview,
  onPublish,
  publishing,
  title,
  visible,
}: Props) {
  return (
    <BottomSheet
      onClose={onCancel}
      title={MANAGE_COPY.publishAction}
      visible={visible}
    >
      <View style={styles.body}>
        <View style={styles.identity}>
          <AppText color="neutral" variant="titleMd">
            {title}
          </AppText>

          <AppText color="neutralMuted" variant="bodySm">
            {context}
          </AppText>
        </View>

        <AppText color="neutralMuted" variant="bodySm">
          {MANAGE_COPY.publishConsequence}
        </AppText>

        {/* §15: «Vedi anteprima annuncio» è una scelta facoltativa, non uno
            step. Testo premuto, non una seconda primaria. */}
        <Button
          label={MANAGE_COPY.publishPreview}
          onPress={onPreview}
          size="md"
          testID="position-publish-preview"
          variant="link"
        />

        <Button
          fullWidth
          label={MANAGE_COPY.publishAction}
          loading={publishing}
          onPress={onPublish}
          testID="position-publish-confirm"
        />

        <Button
          fullWidth
          label={MANAGE_COPY.publishCancel}
          onPress={onCancel}
          size="md"
          testID="position-publish-cancel"
          variant="link"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[12],
  },
  identity: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingBottom: spacing[12],
  },
});
