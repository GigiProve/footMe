/**
 * I motivi del foglio «Aiutaci a migliorare i suggerimenti» (HOM-11 §46–§49).
 *
 * Una sola lettura server-driven, condivisa da ogni placeholder della sessione: i
 * motivi non si replicano nei componenti (§49) e non si leggono finché il foglio non
 * serve (`enabled`). Cambiano di rado: `staleTime` lungo.
 */

import { useQuery } from "@tanstack/react-query";

import { FEED_FEEDBACK_QK } from "./feed-feedback-keys";
import { fetchFeedbackReasons } from "./feed-feedback-service";

export const FEEDBACK_REASONS_STALE_MS = 10 * 60 * 1000;

export function useFeedbackReasons(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: fetchFeedbackReasons,
    queryKey: FEED_FEEDBACK_QK.reasons(),
    staleTime: FEEDBACK_REASONS_STALE_MS,
  });
}
