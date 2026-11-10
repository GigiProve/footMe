/**
 * Query key della chat (DAS-REV-33 §26). Esistevano come literal sparsi nella
 * schermata; la revoca di accesso deve poterli rimuovere tutti per una
 * conversazione, quindi le definizioni stanno in un posto solo. Le forme sono
 * invariate: ogni chiave porta già `conversationId`, che distingue i periodi
 * di accesso perché un nuovo periodo riparte da cache vuota (le query della
 * conversazione vengono rimosse alla fine del periodo).
 */
export const MESSAGING_QK = {
  conversationMessages: (conversationId: string) =>
    ["conversation-messages", conversationId] as const,
  conversationMeta: (conversationId: string) => ["conversation-meta", conversationId] as const,
  conversationType: (conversationId: string) => ["conversation-type", conversationId] as const,
  groupMeta: (conversationId: string) => ["group-conversation-meta", conversationId] as const,
  inbox: (profileId: string) => ["inbox-conversations", profileId] as const,
} as const;

/**
 * Gli URL firmati dei media sono indicizzati per path
 * (`<conversationId>/<file>`, vedi chat-media-service): un predicate sul
 * prefisso li isola per conversazione.
 */
export function isChatMediaQueryOf(queryKey: readonly unknown[], conversationId: string) {
  return (
    queryKey[0] === "chat-media-url" &&
    typeof queryKey[1] === "string" &&
    queryKey[1].startsWith(`${conversationId}/`)
  );
}
