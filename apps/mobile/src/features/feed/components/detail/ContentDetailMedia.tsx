/**
 * Media in testa al dettaglio contenuto storico (HOM-03 §35, §49–50).
 *
 * L'Articolo valorizza qui la cover ampia, che nel Feed è solo una miniatura
 * (§50): 16:9 a tutta larghezza, rapporto fisso così non salta al caricamento
 * (§108). Un video — cover o media del contenuto — si riproduce con lo stesso
 * `VideoMedia` e lo stesso player del Feed (§35, §38): inline, senza modale. Se
 * il Feed ha aperto il dettaglio dal video (`?media=N`) parte una volta sola,
 * perché il tap esplicito è già avvenuto.
 *
 * Se la cover non carica sparisce senza lasciare un buco: il titolo resta
 * leggibile e il corpo del contenuto non dipende da lei.
 */

import { useState } from "react";
import { Image, StyleSheet } from "react-native";

import { colors, radius } from "../../../../theme/tokens";
import type { FeedMediaItem } from "../../feed-types";
import { VideoMedia } from "../video/VideoMedia";

type ContentDetailMediaProps = {
  /** Chiave del contenuto (`<tipo>:<uuid>`), come nel Feed. */
  itemId: string;
  video: FeedMediaItem | null;
  coverUrl: string | null;
  title: string;
  autoStart: boolean;
};

export function ContentDetailMedia({
  itemId,
  video,
  coverUrl,
  title,
  autoStart,
}: ContentDetailMediaProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  if (video) {
    return <VideoMedia autoStart={autoStart} itemId={itemId} media={video} surface="detail" />;
  }

  if (!coverUrl || coverFailed) {
    return null;
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={`Copertina: ${title}`}
      onError={() => setCoverFailed(true)}
      resizeMode="cover"
      source={{ uri: coverUrl }}
      style={styles.cover}
      testID="content-detail-cover"
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    width: "100%",
  },
});
