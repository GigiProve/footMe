import { useQuery } from "@tanstack/react-query";

import { getChatMediaSignedUrl } from "./messaging-service";

/**
 * Resolves a chat-media storage path into a short-lived signed URL. `path`
 * is never a public URL — see messaging-service.ts getChatMediaSignedUrl.
 */
export function useChatMediaUrl(path: string | null) {
  return useQuery({
    enabled: !!path,
    queryFn: () => getChatMediaSignedUrl(path as string),
    queryKey: ["chat-media-url", path],
  });
}
