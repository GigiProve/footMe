import { Stack } from "expo-router";

/**
 * Editor Articolo (HOM-06.2 §28–§29, §7A): selector di modalità, editor, «Collega
 * da un link», «Incolla un articolo», Anteprima e riapertura per riferimento.
 *
 * Fuori dalle tab, come `app/post-compose/`: nessuna bottom navigation, nessun
 * header PROLINK. La presentazione a schermo intero (modale) è dichiarata nel
 * layout radice. Il gesto di chiusura è disattivato: l'uscita passa dal dialogo
 * «Uscire dal contenuto?» (§133–§136), non da uno swipe. Le identity arrivano da
 * `fetch_article_composer_context` (§16), non dalla Dashboard.
 */
export default function ArticleComposeLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: false, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="editor" />
      <Stack.Screen name="link" />
      <Stack.Screen name="paste" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="open" />
    </Stack>
  );
}
