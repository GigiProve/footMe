/**
 * «Informazioni non modificabili» (DAS-REV-17 §19, screen 10).
 *
 * Due frasi e un «Ho capito». §19 è esplicita su cosa **non** deve
 * contenere: «La spiegazione non è un comando operativo di chiusura. Non
 * aggiungere in questo sheet "Chiudi posizione", un'azione distruttiva o il
 * flusso della revisione successiva.» Per questo il componente non accetta
 * callback oltre alla chiusura: non c'è posto dove un comando potrebbe
 * entrare.
 *
 * La prima frase cambia con l'ambito — una squadra per un incarico TEAM,
 * l'ambito per uno societario — perché §19 vieta di nominare «una squadra
 * inesistente».
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import { MANAGE_COPY } from "../manage-presentation";

type Props = {
  /** Già adattato all'ambito da `lockedInfoBody`. */
  body: string;
  onClose: () => void;
  visible: boolean;
};

export function LockedIdentitySheet({ body, onClose, visible }: Props) {
  return (
    <BottomSheet
      onClose={onClose}
      title={MANAGE_COPY.lockedInfoTitle}
      visible={visible}
    >
      <View style={styles.body}>
        <AppText color="neutralMuted" variant="bodySm">
          {body}
        </AppText>

        {/* §3: «Un testo informativo può spiegare che un'esigenza sportiva
            differente richiede una nuova posizione; non deve introdurre di
            nascosto un comando di chiusura.» Resta testo. */}
        <AppText color="neutralMuted" variant="bodySm">
          {MANAGE_COPY.lockedInfoTail}
        </AppText>

        <Button
          fullWidth
          label={MANAGE_COPY.lockedAck}
          onPress={onClose}
          testID="position-locked-ack"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[12],
  },
});
