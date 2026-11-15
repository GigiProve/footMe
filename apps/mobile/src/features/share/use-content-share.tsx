/**
 * Punto di ingresso del flusso Condividi per le superfici (HOM-09 §4, §9, §174).
 *
 * La superficie di origine — una tab del Feed, il dettaglio Post, il dettaglio
 * Articolo/Video — chiama `open(target)` dal tap su «Condividi» e monta
 * `element` nel proprio albero:
 *
 *   const share = useContentShare(origin);
 *   …onShare={() => share.open(buildShareTarget(item))}
 *   …return (<>{…}{share.element}</>);
 *
 * Il tap apre solo il pannello (§9): non naviga, non invia, non crea
 * conversazioni e non incrementa Condivisioni. Ogni apertura monta un flusso
 * nuovo (`key`), con batch e stato propri; finché uno è aperto un secondo tap è
 * ignorato. L'origine resta montata sotto, quindi chiudere riporta alla stessa
 * superficie con lo stesso scroll (§176–§178).
 */

import { useRef, useState, type ReactElement } from "react";

import { ContentShareHost } from "./components/ContentShareHost";
import type { ShareOrigin, ShareTarget } from "./share-types";

export function useContentShare(origin: ShareOrigin): {
  element: ReactElement | null;
  open: (target: ShareTarget) => void;
} {
  const [session, setSession] = useState<{ id: number; target: ShareTarget } | null>(null);
  const counter = useRef(0);
  const isOpen = useRef(false);

  const open = (target: ShareTarget) => {
    if (isOpen.current) {
      return;
    }

    isOpen.current = true;
    counter.current += 1;
    setSession({ id: counter.current, target });
  };

  const element = session ? (
    <ContentShareHost
      key={session.id}
      onClosed={() => {
        isOpen.current = false;
      }}
      origin={origin}
      target={session.target}
    />
  ) : null;

  return { element, open };
}
