/** Il singolo incarico personale (master 15, 19). */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../src/features/dashboard/components/DashboardStates";
import { AssignmentDetailScreen } from "../../../src/features/role-link/roles/AssignmentDetailScreen";

export default function AssignmentDetailRoute() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();

  if (typeof assignmentId !== "string" || assignmentId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri l'incarico da Società e ruoli."
        onRetry={() => router.back()}
        title="Incarico non disponibile"
      />
    );
  }

  return <AssignmentDetailScreen assignmentId={assignmentId} />;
}
