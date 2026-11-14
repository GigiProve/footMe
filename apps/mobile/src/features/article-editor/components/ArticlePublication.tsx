/**
 * Riga «Pubblicazione · Ora ›» e foglio «Quando vuoi pubblicare?» dell'Articolo
 * (HOM-06.2 §81–§92, §166–§169, §7W; mockup 2–3, 5). Lo scheduler è UNO per Post e
 * Articolo (`publishing/components`): qui solo il collegamento con lo store e gli
 * eventi.
 *
 *  • la riga esiste solo se l'identity può programmare (§84–§85), altrimenti il
 *    chiamante non la monta e la CTA resta «Pubblica»;
 *  • in modifica di un programmato la data non cambia da sola (§166–§167): il foglio
 *    propone solo una data futura, «Pubblica ora» è un'azione della lista (§93).
 */

import { useState } from "react";

import { trackPublishing } from "../../publishing/publishing-analytics";
import { PublicationRow } from "../../publishing/components/PublicationRow";
import { PublicationSheet } from "../../publishing/components/PublicationSheet";
import type { Publication } from "../../publishing/publishing-types";
import { articleStore, currentIdentity, type ArticleStoreState } from "../article-store";

type Props = {
  state: ArticleStoreState;
  disabled?: boolean;
};

export function ArticlePublication({ state, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const editingScheduled = state.session?.editing === "scheduled";

  function openSheet() {
    trackPublishing({ format: "article", name: "schedule_opened" });
    setOpen(true);
  }

  function confirm(publication: Publication) {
    trackPublishing({ format: "article", name: publication.mode === "scheduled" ? "schedule_future_selected" : "schedule_now_selected" });
    articleStore.dispatch({ publication, type: "publicationChanged" });
    setOpen(false);
  }

  return (
    <>
      <PublicationRow disabled={disabled} onPress={openSheet} publication={state.publication} />
      <PublicationSheet
        futureOnly={editingScheduled}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        policy={state.schedulePolicy}
        publication={state.publication}
        visible={open && currentIdentity(state) !== null}
      />
    </>
  );
}
