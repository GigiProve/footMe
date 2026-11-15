/**
 * HOM-11: Segnala. Route radice fuori da `(tabs)` (D7: niente bottom nav, come Dettagli e
 * statistiche HOM-05), a due segmenti dinamici: `/report/content/<id>` e `/report/comment/<id>`.
 * Parametri non validi → stato «non più disponibile» dentro la schermata. La logica sta in
 * `features/moderation`.
 */

import { useLocalSearchParams } from "expo-router";

import { ReportFlowScreen } from "../../../src/features/moderation/components/ReportFlowScreen";
import { parseReportTarget } from "../../../src/features/moderation/moderation-routes";

export default function ReportRoute() {
  const { contentId, contentType, id, origin, targetType } = useLocalSearchParams<{
    contentId?: string;
    contentType?: string;
    id: string;
    origin?: string;
    targetType: string;
  }>();

  return (
    <ReportFlowScreen
      target={parseReportTarget({ contentId, contentType, id, origin, targetType })}
    />
  );
}
