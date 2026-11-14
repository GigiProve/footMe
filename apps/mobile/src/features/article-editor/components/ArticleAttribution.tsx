/**
 * Attribuzione pubblica di un testo importato già pubblicato altrove
 * (HOM-06.2 §7U, §7D, §7Q).
 *
 * «Pubblicato da [identity]», «Fonte originale · [nome fonte]», autore
 * originale se valorizzato, link originale solo se presente e sicuro. La
 * fonte resta visibile finché il contenuto è pubblico (§7U): per questo non
 * ha un modo di nascondersi.
 *
 * NON certifica la titolarità dei diritti: dice da dove proviene il testo e chi
 * lo pubblica su PROLINK. La dichiarazione dei diritti è privata e non arriva
 * mai qui (§7Q, §216).
 */

import { AppText, ContentModule } from "../../../ui";
import { openExternalUrl } from "../article-links";
import { attributionModel, type AttributionInput } from "../article-render";

type ArticleAttributionProps = AttributionInput;

export function ArticleAttribution({ publisherName, sourceName, originalAuthor, originalUrl }: ArticleAttributionProps) {
  const model = attributionModel({ originalAuthor, originalUrl, publisherName, sourceName });
  const link = model.link;

  return (
    <ContentModule
      actions={
        link
          ? [
              {
                accessibilityLabel: link.accessibilityLabel,
                icon: "open-outline",
                label: link.label,
                onPress: () => {
                  void openExternalUrl(link.href);
                },
              },
            ]
          : undefined
      }
      eyebrow="Fonte"
      testID="article-attribution"
    >
      <AppText variant="titleSm">{model.publishedBy}</AppText>
      {model.source ? (
        <AppText color="secondary" variant="meta">
          {model.source}
        </AppText>
      ) : null}
      {model.author ? (
        <AppText color="secondary" variant="meta">
          {model.author}
        </AppText>
      ) : null}
    </ContentModule>
  );
}
