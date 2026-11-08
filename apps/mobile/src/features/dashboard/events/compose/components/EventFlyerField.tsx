/**
 * «Locandina — facoltativa» all'inizio del passaggio 2 (DAS-REV-29 §8,
 * screen 02).
 *
 *   · senza asset: «Aggiungi locandina»;
 *   · con asset: anteprima contenuta (rapporto reale, nessun crop),
 *     «Sostituisci» e «Rimuovi»;
 *   · durante l'upload la versione salvata resta visibile e il caricamento si
 *     legge sul pulsante: niente riferimento incompleto (§8);
 *   · un errore resta locale e non blocca il resto del form (QA-015).
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";
import { EventFlyerImage } from "../../detail/components/EventDetailParts";

export const FLYER_FIELD_COPY = {
  add: "Aggiungi locandina",
  label: "Locandina — facoltativa",
  remove: "Rimuovi",
  replace: "Sostituisci",
} as const;

export function EventFlyerField({
  error,
  hasFlyer,
  height,
  onAdd,
  onRemove,
  previewUri,
  title,
  uploading,
  width,
}: {
  error: string | null;
  hasFlyer: boolean;
  height: number | null;
  onAdd: () => void;
  onRemove: () => void;
  previewUri: string | null;
  title: string;
  uploading: boolean;
  width: number | null;
}) {
  return (
    <View style={styles.block} testID="event-field-flyer">
      <AppText color="neutral" variant="metaStrong">
        {FLYER_FIELD_COPY.label}
      </AppText>

      {hasFlyer ? (
        <>
          <EventFlyerImage height={height} title={title} uri={previewUri} width={width} />
          <View style={styles.row}>
            <Button
              disabled={uploading}
              label={FLYER_FIELD_COPY.replace}
              loading={uploading}
              onPress={onAdd}
              size="sm"
              style={styles.flex}
              testID="event-flyer-replace"
              variant="secondary"
            />
            <Button
              destructive
              disabled={uploading}
              label={FLYER_FIELD_COPY.remove}
              onPress={onRemove}
              size="sm"
              style={styles.flex}
              testID="event-flyer-remove"
              variant="neutralOutline"
            />
          </View>
        </>
      ) : (
        <Button
          disabled={uploading}
          fullWidth
          label={FLYER_FIELD_COPY.add}
          loading={uploading}
          onPress={onAdd}
          size="md"
          testID="event-flyer-add"
          variant="secondary"
        />
      )}

      {error ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
    paddingBottom: spacing[8],
    paddingTop: spacing[8],
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
});
