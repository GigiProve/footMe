/**
 * «Fonte e attribuzione» di un testo importato (HOM-06.2 §7D, §7P, §7Q, §7T–§7U;
 * §251). Stesso blocco nello schermo «Incolla un articolo» e, dopo l'import,
 * nell'editor: la sezione Fonte/Attribuzione resta sempre raggiungibile (§7T).
 *
 *  • «Il testo è già stato pubblicato altrove?» — No / Sì, nessuna preselezione
 *    (§7P). Se sì: Fonte originale (obbligatoria), Autore originale (facoltativo),
 *    Link originale (obbligatorio) oppure «Nessun link disponibile» per contenuti
 *    cartacei o offline. Fonte e autore originali sono attributi SEPARATI
 *    dall'identity che pubblica (§7D);
 *  • la checkbox dei diritti non è mai preselezionata e senza di essa non si
 *    pubblica né si programma (§7Q). Cambiare fonte, autore, link o identity la
 *    azzera (lo fa il reducer): non equivale a una verifica legale, e non si
 *    mostra come certificazione pubblica;
 *  • il testo non si perde mai: senza conferma si può continuare a scrivere (§7Q).
 *
 * Analytics (§257): solo il campo toccato, mai il valore, né diritti né fonte.
 */

import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText, Checkbox, Input, Radio } from "../../../ui";
import { trackArticle } from "../article-analytics";
import { blockerCopy, type ArticleBlocker } from "../article-presentation";
import { articleStore } from "../article-store";
import type { ArticleProvenance } from "../article-types";

export const RIGHTS_DECLARATION = "Confermo di avere i diritti o l'autorizzazione a pubblicare questo contenuto.";

type Props = {
  provenance: ArticleProvenance;
  rightsConfirmed: boolean;
  blocker: ArticleBlocker | null;
  disabled?: boolean;
  /** In modifica di un pubblicato con fonte dichiarata: l'attribuzione non si toglie (§219, §7U). */
  lockElsewhere?: boolean;
};

function patch(change: Partial<ArticleProvenance>) {
  articleStore.dispatch({ patch: change, type: "provenanceChanged" });
}

export function ProvenanceFields({ provenance, rightsConfirmed, blocker, disabled = false, lockElsewhere = false }: Props) {
  const elsewhere = provenance.publishedElsewhere === true;
  const hint = (when: ArticleBlocker) => (blocker === when ? blockerCopy(when) : undefined);

  return (
    <View style={styles.section} testID="article-provenance">
      <AppText color="secondary" variant="eyebrow">
        Fonte e attribuzione
      </AppText>
      <AppText accessibilityRole="header" variant="titleSm">
        Il testo è già stato pubblicato altrove?
      </AppText>

      <View accessibilityRole="radiogroup">
        <Radio
          checked={provenance.publishedElsewhere === false}
          disabled={disabled || lockElsewhere}
          label="No, non è ancora stato pubblicato"
          onPress={() => {
            patch({ publishedElsewhere: false });
            trackArticle({ field: "published_elsewhere", name: "article_source_updated" });
          }}
          testID="article-provenance-no"
        />
        <Radio
          checked={elsewhere}
          disabled={disabled}
          label="Sì, è già stato pubblicato"
          onPress={() => {
            patch({ publishedElsewhere: true });
            trackArticle({ field: "published_elsewhere", name: "article_source_updated" });
          }}
          testID="article-provenance-yes"
        />
      </View>
      {blocker === "provenance_choice" ? (
        <AppText color="secondary" variant="bodySm">
          {blockerCopy("provenance_choice")}
        </AppText>
      ) : null}

      {elsewhere ? (
        <View style={styles.fields}>
          <Input
            autoCapitalize="words"
            disabled={disabled}
            helperText={hint("provenance_source")}
            label="Fonte originale"
            onBlur={() => provenance.sourceName.trim() && trackArticle({ field: "source_name", name: "article_source_updated" })}
            onChangeText={(sourceName) => patch({ sourceName })}
            placeholder="Per esempio: nome della testata o del sito"
            value={provenance.sourceName}
          />
          <Input
            autoCapitalize="words"
            disabled={disabled}
            label="Autore originale (facoltativo)"
            onBlur={() => provenance.originalAuthor.trim() && trackArticle({ field: "original_author", name: "article_source_updated" })}
            onChangeText={(originalAuthor) => patch({ originalAuthor })}
            placeholder="Se non è noto o coincide con la fonte, lascia vuoto"
            value={provenance.originalAuthor}
          />
          {provenance.noOriginalLink ? null : (
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              disabled={disabled}
              helperText={hint("provenance_link")}
              keyboardType="url"
              label="Link originale"
              onBlur={() => provenance.originalUrl.trim() && trackArticle({ field: "original_url", name: "article_source_updated" })}
              onChangeText={(originalUrl) => patch({ originalUrl })}
              placeholder="https://"
              value={provenance.originalUrl}
            />
          )}
          <Checkbox
            checked={provenance.noOriginalLink}
            disabled={disabled}
            label="Nessun link disponibile"
            onValueChange={(noOriginalLink) => {
              patch({ noOriginalLink });
              trackArticle({ field: "no_link", name: "article_source_updated" });
            }}
          />
        </View>
      ) : null}

      <View style={styles.rights}>
        <Checkbox
          checked={rightsConfirmed}
          disabled={disabled}
          label={RIGHTS_DECLARATION}
          onValueChange={(value) => {
            articleStore.dispatch({ type: "rightsChanged", value });
            if (value) trackArticle({ name: "article_rights_confirmed" });
          }}
          testID="article-rights"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing[12],
    paddingTop: spacing[8],
  },
  rights: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    marginTop: spacing[8],
    paddingTop: spacing[8],
  },
  section: {
    gap: spacing[4],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
});
